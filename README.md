# Nexus Dating App v4

**Date Mutuals, Not Strangers.** — Tinder-style discovery, Supabase-powered.

## Quick Start

```bash
node server.js
```

Then open http://localhost:3000

## Supabase Setup (for real user data)

1. Create a project at https://supabase.com
2. Run `supabase-schema.sql` in your Supabase SQL editor
3. Set environment variables:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_KEY=your-service-role-key  # optional, for admin ops

node server.js
```

Without Supabase, the app runs fully on in-memory storage (demo mode with seed users).

## What's New in v4

- **Tinder-style swipe cards** — drag, fling, or tap buttons to like/pass/super-like
- **Supabase integration** — real user profiles, likes, matches, messages persisted in Postgres
- **"What are you looking for"** — replaced prompts with intent selector (serious / casual / open / friends first)
- **Match celebration overlay** — animated match reveal with messaging CTA
- **Removed**: API docs section, daily match notification setting, pause profile feature
- **Responsive** — works on mobile, tablet, desktop

## Admin Dashboard

Visit http://localhost:3000 → Login → Admin button
Password: `nexus_admin_2025` (change with `ADMIN_PASS` env var)

## Features

- Phone OTP auth + Facebook/Instagram social login
- Real photo upload (6 photos, base64, client-side resize)
- Tinder-style swipe with drag physics + like/pass/super-like buttons
- Filter discover queue (All / Nearby / Online / New)
- Real-time mutual connections display
- Full messaging system
- Match celebration animation
- Dark/light theme
- Fully responsive (mobile-first)
- Admin dashboard with user management
