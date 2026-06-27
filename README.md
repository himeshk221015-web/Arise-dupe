# Arise — Level Up

A free, gamified workout + diet app. Generates a personalized weekly training plan
and nutrition targets using Claude, then turns your workouts into daily quests with
XP, levels, ranks, streaks, and stats.

## 1. Get an API key

Go to https://console.anthropic.com, create a key, and copy it.

## 2. Run it locally (optional, to test first)

```bash
npm install
```

Create a file called `.env` (copy `.env.example`) and paste your key in:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then run:

```bash
npm run dev
```

This starts the frontend at `http://localhost:5173`. Note: the local Vite dev
server does not run the `/api` function by itself — for full local testing with
the API route, install the Vercel CLI (`npm i -g vercel`) and run `vercel dev`
instead of `npm run dev`.

## 3. Deploy for real (free)

**Recommended: Vercel**

1. Create a free account at https://vercel.com
2. Push this folder to a GitHub repository
3. In Vercel, click "Add New Project" and import that repository
4. Vercel auto-detects Vite — leave the build settings as default
5. Before deploying, go to Project Settings → Environment Variables and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from step 1
6. Click Deploy. You'll get a live URL like `https://arise-yourname.vercel.app`

That URL works on any phone — open it in the browser and use "Add to Home Screen"
(Safari: Share → Add to Home Screen. Chrome/Android: ⋮ menu → Add to Home Screen)
to get an app icon that opens full-screen, no App Store needed.

**Alternative: Netlify**

Same idea — connect the GitHub repo at https://netlify.com, set the
`ANTHROPIC_API_KEY` environment variable in Site Settings, and Netlify Functions
will pick up the `api/` folder automatically (you may need to rename it to
`netlify/functions` per their docs — Vercel needs no renaming).

## How data is stored

Progress (level, XP, streak, plan, stats) is saved in the browser's
`localStorage`. It's free, requires no database, and stays on that device.
It will reset if the user clears site data or switches browsers/devices.

## Notes

- If the AI call ever fails (rate limit, no key set, network issue), the app
  falls back to a built-in rule-based plan so it never breaks for the user.
- The `ANTHROPIC_API_KEY` is read only on the server (`api/generate-plan.js`)
  and is never sent to or visible in the browser.
