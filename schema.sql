-- Food Journal Schema (with Google Auth)
-- Run this in Railway → Postgres service → Query tab

-- ── Sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,          -- random 64-char hex token
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- ── Users ────────────────────────────────────────────────────────────────────
-- Created automatically the first time someone signs in with Google.
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  google_id  TEXT NOT NULL UNIQUE,   -- Google's stable user identifier
  email      TEXT NOT NULL,
  name       TEXT,
  avatar_url TEXT,
  admin_yn   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Foods ─────────────────────────────────────────────────────────────────────
-- Each user has their own food list (same name, different users = different rows)
CREATE TABLE IF NOT EXISTS foods (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT    NOT NULL,
  UNIQUE (user_id, name)   -- "Cheeseburger" is unique per user, not globally
);

-- ── Symptoms ──────────────────────────────────────────────────────────────────
-- Global list — shared across all users (no user_id).
-- Custom symptoms added by a user are also stored here and visible globally.
-- (Keeps the symptom list clean and prevents per-user fragmentation.)
CREATE TABLE IF NOT EXISTS symptoms (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ── Meals ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eaten_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating     SMALLINT CHECK (rating BETWEEN 1 AND 5),  -- NULL = not yet rated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Junction tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_foods (
  meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  PRIMARY KEY (meal_id, food_id)
);

CREATE TABLE IF NOT EXISTS meal_symptoms (
  meal_id    INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  symptom_id INTEGER NOT NULL REFERENCES symptoms(id) ON DELETE CASCADE,
  PRIMARY KEY (meal_id, symptom_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meals_user    ON meals (user_id, eaten_at DESC);
CREATE INDEX IF NOT EXISTS idx_foods_user    ON foods (user_id);

-- ── Suggestions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suggestions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions (created_at DESC);

-- Seed default symptoms
INSERT INTO symptoms (name) VALUES
  ('Bloating'), ('Headache'), ('Tired'), ('Swelling'), ('Nausea'),
  ('Cramps'), ('Brain fog'), ('Heartburn'), ('Skin rash'), ('Congestion'),
  ('Joint pain'), ('Gas'), ('Diarrhea'), ('Constipation'), ('Anxiety'),
  ('Heart palpitations')
ON CONFLICT (name) DO NOTHING;
