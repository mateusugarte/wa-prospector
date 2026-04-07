# CLAUDE.md — WA Prospector

## Visão Geral do Projeto

Sistema de prospecção automatizada via WhatsApp. Permite disparar mensagens personalizadas em massa com anti-bloqueio nativo, coleta automática de leads via Apify, e dashboard ao vivo com métricas de envio.

**Nome do projeto:** `wa-prospector`
**Stack:** Node.js + Express (backend) · React + Vite + Tailwind (frontend) · Supabase (banco + realtime) · BullMQ + Redis (filas) · UazAPI (WhatsApp unofficial) · Apify (scraping de leads)

---

## Arquitetura de Pastas

```
wa-prospector/
├── backend/
│   ├── src/
│   │   ├── routes/          # Express routers
│   │   ├── services/
│   │   │   ├── uazapi.js    # Wrapper UazAPI (conectar WA, enviar msgs)
│   │   │   ├── apify.js     # Wrapper Apify (rodar actors, buscar leads)
│   │   │   ├── spinner.js   # Variações de mensagem com sintaxe {a|b|c}
│   │   │   └── scheduler.js # Lógica de delays, limites diários, warmup
│   │   ├── workers/
│   │   │   └── dispatch.worker.js  # Consome fila BullMQ e dispara msgs
│   │   ├── queues/
│   │   │   └── dispatch.queue.js   # Definição da fila BullMQ
│   │   └── lib/
│   │       └── supabase.js  # Client Supabase (service role)
│   ├── .env                 # Variáveis de ambiente (NÃO commitar)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Métricas ao vivo
│   │   │   ├── Campaigns.jsx       # Listar/criar campanhas
│   │   │   ├── NewCampaign.jsx     # Wizard de criação
│   │   │   ├── Templates.jsx       # CRUD de templates
│   │   │   └── Settings.jsx        # Conexão WhatsApp (QR)
│   │   ├── components/
│   │   └── lib/
│   │       └── supabase.js  # Client Supabase (anon key)
│   ├── .env                 # Variáveis de ambiente (NÃO commitar)
│   └── package.json
│
├── supabase/
│   └── schema.sql           # DDL completo do banco
│
├── CLAUDE.md                # Este arquivo
└── ROADMAP.md               # Roadmap de desenvolvimento
```

---

## Banco de Dados (Supabase / PostgreSQL)

Todas as tabelas estão no schema `public`. Ver `supabase/schema.sql` para o DDL completo.

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `campaigns` | Campanhas de disparo (nome, status, config de limites) |
| `templates` | Templates de mensagem com sintaxe de spin `{a\|b\|c}` |
| `leads` | Contatos importados (nome, telefone, origem, campanha) |
| `dispatches` | Log de cada disparo individual (status, msg gerada, erro) |
| `wa_instances` | Instâncias conectadas do WhatsApp via UazAPI |

### Enums importantes

- `campaign_status`: `draft` · `running` · `paused` · `completed` · `cancelled`
- `dispatch_status`: `pending` · `sent` · `failed` · `retrying`
- `lead_source`: `manual_upload` · `apify`
- `wa_status`: `disconnected` · `connecting` · `connected`

---

## Variáveis de Ambiente

### Backend (`backend/.env`)

```env
# Supabase
SUPABASE_URL=https://jlzckqjggdzpzqiuvgcv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# UazAPI
UAZAPI_BASE_URL=https://api.uazapi.com
UAZAPI_TOKEN=SEU_TOKEN_AQUI

# Apify
APIFY_TOKEN=SEU_TOKEN_APIFY_AQUI

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# App
PORT=3001
NODE_ENV=development
```

### Frontend (`frontend/.env`)

```env
VITE_SUPABASE_URL=https://jlzckqjggdzpzqiuvgcv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:3001
```

> ⚠️ Nunca commitar arquivos `.env`. Ambos já devem estar no `.gitignore`.

---

## Regras de Negócio Críticas

### Anti-bloqueio (OBRIGATÓRIO)

