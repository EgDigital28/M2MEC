# M2MEC

Machine-to-Machine Edge Communications — a modern marketing site built with Next.js, React, and TypeScript.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Automated bet grading

The Vercel cron job calls `GET /api/cron/grade-bets` daily and grades open bets
whose event date has arrived. The route calls the Prediction Ledger outcome API
with the event date, sport, and wager description. It updates a bet only when
the API returns `resolution: "graded"`; pending, unmatched, ambiguous, and
unsupported positions remain open for a later run or manual review.

Configure these server-only environment variables in Vercel:

- `CRON_SECRET`: authenticates Vercel's cron request.
- `LEDGER_CONSUMER_API_KEY`: bearer key also present in the Prediction Ledger's
  `LEDGER_CONSUMER_API_KEYS` setting.
- `PREDICTION_LEDGER_OUTCOMES_URL`: optional endpoint override; defaults to the
  production Prediction Ledger grade endpoint.

The automation maps both `push` and `void` outcomes to the ledger's zero-profit
`Void` status. It never overwrites a position that is no longer `Open`.

## Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**

## Project Structure

```
src/
├── app/           # App Router pages and global styles
├── components/    # UI sections (Hero, Capabilities, Approach, Contact)
└── lib/           # Shared content and data
```

## Sections

- **Hero** — headline, value proposition, and key metrics
- **Capabilities** — six feature cards for edge M2M services
- **Approach** — four-phase engagement breakdown
- **Contact** — inquiry form and contact details
