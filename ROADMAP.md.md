# ROADMAP.md — WA Prospector

Sistema de prospecção automatizada via WhatsApp com anti-bloqueio, coleta de leads via Apify e dashboard ao vivo.

---

## Stack de Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 20 + Express |
| Frontend | React 18 + Vite + Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) |
| Realtime | Socket.io |
| Filas | BullMQ + Redis |
| WhatsApp API | UazAPI (unofficial) |
| Coleta de leads | Apify SDK |
| ORM | Supabase JS Client (sem ORM adicional) |

---

## Fase 1 — Fundação e Conexão WhatsApp
**Prazo estimado: Semana 1–2**

### Objetivo
Estrutura base do projeto funcionando com conexão WhatsApp via QR e envio manual de mensagem simples.

### Tarefas

#### 1.1 Setup do projeto
- [ ] Criar monorepo com pastas `backend/` e `frontend/`
- [ ] Iniciar `package.json` em cada pasta
- [ ] Configurar `.gitignore` (incluir `.env`, `node_modules`, `dist`)
- [ ] Criar arquivos `.env` a partir dos templates do `CLAUDE.md`
- [ ] Instalar dependências do backend: `express`, `cors`, `dotenv`, `@supabase/supabase-js`, `socket.io`
- [ ] Instalar dependências do frontend: `react`, `vite`, `tailwindcss`, `@supabase/supabase-js`, `socket.io-client`

#### 1.2 Configuração do banco (Supabase)
- [ ] Aplicar `supabase/schema.sql` no SQL Editor do Supabase
- [ ] Verificar que todas as tabelas foram criadas: `campaigns`, `templates`, `leads`, `dispatches`, `wa_instances`
- [ ] Testar conexão com `@supabase/supabase-js` no backend usando service role key
- [ ] Criar `backend/src/lib/supabase.js` e `frontend/src/lib/supabase.js`

#### 1.3 Integração UazAPI
- [ ] Criar `backend/src/services/uazapi.js` com métodos:
  - `createInstance(name)` → POST /instance/create
  - `getQRCode(instanceId)` → GET /instance/{id}/qrcode
  - `getStatus(instanceId)` → GET /instance/{id}/status
  - `sendText(instanceId, phone, message)` → POST /message/{id}/sendText
  - `sendTyping(instanceId, phone, duration)` → POST /message/{id}/sendTyping
  - `checkNumber(instanceId, phone)` → POST /contact/{id}/checkNumber
  - `disconnect(instanceId)` → POST /instance/{id}/disconnect
- [ ] Testar cada método com Postman/curl antes de integrar

#### 1.4 Endpoints de conexão WA no backend
- [ ] `POST /api/wa/connect` → cria instância, salva em `wa_instances`, retorna QR
- [ ] `GET /api/wa/status/:instanceId` → retorna status atual
- [ ] `POST /api/wa/disconnect/:instanceId` → desconecta e atualiza banco
- [ ] Emitir evento Socket.io `wa:status` quando status mudar (webhook UazAPI ou polling)

#### 1.5 Tela de configuração WA no frontend
- [ ] Página `/settings` com componente `QRCodeDisplay`
- [ ] Polling `GET /api/wa/status` a cada 3 segundos enquanto status for `connecting`
- [ ] Exibir QR via lib `qrcode.react` ou similar
- [ ] Detectar status `connected` → exibir número conectado + botão desconectar
- [ ] Listener Socket.io `wa:status` para atualizar UI em tempo real

---

## Fase 2 — Motor de Disparo com Anti-Bloqueio
**Prazo estimado: Semana 3–4**

### Objetivo
Sistema de fila com BullMQ, Message Spinner, delays aleatórios e registro em tempo real de resultados.

### Tarefas

#### 2.1 Message Spinner
- [ ] Criar `backend/src/services/spinner.js`
- [ ] Função `spin(template)`: parseiar blocos `{a|b|c}` e sortear aleatoriamente
- [ ] Suportar múltiplos blocos no mesmo template
- [ ] Função `preview(template, n)`: gerar `n` variações de exemplo
- [ ] Testar com templates reais antes de integrar

```javascript
// Exemplo de uso esperado:
spin("Olá {Dr.|Dra.|}, vi seu {consultório|espaço|clínica}!")
// → "Olá Dr., vi seu consultório!"
// → "Olá Dra., vi seu espaço!"
```