1. **Warmup:** Contas com menos de 7 dias conectadas ficam limitadas a 20 msgs/dia automaticamente
2. **Delays:** Entre cada disparo, aguardar tempo aleatório entre `delayMin` e `delayMax` segundos (configurado por campanha)
3. **Typing simulation:** Chamar `/sendTyping` na UazAPI antes de `/sendText` com duração proporcional ao tamanho da mensagem
4. **Pausa longa:** A cada 15–25 mensagens (aleatório), fazer pausa extra de 2–5 minutos
5. **Limites por hora:** Máximo 40 msgs/hora para contas com menos de 30 dias; 80/hora para contas mais antigas
6. **Horário:** Não disparar entre 23h e 8h (horário de Brasília)
7. **Número inválido:** Sempre checar `/checkNumber` antes de enviar. Se inválido, marcar disparo como `failed` com motivo `invalid_number`

### Message Spinner

Sintaxe: `{opção1|opção2|opção3}` dentro do template.

Exemplo:
```
Olá {Dr.|Dra.|}, vi que {sua clínica|seu consultório|seu espaço} aparece no Google.
Trabalho com {agendamento automático|automação de agenda|gestão de agenda} para {clínicas|consultórios}.
```

O spinner gera uma variação diferente por disparo. A mensagem gerada final deve ser salva em `dispatches.message_sent`.

### Dois modos de campanha

- **Modo Manual:** User faz upload de CSV/XLSX com leads → seleciona campanha → dispara
- **Modo Automático:** User configura Apify actor + parâmetros → sistema coleta leads → dispara automaticamente

---

## Integrações Externas

### UazAPI (WhatsApp)

Base URL configurada no `.env`. Principais endpoints usados:

```
POST /instance/create          → Criar instância
GET  /instance/{id}/qrcode     → Obter QR para conexão
GET  /instance/{id}/status     → Status da conexão
POST /message/{id}/sendText    → Enviar mensagem de texto
POST /message/{id}/sendTyping  → Simular digitação
POST /contact/{id}/checkNumber → Verificar se número existe no WA
POST /instance/{id}/disconnect → Desconectar
```

Sempre passar o header: `Authorization: Bearer {UAZAPI_TOKEN}`

### Apify

Usar SDK oficial `apify-client`. Actor principal: `apify/google-maps-scraper`.

Fluxo:
1. `POST /v2/acts/{actorId}/runs` → iniciar run
2. Polling em `GET /v2/actor-runs/{runId}` até `status === 'SUCCEEDED'`
3. `GET /v2/datasets/{defaultDatasetId}/items` → buscar os leads

Campos a mapear: `title` → `name`, `phone` → `phone`, `address` → `city`

---

## Realtime (Socket.io)

O backend emite eventos via Socket.io. O frontend escuta e atualiza UI sem refresh.

| Evento | Payload | Quando emitir |
|--------|---------|---------------|
| `dispatch:update` | `{ dispatchId, status, leadId, campaignId }` | Após cada disparo |
| `campaign:stats` | `{ campaignId, sent, failed, pending }` | A cada 5 disparos |
| `wa:status` | `{ instanceId, status }` | Mudança de status WA |

---

## Comandos úteis

```bash
# Instalar dependências
cd backend && npm install
cd frontend && npm install

# Rodar em desenvolvimento
cd backend && npm run dev     # porta 3001
cd frontend && npm run dev    # porta 5173

# Rodar Redis localmente (Docker)
docker run -d -p 6379:6379 redis:alpine

# Aplicar schema no Supabase
# Cole o conteúdo de supabase/schema.sql no SQL Editor do Supabase
```

---

## Instruções para o Claude Code

- Sempre criar arquivos `.env` a partir dos templates acima antes de rodar qualquer coisa
- O schema do banco deve ser aplicado no Supabase via SQL Editor ANTES de rodar o backend
- Usar o client Supabase com `service_role` no backend (acesso total) e `anon` no frontend (RLS)
- Redis é necessário para o BullMQ — subir via Docker antes de iniciar o backend
- Para testar o spinner, usar `spinner.js` standalone antes de integrar ao worker
- Ao implementar o worker, testar primeiro com 1–2 números reais antes de ligar campanhas maiores
