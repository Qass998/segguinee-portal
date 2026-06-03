-- ===========================================================================
-- SEGGUINÉE WhatsApp Portal — Supabase Schema
-- ===========================================================================
-- 1. Open your Supabase project → SQL Editor
-- 2. Paste this entire file
-- 3. Press Run — tables and policies are created automatically
-- ===========================================================================

-- ── Enable UUID generation ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Conversations table ─────────────────────────────────────────────────
-- One row per unique WhatsApp conversation (customer phone number)
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           TEXT NOT NULL,                          -- e.g. "224620000001"
  profile_name    TEXT DEFAULT '',                        -- WhatsApp display name
  last_message    TEXT DEFAULT '',                        -- most recent message preview
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count    INT DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  is_director     BOOLEAN DEFAULT FALSE,                  -- TRUE = director's phone
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages table ──────────────────────────────────────────────────────
-- Every inbound and outbound message
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body            TEXT NOT NULL,                          -- message content
  action          TEXT DEFAULT '',                        -- e.g. "billing_reminder", "briefing", "customer_reply"
  meta_message_id TEXT DEFAULT '',                        -- WhatsApp message ID for dedup
  ai_generated    BOOLEAN DEFAULT FALSE,                  -- TRUE = AI replied
  read            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Briefing log ────────────────────────────────────────────────────────
-- Daily 7am briefing audit trail
CREATE TABLE IF NOT EXISTS briefings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  briefing_text   TEXT NOT NULL,
  overdue_count   INT DEFAULT 0,
  overdue_total   DECIMAL DEFAULT 0,
  production_m3   TEXT DEFAULT '',
  active_incidents INT DEFAULT 0,
  sent            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Staff — field agents and office personnel ─────────────────────────────
-- AI auto-discovers staff: first time someone texts structured data, the AI
-- asks their name/role/zone and stores it here. No manual phone list needed.
CREATE TABLE IF NOT EXISTS staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           TEXT NOT NULL UNIQUE,                  -- e.g. "224620000001"
  name            TEXT DEFAULT '',
  role            TEXT DEFAULT 'agent' CHECK (role IN ('agent', 'superviseur', 'technicien', 'directeur', 'comptable')),
  zone            TEXT DEFAULT '',                       -- e.g. "Kaloum", "Dixinn"
  active          BOOLEAN DEFAULT TRUE,
  first_seen      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Production — daily water output per station ───────────────────────────
-- Staff texts "prod 1250 Kaloum" → AI parses and stores here
CREATE TABLE IF NOT EXISTS production (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  volume_m3       DECIMAL NOT NULL,
  station         TEXT DEFAULT '',                       -- e.g. "Kaloum", "Dixinn"
  zone            TEXT DEFAULT '',
  recorded_by     TEXT DEFAULT '',                       -- staff phone
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoices — customer billing records ───────────────────────────────────
-- Staff texts "facture 628123456 500000" → AI creates invoice
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_phone  TEXT DEFAULT '',                       -- customer WhatsApp number
  customer_name   TEXT DEFAULT '',
  amount_gnf      DECIMAL DEFAULT 0,
  reference       TEXT DEFAULT '',                       -- invoice number
  due_date        DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  recorded_by     TEXT DEFAULT '',                       -- staff phone who logged it
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Incidents — infrastructure issues ─────────────────────────────────────
-- Staff texts "incident rupture canal Dixinn" → AI creates incident
CREATE TABLE IF NOT EXISTS incidents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT DEFAULT '' CHECK (type IN ('', 'rupture', 'panne', 'contamination', 'fuite', 'autre')),
  description     TEXT DEFAULT '',
  zone            TEXT DEFAULT '',
  station         TEXT DEFAULT '',
  status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  reported_by     TEXT DEFAULT '',                       -- staff phone
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Billing reminder log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_reminders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  triggered_by    TEXT NOT NULL,                          -- director phone
  triggered_at    TIMESTAMPTZ DEFAULT NOW(),
  total_invoices  INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  skipped_count   INT DEFAULT 0,
  error_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone);
CREATE INDEX IF NOT EXISTS idx_production_date ON production(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_production_station ON production(station);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_phone);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_zone ON incidents(zone);

-- ── Updated_at trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ──────────────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE production ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read
CREATE POLICY "Allow authenticated read on conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert on conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on messages"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert on messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read on briefings"
  ON briefings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert on briefings"
  ON briefings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read on billing_reminders"
  ON billing_reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert on billing_reminders"
  ON billing_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow auth read on staff" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert on staff" ON staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth read on production" ON production FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert on production" ON production FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth read on invoices" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert on invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update on invoices" ON invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow auth read on incidents" ON incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow auth insert on incidents" ON incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow auth update on incidents" ON incidents FOR UPDATE TO authenticated USING (true);