#### 2.2 Scheduler (delays e limites)
- [ ] Criar `backend/src/services/scheduler.js` com:
  - `getDelay(campaign)` → retorna delay aleatório entre `delayMin` e `delayMax` ms
  - `getLongPauseDelay()` → retorna delay longo (2–5 min) para pausas periódicas
  - `shouldLongPause(sentCount)` → retorna `true` se deve pausar (a cada 15–25 msgs)
  - `isAllowedHour()` → retorna `false` se estiver entre 23h–8h (Brasília)
  - `getDailyLimit(connectedAt)` → retorna limite diário baseado em dias conectados
  - `getHourlyLimit(connectedAt)` → retorna limite por hora

#### 2.3 Fila BullMQ
- [ ] Instalar `bullmq` e `ioredis`
- [ ] Criar `backend/src/queues/dispatch.queue.js` com fila `dispatch-queue`
- [ ] Funções: `addJob(leadId, campaignId, templateId)`, `pauseQueue()`, `resumeQueue()`, `getJobCounts()`
- [ ] Garantir que Redis está rodando (`redis://localhost:6379`)

#### 2.4 Worker de disparo
- [ ] Criar `backend/src/workers/dispatch.worker.js`
- [ ] Fluxo por job:
  1. Buscar lead, campanha e template no Supabase
  2. Checar `isAllowedHour()` — se não, adiar job para às 8h
  3. Checar limite diário/horário — se atingido, adiar
  4. Chamar `checkNumber()` — se inválido, marcar `failed`
  5. Chamar `sendTyping()` com duração proporcional à mensagem
  6. Aguardar delay typing
  7. Chamar `spin(template)` para gerar mensagem final
  8. Chamar `sendText()` via UazAPI
  9. Persistir resultado em `dispatches`
  10. Emitir Socket.io `dispatch:update`
  11. Aguardar `getDelay()` antes de liberar próximo job
  12. A cada `shouldLongPause()` → aguardar `getLongPauseDelay()`

#### 2.5 Endpoints de campanha e disparo
- [ ] `POST /api/campaigns` → criar campanha
- [ ] `GET /api/campaigns` → listar campanhas
- [ ] `POST /api/campaigns/:id/start` → enfileirar todos os leads pendentes
- [ ] `POST /api/campaigns/:id/pause` → pausar fila
- [ ] `POST /api/campaigns/:id/resume` → retomar fila
- [ ] `POST /api/campaigns/:id/cancel` → cancelar e limpar fila

#### 2.6 CRUD de templates
- [ ] `POST /api/templates` → criar template
- [ ] `GET /api/templates` → listar
- [ ] `PUT /api/templates/:id` → editar
- [ ] `DELETE /api/templates/:id` → remover
- [ ] Endpoint extra: `POST /api/templates/:id/preview` → retorna 5 variações do spinner

#### 2.7 Tela de Templates no frontend
- [ ] Página `/templates` com listagem
- [ ] Modal de criar/editar com editor de texto
- [ ] Preview ao vivo: exibir 3 variações geradas pelo spinner (chamada à API)
- [ ] Indicador visual dos blocos `{|}` no texto (highlight)

---

## Fase 3 — Coleta de Leads via Apify
**Prazo estimado: Semana 5–6**

### Objetivo
Importação de leads via CSV/XLSX (modo manual) e coleta automática via Apify (modo automático), com wizard de criação de campanha unificado.

### Tarefas

#### 3.1 Upload manual de leads
- [ ] Instalar `multer`, `csv-parse`, `xlsx`
- [ ] Endpoint `POST /api/leads/upload` com upload de arquivo
- [ ] Parser que aceita CSV e XLSX
- [ ] Normalização de telefones BR:
  - Remover espaços, parênteses, traços, `+`
  - Adicionar `55` se não tiver DDI
  - Validar 12–13 dígitos (55 + DDD + número)
- [ ] Deduplicação por telefone dentro da campanha
- [ ] Retornar preview de 5 linhas + contagem total antes de confirmar
- [ ] Endpoint `POST /api/leads/confirm-upload` → persiste os leads no banco

#### 3.2 Integração Apify
- [ ] Instalar `apify-client`
- [ ] Criar `backend/src/services/apify.js` com:
  - `runActor(actorId, input)` → POST /v2/acts/{id}/runs
  - `waitForRun(runId)` → polling a cada 5s em GET /v2/actor-runs/{id} até `SUCCEEDED` ou `FAILED`
  - `getDatasetItems(datasetId)` → GET /v2/datasets/{id}/items
  - `searchLeads({ query, location, maxItems })` → orquestra os 3 métodos acima
- [ ] Mapeamento de campos Google Maps → schema leads:
  - `title` → `name`
  - `phone` → `phone` (normalizar)
  - `address` ou `city` → `city`
  - `website` → `extra.website`
  - `categoryName` → `extra.category`

