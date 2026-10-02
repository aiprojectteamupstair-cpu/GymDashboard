CREATE SCHEMA IF NOT EXISTS gym_local;
CREATE TABLE IF NOT EXISTS gym_local.schema_version (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS gym_local.accounts (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email=lower(email)),
  display_name text NOT NULL,
  role_code text NOT NULL CHECK (role_code IN ('super_admin','admin')),
  salt text NOT NULL,
  password_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_super_admin ON gym_local.accounts(role_code) WHERE role_code='super_admin';
CREATE TABLE IF NOT EXISTS gym_local.sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES gym_local.accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS gym_local.command_results (
  request_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gym_local.account_audit (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  account jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
