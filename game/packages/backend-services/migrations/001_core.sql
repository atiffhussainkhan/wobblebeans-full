-- Workstream 9. Parent contact is ciphertext only. The column names do not
-- hold a readable contact or a birth date. Show servers do not use this database role's key.
-- schema_migrations is created by the migration runner before this file runs.

CREATE TABLE player (
  player_id text PRIMARY KEY,
  platform text NOT NULL,
  link_hash text NOT NULL UNIQUE,
  mmr_mu double precision NOT NULL DEFAULT 25,
  mmr_sigma double precision NOT NULL DEFAULT 8.333,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_link (
  link_hash text PRIMARY KEY,
  platform text NOT NULL,
  player_id text NOT NULL REFERENCES player (player_id) ON DELETE CASCADE
);

CREATE TABLE profile (
  player_id text PRIMARY KEY REFERENCES player (player_id) ON DELETE CASCADE,
  generated_name_id integer NOT NULL,
  locale text NOT NULL,
  upper_id text NOT NULL,
  lower_id text NOT NULL,
  colour_id text NOT NULL,
  pattern_id text NOT NULL,
  face_id text NOT NULL,
  loadout jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE ledger_entry (
  id text PRIMARY KEY,
  player_id text NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  source_ref text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE progression (
  player_id text NOT NULL,
  season_id text NOT NULL,
  xp integer NOT NULL,
  lifetime_xp integer NOT NULL,
  level integer NOT NULL,
  path_tier integer NOT NULL,
  trophies integer NOT NULL,
  challenge_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (player_id, season_id)
);

CREATE TABLE friendship (
  player_a text NOT NULL,
  player_b text NOT NULL,
  since timestamptz NOT NULL,
  PRIMARY KEY (player_a, player_b)
);

CREATE TABLE block_edge (
  player_id text NOT NULL,
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, subject_id)
);

CREATE TABLE mute_edge (
  player_id text NOT NULL,
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, subject_id)
);

CREATE TABLE entitlement (
  player_id text NOT NULL,
  item_id text NOT NULL,
  source text NOT NULL,
  granted_at timestamptz NOT NULL,
  revoked_at timestamptz,
  used_at timestamptz,
  PRIMARY KEY (player_id, item_id)
);

CREATE TABLE show_pin (
  show_id text PRIMARY KEY,
  config_version text NOT NULL,
  region text,
  physics_hash integer NOT NULL,
  server_build text NOT NULL,
  pinned_at timestamptz NOT NULL,
  levels jsonb NOT NULL
);

CREATE TABLE config_bundle (
  version text PRIMARY KEY,
  bundle jsonb NOT NULL,
  signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE config_activation (
  id bigserial PRIMARY KEY,
  version text NOT NULL,
  actor_id text NOT NULL,
  mode text NOT NULL,
  canary_percent integer NOT NULL DEFAULT 0,
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id text PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  at timestamptz NOT NULL,
  detail jsonb NOT NULL
);

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit log is append-only';
END;
$$;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TABLE telemetry_salt (
  player_id text PRIMARY KEY,
  salt bytea NOT NULL
);

CREATE TABLE parent_blob (
  kind text NOT NULL,
  record_id text NOT NULL,
  cipher bytea NOT NULL,
  retain_until timestamptz,
  PRIMARY KEY (kind, record_id)
);

CREATE TABLE applied_match (
  idempotency_key text PRIMARY KEY,
  show_id text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
