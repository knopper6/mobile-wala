DROP TABLE IF EXISTS auction_events;
DROP TABLE IF EXISTS bids;
DROP TABLE IF EXISTS lot_variants;
DROP TABLE IF EXISTS lots;
DROP TABLE IF EXISTS reseller_profiles;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS lot_status;
DROP TYPE IF EXISTS auction_event_type;

CREATE TYPE user_role AS ENUM ('admin', 'reseller');
CREATE TYPE user_status AS ENUM ('active', 'pending', 'suspended');
CREATE TYPE lot_status AS ENUM ('draft', 'scheduled', 'active', 'closed', 'sold', 'cancelled');
CREATE TYPE auction_event_type AS ENUM ('created', 'updated', 'started', 'closed', 'cancelled', 'bid_placed');

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'reseller',
  status user_status NOT NULL DEFAULT 'active',
  display_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reseller_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gst_or_tax_id TEXT,
  business_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'USA',
  postal_code TEXT,
  preferred_brands TEXT[] NOT NULL DEFAULT '{}',
  monthly_volume_estimate INTEGER,
  approved_at TIMESTAMPTZ
);

CREATE TABLE lots (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  series TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  status lot_status NOT NULL DEFAULT 'draft',
  description TEXT,
  starting_bid NUMERIC(12,2) NOT NULL CHECK (starting_bid > 0),
  bid_increment NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (bid_increment > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE lot_variants (
  id BIGSERIAL PRIMARY KEY,
  lot_id BIGINT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  storage_capacity TEXT NOT NULL,
  color_name TEXT NOT NULL,
  color_indicator TEXT NOT NULL DEFAULT '⚪',
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  starting_bid NUMERIC(12,2) NOT NULL CHECK (starting_bid > 0),
  bid_increment NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (bid_increment > 0),
  grade_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bids (
  id BIGSERIAL PRIMARY KEY,
  lot_id BIGINT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL REFERENCES lot_variants(id) ON DELETE CASCADE,
  reseller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auction_events (
  id BIGSERIAL PRIMARY KEY,
  lot_id BIGINT REFERENCES lots(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type auction_event_type NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_lots_status_dates ON lots(status, starts_at, ends_at);
CREATE INDEX idx_variants_lot ON lot_variants(lot_id);
CREATE INDEX idx_bids_lot_amount ON bids(lot_id, amount DESC, created_at ASC);
CREATE INDEX idx_bids_variant_amount ON bids(variant_id, amount DESC, created_at ASC);
CREATE INDEX idx_bids_reseller ON bids(reseller_id, created_at DESC);
CREATE INDEX idx_events_lot ON auction_events(lot_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_lots_updated_at
BEFORE UPDATE ON lots
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
