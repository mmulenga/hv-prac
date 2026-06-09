-- Run this in the Supabase SQL editor to set up the schema.
-- Supabase Auth manages auth.users automatically.

-- ── Game scores ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_scores (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id     TEXT        NOT NULL,
  score_data  JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_scores_user_game
  ON game_scores(user_id, game_id);

CREATE INDEX IF NOT EXISTS idx_game_scores_user_created
  ON game_scores(user_id, created_at DESC);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own scores"
  ON game_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own scores"
  ON game_scores FOR SELECT
  USING (auth.uid() = user_id);

-- ── Profiles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT,
  is_premium          BOOLEAN DEFAULT FALSE,
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own profile"
  ON profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-create a profile row on new signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
