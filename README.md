# HireVue Practice Games

A React + Vite app for practising the cognitive assessment games used in HireVue interviews — Numerosity, Digit Span, Puzzle, Flashback, and Shape Dance. Sign in to save scores, track progress over time, and view your performance profile.

## Games

| Game | What it tests |
|---|---|
| **Numerosity** | Find two numbers that combine (using a shown operator) to hit a target — 90-second sprint |
| **Digit Span** | Recall digit sequences in order; span adapts to your performance |
| **Puzzle** | Identify the missing piece in a 3×3 visual pattern matrix |
| **Flashback** | N-back task — decide whether the current shape matches the one N steps earlier |
| **Shape Dance** | Go/no-go reaction task — tap only when you see the target shape |

---

## Local development

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (optional — the app works without one, scores just won't persist)

### 1. Clone and install

```bash
git clone https://github.com/mmulenga/hv-prac.git
cd hv-prac
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Leave these blank or omit the file entirely to run without auth/persistence — all five games still work.

### 3. Set up the database (first time only)

In the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql), run the contents of [`supabase/schema.sql`](./supabase/schema.sql). This creates the `game_scores` and `profiles` tables, indexes, Row Level Security policies, and a trigger that auto-creates a profile row on signup.

### 4. Enable OAuth providers (optional)

In the Supabase dashboard → **Authentication → Providers**:

- **Google** — create OAuth credentials in Google Cloud Console, paste the Client ID and Secret into Supabase.
- **Apple** — requires an [Apple Developer account](https://developer.apple.com) ($99/yr). Create a Services ID and a Sign In with Apple key, then configure them in Supabase. Apple review typically takes 1–2 business days.

### 5. Run the dev server

```bash
npm run dev
```

App is available at `http://localhost:5173/`.

---

## Deployment

### Digital Ocean App Platform (recommended)

1. Push your branch to GitHub.
2. In the [DO App Platform console](https://cloud.digitalocean.com/apps), click **Create App → GitHub** and select this repo.
3. Set the build settings:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Add environment variables under **Settings → App-level env vars**:
   ```
   VITE_SUPABASE_URL       = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY  = your-anon-key-here
   ```
5. Click **Deploy**. Every subsequent push to `main` redeploys automatically.

Static sites are **free** on DO App Platform. No server is needed — the Supabase client runs entirely in the browser.

### GitHub Pages (alternative)

The repo already ships a deploy workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) that builds and pushes to GitHub Pages on every push to the feature branch.

1. In the repo → **Settings → Pages → Source**, select **GitHub Actions**.
2. Push to the branch — the workflow builds and deploys automatically.
3. Live at `https://mmulenga.github.io/hv-prac/`.

> The Vite base path is already set to `/hv-prac/` in `vite.config.js`.

---

## CI

GitHub Actions runs on every pull request and push to `main`:

```
lint  →  build
```

Workflow file: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).  
The build step uses placeholder Supabase env vars so it succeeds without real credentials.

---

## Project structure

```
src/
├── games/          # Game components (Numerosity, DigitSpan, Puzzle, Flashback, ShapeDance)
├── screens/        # Full-page screens (Profile)
├── components/     # Shared UI (GameCard, GameHeader, AuthModal)
├── context/        # AuthContext — Supabase session state
├── hooks/          # useScores — save/fetch scores, getMetric, normalise
├── lib/            # supabase.js — client initialisation
└── App.jsx         # Navigation state machine + home screen

supabase/
└── schema.sql      # One-time DB setup script
```

---

## Tech stack

- **React 19 + Vite 8** — frontend framework and build tool
- **Tailwind CSS 3** — utility-first styling
- **Supabase** — Postgres database, Row Level Security, Auth (email, Google, Apple)
- **Recharts** — score trend and radar charts on the profile page
- **@vitejs/plugin-legacy** — transpiles for Safari 12+ / iOS 12+
- **Stripe** *(planned)* — subscription billing

---

## Revenue model

The app is designed for a freemium model:

| Tier | Features |
|---|---|
| Guest | Play all 5 games, no score saving |
| Free account | Games + full score history + profile stats + one unobtrusive ad |
| Premium (~$4/mo) | Ad-free + extended analytics |

Ads: [Carbon Ads](https://www.carbonads.net) (single slot, below the game grid, never inside a game).  
Subscriptions: Stripe Checkout + a Supabase Edge Function webhook to flip `profiles.is_premium`.
