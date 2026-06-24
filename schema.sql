-- ============================================================
-- listyourcar.ca — revised schema (v2, two-sided marketplace)
-- Postgres-flavoured. Phase 1 uses: users, listings, inquiries.
-- Phase 2 adds: rental_bookings, rental_availability, reviews.
-- The front-end prototype mirrors this shape in localStorage.
-- ============================================================

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  phone         text,
  role          text not null default 'owner',   -- owner | renter | both
  created_at    timestamptz not null default now()
);

-- Single listing, dual intent (sale | rental | both)
create table listings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  vin              text,
  decoded_vehicle  jsonb,                         -- VIN-decode output
  intent           text not null default 'sale',  -- sale | rental | both   << NEW
  seller_fields    jsonb,                         -- shared: make, model, year, mileage, city, condition, photos, description
  sale_fields      jsonb,                         -- price, financing flags        << renamed
  rental_fields    jsonb,                         -- daily/weekly/monthly rate, deposit, min_age, requirements  << NEW
  photos           text[],
  status           text not null default 'draft', -- draft | live | sold | rented | inactive
  tier             text not null default 'free',  -- free | pro
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on listings (intent);
create index on listings (status);
create index on listings (user_id);

-- Unified inbox: every lead from every channel, sale or rental
create table inquiries (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  from_user_id  uuid references users(id),        -- null if anonymous/off-platform
  channel       text not null,                    -- listyourcar.ca | kijiji | facebook | craigslist | autotrader | cargurus
  kind          text not null,                    -- buyer | renter
  name          text,
  email         text,
  message       text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index on inquiries (listing_id);

-- ---------- Phase 2: rental marketplace activation ----------

create table rental_availability (                -- << NEW
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  date        date not null,
  status      text not null default 'available',  -- available | blocked | booked
  unique (listing_id, date)
);

create table rental_bookings (                    -- << NEW
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references listings(id) on delete cascade,
  renter_user_id  uuid references users(id),
  start_date      date not null,
  end_date        date not null,
  daily_rate      numeric(10,2) not null,
  total_amount    numeric(10,2) not null,
  platform_fee    numeric(10,2),                  -- 8–12% of total
  deposit         numeric(10,2),
  status          text not null default 'requested', -- requested | confirmed | active | completed | cancelled
  agreement_url   text,
  created_at      timestamptz not null default now()
);
create index on rental_bookings (listing_id);

create table reviews (                            -- << NEW (bidirectional)
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references rental_bookings(id) on delete cascade,
  reviewer_user_id  uuid not null references users(id),
  reviewee_user_id  uuid not null references users(id),
  role              text not null,                -- owner | renter
  rating            int not null check (rating between 1 and 5),
  body              text,
  created_at        timestamptz not null default now()
);
