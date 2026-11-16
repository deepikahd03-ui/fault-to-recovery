# Deploy Guide — get a permanent public link

This guide turns the app into a stable public URL like
`https://fault-to-recovery.onrender.com` that anyone can open — no tunnel to
babysit, survives your machine being off.

> Why not just a tunnel? A tunnel (ngrok / localtunnel / cloudflared) only works
> while **your** machine is running it. A deploy runs the app on a real host, so
> the link is always live.

The frontend already calls the API **same-origin** (`/api`), so once Flask serves
both the page and the API from one host, everything (login, scenarios, restoration,
event history) works for visitors with no extra config.

---

## Prerequisites

The whole `/home/z/my-project` folder is the repo. Push it to GitHub:

```bash
cd /home/z/my-project
git add -A
git commit -m "Add deploy config"
git remote add origin https://github.com/<you>/fault-to-recovery.git
git push -u origin main
```

You need the repo to contain at least:
- `download/fault-to-recovery.html`  (the frontend, served by Flask)
- `download/backend/app.py`
- `download/backend/db.py`
- `download/backend/engine.py`
- `download/backend/requirements.txt`

---

## Option A — Render (recommended, free, ~3 minutes)

1. Go to <https://render.com>, sign up with GitHub.
2. **New → Web Service → connect your GitHub repo.**
3. Fill in:
   | Field | Value |
   |---|---|
   | Name | `fault-to-recovery` |
   | Runtime | **Python 3** |
   | Root Directory | `download/backend` |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `gunicorn app:app` |
   | Instance Type | **Free** |
4. Click **Create Web Service**. Render installs deps and starts gunicorn.
5. Watch the logs — when you see `Booting worker`, your link is live:
   `https://fault-to-recovery.onrender.com`
6. Open it → login `admin@bescom.sim` / `demo123`.

**Free-tier notes:**
- The service sleeps after ~15 min of no traffic; the first request after sleep
  takes ~50 s to wake (show a loader). It does **not** lose data — the DB
  auto-seeds the demo topology on every boot.
- SQLite on Render is ephemeral across deploys (fine for this demo: it always
  re-seeds on boot). If you later want persistent edits across deploys, attach a
  Render Disk (paid) and point `grid.db` at `/data`.

### Optional: one-click Blueprint

Copy `render.yaml` (in this folder) to the **repo root**, then in Render:
**New → Blueprint → select your repo**. Render reads `render.yaml` and creates the
service for you.

---

## Option B — Railway (free trial)

1. Go to <https://railway.app>, sign up with GitHub.
2. **New Project → Deploy from GitHub repo.**
3. Railway auto-detects Python. Set **Custom Start Command**:
   ```
   cd download/backend && gunicorn app:app --bind 0.0.0.0:$PORT
   ```
   (Railway runs from the repo root, so the `cd` is required.)
4. Or copy the `Procfile` (in this folder) to the **repo root** — Railway detects
   it and runs the same command automatically.
5. Railway gives a `https://<your-app>.up.railway.app` link under **Settings → Networking → Generate Domain**.

---

## Option C — temporary link from your own machine (no account)

If you just want to share for an hour and don't want to deploy:

```bash
cd /home/z/my-project/download/backend
pip install -r requirements.txt
python app.py                       # terminal 1 — serves on :5000
npx localtunnel --port 5000         # terminal 2 — prints https://<random>.loca.lt
```

The link dies the moment you stop either process.

---

## Verify it works (after deploy)

Open the public URL. Expected:
- Page loads: "Fault to Recovery — BESCOM Smart Distribution Network Monitoring".
- Login with `admin@bescom.sim` / `demo123` → dashboard shows live telemetry.
- Run Scenario S1 → restoration path highlights, events log updates.

If the page loads but data doesn't: you opened a file path instead of the URL, or
the host isn't serving via Flask. The app **must** be visited at its public URL
(not the raw `.html` file) so the frontend calls the same-origin `/api`.

---

## Files in this folder

| File | Purpose |
|---|---|
| `render.yaml` | Render Blueprint (copy to repo root for one-click deploy) |
| `Procfile` | Railway/Heroku start command (copy to repo root) |
