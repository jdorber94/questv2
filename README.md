# Griffin Budget App

A modern personal finance cockpit built with React, Vite, Supabase, and Groq. The interface combines budgeting, cash flow tracking, bank statement imports, AI advice, and now deeper financial modeling tools.

## Running the app locally

1. Install dependencies: `npm install`
2. Configure environment variables. At minimum set:
   - Supabase keys via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Groq key in `.env.local` as `GROQ_API_KEY`
3. Start both the UI and advisor backend:
   - UI: `npm run dev`
   - AI advisor server (securely hosts the Groq key): `npm run dev:advisor`
4. Visit `http://localhost:5173`. The AI Advisor tab proxied through Vite will automatically talk to the backend running on port `8788`.

## Deploying to Vercel (and fixing the 404 on /api/advisor)

The repo root contains multiple folders; the app lives in `budget-app/`. Make sure Vercel builds from that folder so the `api/` routes deploy.

1) In Vercel → Project Settings → Build & Development, set **Root Directory** to `budget-app`.
2) Build Command: `npm run build`
3) Output Directory: `dist`
4) Install Command: leave blank (defaults to `npm install` inside `budget-app`).
5) Environment variable: set `GROQ_API_KEY` to your real key.
6) Optional: remove `VITE_ADVISOR_API_URL` so the frontend uses the same origin, or set it to `https://griffin-fawn.vercel.app/api/advisor`.
7) Redeploy. Check `https://griffin-fawn.vercel.app/api/advisor/health` — it should return `{"status":"ok"}` instead of 404.

## Financial modeling workspace

Open the **Modeling** tab in the sidebar to run “what if” experiments powered by the new `mathjs` dependency:

- **Historical cash-flow view**: Uses the last six months of categorized transactions to chart income vs. expenses, compute average burn, and estimate your current savings rate.
- **Runway calculator**: Enter your liquid cash to see how many months of runway you have, using real burn-rate data.
- **Goal & growth modeling**: Plug in starting savings, contributions, target amount, and return assumptions. We solve the compound-interest equation to estimate months-to-target, project nominal vs. real balances, and chart optimistic/base/conservative scenarios.

Everything updates instantly as you tweak the inputs, so you can model debt payoff, retirement targets, or near-term savings goals without leaving the app.

## Account statement uploads

The CSV/PDF importer (Transactions → Import) has been hardened to handle the latest Trade Republic statements:

- Understands additional month names (January/Januar, Dezember, etc.), transaction types (Lastschrift, Kartenzahlung, Deposits, Withdrawals), and alternative amount formats (EUR labels, trailing minus, multi-line rows).
- When no transactions are detected, the UI now surfaces a clear error so you can retry with the correct file.

If you still hit issues, confirm that you are uploading the official statement PDF (not a screenshot) or a CSV file with the `Date, Description, Amount` headers.
