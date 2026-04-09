-- ============================================================
-- WA PROSPECTOR — Schema Supabase (versão atual)
-- Aplicar no SQL Editor: https://jlzckqjggdzpzqiuvgcv.supabase.co
-- ATENÇÃO: dropa e recria tudo — rode apenas em banco limpo
-- ============================================================

-- ============================================================
-- LIMPEZA (ordem importa por FK)
-- ============================================================

drop table if exists dispatches cascade;
drop table if exists campaigns  cascade;
drop table if exists contacts   cascade;
drop table if exists templates  cascade;
drop table if exists wa_instances cascade;

drop function if exists increment_campaign_sent(uuid);
drop function if exists increment_campaign_failed(uuid);

-- ============================================================
-- TABELA: wa_instances
-- Instâncias WhatsApp conectadas via UazAPI
-- ============================================================

create table wa_instances (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  instance_id  text unique not null,
  status       text not null default 'disconnected', -- disconnected | connecting | connected
  phone        text,
  connected_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- TABELA: templates
-- Templates de mensagem com suporte a spin {a|b|c}
-- ============================================================

create table templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  content     text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: campaigns
-- Campanhas de prospecção
-- ============================================================

create table campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  status       text not null default 'draft', -- draft | running | paused | completed | cancelled
  template_id  uuid references templates(id) on delete set null,
  instance_id  text not null,                  -- instance_id da wa_instances (token)
  interval_min integer not null default 8,     -- minutos
  interval_max integer not null default 20,    -- minutos
  total_leads  integer not null default 0,
  sent_count   integer not null default 0,
  failed_count integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- TABELA: contacts
-- Contatos importados (Apify) ou adicionados manualmente
-- niche = 'manual' para números adicionados na mão
-- ============================================================

create table contacts (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  name         text,
  niche        text not null,
  sent_count   integer not null default 0,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),

  unique (phone, niche)
);

-- ============================================================
-- TABELA: dispatches
-- Um registro por número por campanha — rastreia cada envio
-- ============================================================

create table dispatches (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  phone         text not null,        -- número normalizado: 5511999999999
  status        text not null default 'pending', -- pending | sent | failed | cancelled
  message_sent  text,                 -- mensagem gerada pelo spin (preenchida no shuffle ou no envio)
  typing_delay  integer,              -- delay de digitação em ms
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);

create index dispatches_campaign_status on dispatches(campaign_id, status);

-- ============================================================
-- FUNÇÕES RPC
-- Incremento atômico dos contadores da campanha
-- ============================================================

create or replace function increment_campaign_sent(p_campaign_id uuid)
returns void language sql as $$
  update campaigns
  set sent_count = sent_count + 1
  where id = p_campaign_id;
$$;

create or replace function increment_campaign_failed(p_campaign_id uuid)
returns void language sql as $$
  update campaigns
  set failed_count = failed_count + 1
  where id = p_campaign_id;
$$;

-- ============================================================
-- RLS (desabilitado — acesso via service_role no backend)
-- ============================================================

alter table wa_instances disable row level security;
alter table templates    disable row level security;
alter table campaigns    disable row level security;
alter table contacts     disable row level security;
alter table dispatches   disable row level security;
