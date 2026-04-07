-- ============================================================
-- WA PROSPECTOR — Schema Supabase
-- Aplicar no SQL Editor: https://jlzckqjggdzpzqiuvgcv.supabase.co
-- Executar TODO o conteúdo de uma vez
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type campaign_status as enum (
  'draft',
  'running',
  'paused',
  'completed',
  'cancelled'
);

create type dispatch_status as enum (
  'pending',
  'sent',
  'failed',
  'retrying'
);

create type lead_source as enum (
  'manual_upload',
  'apify'
);

create type wa_status as enum (
  'disconnected',
  'connecting',
  'connected'
);

create type campaign_mode as enum (
  'manual',
  'auto'
);

-- ============================================================
-- TABELA: wa_instances
-- Instâncias WhatsApp conectadas via UazAPI
-- ============================================================

create table wa_instances (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  instance_id text unique not null,   -- ID retornado pela UazAPI
  status      wa_status not null default 'disconnected',
  phone       text,                    -- Número conectado (preenchido após conectar)
  connected_at timestamptz,            -- Quando foi conectado pela primeira vez
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: templates
-- Templates de mensagem com suporte a spin {a|b|c}
-- ============================================================

create table templates (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  content     text not null,           -- Texto com sintaxe de spin: {opt1|opt2|opt3}
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: campaigns
-- Campanhas de prospecção
-- ============================================================

create table campaigns (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  status          campaign_status not null default 'draft',
  mode            campaign_mode not null default 'manual',

  -- Referências
  template_id     uuid references templates(id) on delete set null,
  wa_instance_id  uuid references wa_instances(id) on delete set null,

  -- Configurações de disparo (anti-bloqueio)
  delay_min       integer not null default 8,     -- segundos
  delay_max       integer not null default 20,    -- segundos
  daily_limit     integer not null default 50,    -- msgs por dia
  hourly_limit    integer not null default 30,    -- msgs por hora
  max_dispatches  integer,                         -- null = sem limite (dispara todos)

  -- Config Apify (modo auto)
  apify_actor     text,                            -- ex: apify/google-maps-scraper
  apify_input     jsonb,                           -- parâmetros do actor

  -- Métricas (desnormalizadas para performance)
  total_leads     integer not null default 0,
  sent_count      integer not null default 0,
  failed_count    integer not null default 0,
  pending_count   integer not null default 0,

  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABELA: leads
-- Contatos importados para prospecção
-- ============================================================

create table leads (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,

  name         text,
  phone        text not null,           -- Normalizado: 5511999999999
  city         text,
  source       lead_source not null default 'manual_upload',

  -- Dados extras vindos do Apify (website, category, etc.)
  extra        jsonb default '{}',

  -- Controle
  is_valid     boolean,                 -- null = não verificado, true/false após checkNumber
  created_at   timestamptz not null default now(),

  unique (campaign_id, phone)          -- Sem duplicatas dentro da mesma campanha
);

-- ============================================================
-- TABELA: dispatches
-- Log detalhado de cada tentativa de envio
-- ============================================================

create table dispatches (
  id            uuid primary key default uuid_generate_v4(),
  lead_id       uuid not null references leads(id) on delete cascade,
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  template_id   uuid references templates(id) on delete set null,

  status        dispatch_status not null default 'pending',
  message_sent  text,                   -- Versão final da mensagem após spin
  error_message text,                   -- Mensagem de erro se status = failed
  error_code    text,                   -- Código do erro (ex: invalid_number, rate_limit)

  retry_count   integer not null default 0,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

-- Dispatches por campanha (consultas frequentes no dashboard)
create index idx_dispatches_campaign_id  on dispatches(campaign_id);
create index idx_dispatches_status       on dispatches(status);
create index idx_dispatches_sent_at      on dispatches(sent_at desc);

-- Leads por campanha
create index idx_leads_campaign_id on leads(campaign_id);
create index idx_leads_phone       on leads(phone);

-- Campanhas por status
create index idx_campaigns_status on campaigns(status);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_campaigns_updated_at
  before update on campaigns
  for each row execute function update_updated_at();

create trigger trg_templates_updated_at
  before update on templates
  for each row execute function update_updated_at();

create trigger trg_wa_instances_updated_at
  before update on wa_instances
  for each row execute function update_updated_at();

create trigger trg_dispatches_updated_at
  before update on dispatches
  for each row execute function update_updated_at();

-- ============================================================
-- TRIGGER: atualizar métricas da campanha após insert/update em dispatches
-- ============================================================

create or replace function sync_campaign_metrics()
returns trigger as $$
begin
  update campaigns set
    sent_count    = (select count(*) from dispatches where campaign_id = coalesce(new.campaign_id, old.campaign_id) and status = 'sent'),
    failed_count  = (select count(*) from dispatches where campaign_id = coalesce(new.campaign_id, old.campaign_id) and status = 'failed'),
    pending_count = (select count(*) from dispatches where campaign_id = coalesce(new.campaign_id, old.campaign_id) and status = 'pending'),
    updated_at    = now()
  where id = coalesce(new.campaign_id, old.campaign_id);
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_sync_campaign_metrics
  after insert or update or delete on dispatches
  for each row execute function sync_campaign_metrics();

-- ============================================================
-- TRIGGER: atualizar total_leads ao inserir lead
-- ============================================================

create or replace function sync_campaign_lead_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update campaigns set total_leads = total_leads + 1 where id = new.campaign_id;
  elsif TG_OP = 'DELETE' then
    update campaigns set total_leads = greatest(total_leads - 1, 0) where id = old.campaign_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_sync_campaign_lead_count
  after insert or delete on leads
  for each row execute function sync_campaign_lead_count();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Habilitar RLS nas tabelas acessadas pelo frontend (anon key)
-- O backend usa service_role e bypassa o RLS
-- ============================================================

alter table campaigns    enable row level security;
alter table templates    enable row level security;
alter table leads        enable row level security;
alter table dispatches   enable row level security;
alter table wa_instances enable row level security;

-- Policies: acesso total para usuários autenticados
-- (Ajustar conforme necessário se adicionar autenticação de usuários)

create policy "Allow all for authenticated" on campaigns
  for all using (true);

create policy "Allow all for authenticated" on templates
  for all using (true);

create policy "Allow all for authenticated" on leads
  for all using (true);

create policy "Allow all for authenticated" on dispatches
  for all using (true);

create policy "Allow all for authenticated" on wa_instances
  for all using (true);

-- ============================================================
-- REALTIME: habilitar publicação em tempo real
-- ============================================================

begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table dispatches, campaigns, wa_instances;
commit;

-- ============================================================
-- DADOS DE EXEMPLO (opcional — remover em produção)
-- ============================================================

-- Template de exemplo para clínicas
insert into templates (name, content, description) values (
  'Prospecção Clínicas v1',
  'Olá {Dr.|Dra.|}, tudo bem? Vi que {sua clínica|seu consultório|seu espaço} aparece no Google Maps.

Trabalho com {automação de agendamentos|gestão de agenda automatizada|agendamento inteligente} para clínicas de {estética|odontologia|saúde} e queria entender se faz sentido para você.

Posso te mostrar como funciona em {5 minutos|uma conversa rápida|menos de 10 minutos}?',
  'Template para prospecção fria de clínicas'
);

-- ============================================================
-- VERIFICAÇÃO FINAL
-- Execute para confirmar que tudo foi criado corretamente:
-- ============================================================

-- select table_name from information_schema.tables where table_schema = 'public' order by table_name;
-- Deve retornar: campaigns, dispatches, leads, templates, wa_instances
