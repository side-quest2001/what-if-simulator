# Revenue Recognition Simulator — Plain English Guide

## What Is This?

Imagine you run a software company and customers pay you upfront for a year of service.
Say a customer pays **$1,200 today** for a 12-month subscription.

In accounting, you can't just count that $1,200 as income today — you have to "earn" it
month by month as you deliver the service. So you recognize **$100 every month** for 12 months.

This is called **Revenue Recognition**, and it's a real accounting rule (called ASC 606).

This app is a **"What-If" simulator** for that process. It lets you ask questions like:

> "What happens to our revenue if this customer cancels in July?"
> "What if we give them a $200 refund?"
> "What if they upgrade to a $2,400 plan?"

And it shows you the answer **instantly**, without touching any real financial data.

---

## The Problem It Solves

Before this tool, answering "what-if" questions meant:
- Exporting data to Excel
- Manually recalculating spreadsheets
- Risking mistakes in production accounting records

This simulator gives you a **safe sandbox** to play with numbers and see the impact in seconds.

---

## How It Works (Step by Step)

### Step 1 — Pick a Customer Subscription

You choose one of your real customer subscriptions from a dropdown.
For example: **Acme Corp**, who pays $1,200/year for the "Annual Pro" plan.

### Step 2 — The App Takes a "Snapshot"

It copies Acme Corp's subscription details into a private sandbox.
The real data is **never touched**. Think of it like photocopying a document before writing on it.

### Step 3 — You Change the Assumptions

You can tweak three things:

| What You Can Change | Example |
|---|---|
| **Contract Value** | Increase from $1,200 to $2,400 (they upgraded) |
| **End Date** | Move from Dec 31 to Jul 10 (they cancelled early) |
| **Refund Amount** | Give them $200 back |

### Step 4 — See the Results

The app instantly shows you:
- A **line chart** comparing actual vs. simulated revenue month by month
- A **table** showing the exact dollar difference per month
- A **summary** with total revenue impact and what it means for ARR (Annual Recurring Revenue)

---

## The Mock Customers (Fake Test Data)

The app comes pre-loaded with 6 fake companies to demo with. None of these are real.

| Company | Plan | Total Value | Purpose |
|---|---|---|---|
| **Acme Corp** | Annual Pro | $1,200 | Simple baseline — $100/month |
| **TechStart Inc** | Annual Enterprise | $6,000 | Tests mid-month start dates |
| **CloudVentures** | Semi-Annual Growth | $3,600 | Good for early cancellation demo |
| **DataMesh Ltd** | Annual Pro | $1,200 | Contract that crosses two calendar years |
| **Nexus Analytics** | Annual Enterprise | $12,000 | High-value — shows big ARR impact |
| **PilotApp LLC** | Quarterly Starter | $900 | Short 3-month contract |

---

## The Math (Kept Simple)

The core formula is just division:

```
Monthly Revenue = (Contract Value - Refund) / Number of Months
```

**Example — Acme Corp, Annual Pro, $1,200:**
```
$1,200 / 12 months = $100 recognized per month
```

**Example — Acme Corp cancels in July (7 months in):**
```
Simulated = $1,200 / 7 months = ~$171/month (recognized faster over fewer months)
Remaining months (Aug–Dec) = $0
```

The last month always absorbs any leftover pennies from rounding so the numbers add up exactly.

---

## What the App Is Made Of

### Backend (the "engine room")

- Runs on **Node.js + TypeScript**
- Uses **Express** to handle API requests
- Connects to a **PostgreSQL** database
- All revenue calculations happen in memory — fast and safe

### Frontend (what you see)

- Built with **React + TypeScript**
- Charts powered by **Recharts**
- Runs in your browser at `http://localhost:3001`

### Database

Three tables:

| Table | What It Stores |
|---|---|
| `production_subscriptions` | Real (or mock) customer subscription data. Never modified. |
| `simulation_sessions` | Each time you click "Run Simulation", a new session is created. Expires after 24 hours. |
| `simulated_subscriptions` | A copy of the subscription with your what-if changes applied. |

---

## How to Run It

You need Docker, Node.js, and npm installed.

```bash
# 1. Start the database
docker-compose up -d

# 2. Start the backend (runs on port 3000)
cd backend
npm install
npm run dev

# 3. Start the frontend (runs on port 3001)
cd frontend
npm install
npm run dev
```

Then open your browser to: **http://localhost:3001**

---

## API Endpoints (for developers)

These are the "doors" the frontend uses to talk to the backend:

| Method | URL | What It Does |
|---|---|---|
| GET | `/api/subscriptions` | List all available subscriptions |
| POST | `/api/simulations` | Create a new simulation sandbox |
| POST | `/api/simulations/:id/clone-subscription` | Copy a real subscription into the sandbox |
| PATCH | `/api/simulations/:id/assumptions` | Apply your what-if changes |
| GET | `/api/simulations/:id/revenue-preview` | Get the Actual vs Simulated results |

---

## Key Design Decisions

**Production data is read-only.**
The app never writes to `production_subscriptions`. Your real accounting data cannot be accidentally changed.

**Each simulation is isolated.**
Every "Run Simulation" click creates a brand new session. You can't accidentally carry over settings from a previous run.

**Simulations expire after 24 hours.**
The sandbox data is automatically cleaned up so the database doesn't grow forever.

**Calculations happen on-the-fly.**
Results are computed fresh each time you request them. A 12-month contract calculates in under 1ms.

---

## What the Results Mean

| Term | Plain English |
|---|---|
| **Recognized Revenue** | Money you've officially "earned" this month |
| **Deferred Revenue** | Money already paid by the customer but not yet earned |
| **Delta** | The difference between actual and simulated (positive = more money, negative = less) |
| **ARR Impact** | If this change happened to all similar customers, how would it affect your annual revenue run rate |

---

## Example Scenario

**Question:** "What happens if Nexus Analytics ($12,000/year) cancels on July 10?"

**Answer the simulator gives:**
- Jan–Jul: Revenue recognized faster (spread over 7 months = ~$1,714/month instead of $1,000/month)
- Aug–Dec: $0 (contract ended)
- **Total revenue drops from $12,000 to ~$12,000... but ARR drops from $12,000 to ~$20,568 annualized** *(because the shorter period changes the annualized rate)*

You see this visually as a line chart where the simulated line drops to zero in August.