#### 3.3 Endpoint de coleta automática
- [ ] `POST /api/leads/collect` → recebe `{ campaignId, actor, input }`, inicia run Apify, retorna `runId`
- [ ] `GET /api/leads/collect/:runId/status` → retorna status do run (polling pelo frontend)
- [ ] Quando run concluir: importar leads no banco + enfileirar disparos automaticamente se campanha em modo `auto`

#### 3.4 Wizard de criação de campanha (frontend)
- [ ] Página `/campaigns/new` com wizard em 3 passos:

**Passo 1 — Modo de leads:**
- Opção A: Upload manual (drag-and-drop CSV/XLSX)
- Opção B: Coleta automática (campos: busca, cidade, quantidade, actor)

**Passo 2 — Configuração de disparo:**
- Selecionar template (dropdown com preview)
- Quantidade de disparos (ou "todos")
- Delay mínimo / máximo (segundos)
- Limite diário
- Modo: manual (eu inicio) ou automático (inicia ao importar leads)

**Passo 3 — Revisão e lançamento:**
- Resumo da campanha
- Botão "Lançar campanha"

---

## Fase 4 — Dashboard, Métricas e Hardening
**Prazo estimado: Semana 7–8**

### Objetivo
Dashboard com atualizações ao vivo, controles em tempo real, retry de falhas, exportação e hardening final do anti-bloqueio.

### Tarefas

#### 4.1 Dashboard com métricas ao vivo
- [ ] Cards de métricas: Total enviados / Falhas / Em fila / Taxa de sucesso (%)
- [ ] Gráfico de linha: disparos por hora (últimas 24h)
- [ ] Tabela de leads com colunas: nome, telefone, status (pill colorido), campanha, timestamp, mensagem (expandível)
- [ ] Filtros: por campanha, por status, por período
- [ ] Socket.io `dispatch:update` → atualizar contadores e tabela em tempo real
- [ ] Socket.io `campaign:stats` → atualizar cards a cada 5 disparos

#### 4.2 Controles de campanha em tempo real
- [ ] Botões: Pausar / Retomar / Cancelar na página de campanha
- [ ] Progress bar com % de conclusão
- [ ] ETA calculado: `(pending * avgDelay) / 1000 / 60` → exibir em minutos
- [ ] Editar limites de disparo (delay, limite diário) com campanha rodando

#### 4.3 Retry automático de falhas
- [ ] Botão "Retentar selecionados" na tabela de dispatches com status `failed`
- [ ] Config por campanha: N tentativas automáticas com backoff exponencial
- [ ] Registrar tentativas em `dispatches.retry_count`
- [ ] Não retentar se motivo da falha for `invalid_number`

#### 4.4 Exportação de relatório
- [ ] Instalar `csv-writer`
- [ ] Endpoint `GET /api/campaigns/:id/export` → gera CSV e devolve como download
- [ ] Colunas: nome, telefone, status, mensagem enviada, timestamp, campanha
- [ ] Botão "Exportar CSV" na tela de campanha

#### 4.5 Hardening anti-bloqueio final
- [ ] Implementar `markAsRead` antes de enviar (simula que viu a resposta anterior)
- [ ] Detectar erro de rate-limit da UazAPI → pausar campanha automaticamente por 30 min
- [ ] Alerta no dashboard se conta tiver menos de 7 dias → exibir banner de aviso
- [ ] Forçar limites reduzidos em contas novas (independente do que foi configurado na campanha)
- [ ] Log de todas as chamadas UazAPI com timestamp (para debug de bloqueios)

---

## Checklist de Deploy (Referência futura)

- [ ] Redis em produção (Redis Cloud ou Railway)
- [ ] Backend em produção (Railway, Render ou VPS)
- [ ] Frontend em produção (Vercel ou Netlify)
- [ ] Variáveis de ambiente configuradas em cada plataforma
- [ ] Webhook UazAPI apontando para URL de produção do backend
- [ ] Supabase RLS habilitado para as tabelas do frontend

---

## Dependências por Pacote

### Backend (`backend/package.json`)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.39.0",
    "socket.io": "^4.6.1",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "multer": "^1.4.5",
    "csv-parse": "^5.5.3",
    "xlsx": "^0.18.5",
    "apify-client": "^2.9.4",
    "csv-writer": "^1.6.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@supabase/supabase-js": "^2.39.0",
    "socket.io-client": "^4.6.1",
    "qrcode.react": "^3.1.0",
    "recharts": "^2.10.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33"
  }
}
```
