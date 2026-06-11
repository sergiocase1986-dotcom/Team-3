# Proof-of-Value — sales enablement for staffing agencies

The AE enters the client's roles and state live on the call, shows the
in-house vs. hub cost gap on screen, and gets an AI placement plan with
an objection answer and a ready-to-send follow-up email.

Built for the BYTE&KITE hackathon — Kata #5 (true cost of hiring).

## Stack
Next.js 14 (App Router) · Claude API (claude-sonnet-4-6, server-side) · Vercel

## Run locally
```bash
npm install
cp .env.example .env.local   # put your real ANTHROPIC_API_KEY
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. vercel.com → Add New → Project → import the repo.
3. In "Environment Variables" add: `ANTHROPIC_API_KEY` = your key.
4. Deploy. Done.

## Where the money math lives
All cost math is plain JS in `components/Calculator.jsx` (never trust a
model with arithmetic). Claude only does the reasoning: placement mix,
objection, tradeoff, follow-up copy — returned as strict JSON.
