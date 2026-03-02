/**
 * Simulation API Routes
 *
 * POST   /api/simulations                        – Create session
 * POST   /api/simulations/:id/clone-subscription – Snapshot a production sub
 * PATCH  /api/simulations/:id/assumptions        – Update what-if overrides
 * GET    /api/simulations/:id/revenue-preview    – Compute Actual vs Simulated
 * GET    /api/subscriptions                      – List production subscriptions
 *
 * Isolation guarantee:
 *   Every write goes to the simulated_* tables only. The
 *   production_subscriptions table is SELECT-only in this router.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/client';
import { simulateRevenueSchedule } from '../services/revenueEngine';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ── Helper: coerce a DATE result to string.
// With types.setTypeParser(1082) in client.ts, pg returns DATE as a plain
// "YYYY-MM-DD" string — so this is mostly a safety fallback.
function toDateString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    // Fallback: extract local date parts to avoid UTC drift
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value as string;
}

// ============================================================
// GET /api/subscriptions
// Lists all active production subscriptions for the dropdown.
// ============================================================
router.get(
  '/subscriptions',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await query<{
      id: string;
      customer_name: string;
      plan_name: string;
      contract_value: string;
      start_date: Date;
      end_date: Date;
      status: string;
    }>(
      `SELECT id, customer_name, plan_name, contract_value, start_date, end_date, status
       FROM production_subscriptions
       WHERE status = 'active'
       ORDER BY customer_name`
    );

    const subscriptions = result.rows.map((row) => ({
      id: row.id,
      customer_name: row.customer_name,
      plan_name: row.plan_name,
      contract_value: parseFloat(row.contract_value),
      start_date: toDateString(row.start_date)!,
      end_date: toDateString(row.end_date)!,
      status: row.status,
    }));

    res.json(subscriptions);
  })
);

// ============================================================
// POST /api/simulations
// Creates a new isolated simulation session scoped to a user.
//
// Architecture note:
//   Simulations are stored separately from production data.
//   A session has a 24-hour TTL; a background job (not shown here)
//   can sweep expired sessions to reclaim storage.
// ============================================================
const CreateSessionSchema = z.object({
  name: z.string().max(255).optional().default('Unnamed Simulation'),
  userId: z.string().max(255).optional().default('demo-user'),
});

router.post(
  '/simulations',
  asyncHandler(async (req: Request, res: Response) => {
    const body = CreateSessionSchema.parse(req.body);

    const result = await query(
      `INSERT INTO simulation_sessions (id, user_id, name, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       RETURNING id, user_id, name, created_at, expires_at, status`,
      [uuidv4(), body.userId, body.name]
    );

    res.status(201).json(result.rows[0]);
  })
);

// ============================================================
// POST /api/simulations/:id/clone-subscription
//
// Snapshots a production subscription into the simulation.
// The production record is copied as-is; overrides start NULL.
//
// One subscription per session (MVP). Calling this endpoint
// again on the same session replaces the previous clone.
// ============================================================
const CloneSchema = z.object({
  subscriptionId: z.string().min(1),
});

router.post(
  '/simulations/:id/clone-subscription',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const { subscriptionId } = CloneSchema.parse(req.body);

    // Verify session exists, is active, and not expired
    const sessionResult = await query(
      `SELECT id FROM simulation_sessions
       WHERE id = $1 AND status = 'active' AND expires_at > NOW()`,
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({
        error: 'Simulation session not found or expired',
      });
      return;
    }

    // Load production subscription (SELECT-only on production table)
    const subResult = await query<{
      id: string;
      customer_name: string;
      plan_name: string;
      contract_value: string;
      start_date: Date;
      end_date: Date;
    }>(
      `SELECT id, customer_name, plan_name, contract_value, start_date, end_date
       FROM production_subscriptions
       WHERE id = $1`,
      [subscriptionId]
    );
    if (subResult.rows.length === 0) {
      res.status(404).json({ error: 'Production subscription not found' });
      return;
    }

    const sub = subResult.rows[0];

    // Replace any existing clone for this session (one sub per session)
    await query(
      `DELETE FROM simulated_subscriptions WHERE session_id = $1`,
      [sessionId]
    );

    // Insert snapshot — overrides (sim_*) default to NULL/0
    const cloneResult = await query(
      `INSERT INTO simulated_subscriptions
         (id, session_id, source_subscription_id,
          customer_name, plan_name, contract_value, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        uuidv4(),
        sessionId,
        sub.id,
        sub.customer_name,
        sub.plan_name,
        sub.contract_value,
        toDateString(sub.start_date),
        toDateString(sub.end_date),
      ]
    );

    res.status(201).json(cloneResult.rows[0]);
  })
);

// ============================================================
// PATCH /api/simulations/:id/assumptions
//
// Updates the what-if overrides for the simulation.
// Partial updates are supported — only supplied fields change.
// NULL fields are not reset (use explicit null to clear an override
// in a real implementation; omitted = unchanged).
// ============================================================
const AssumptionsSchema = z.object({
  contractValue: z.number().positive().optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
    .optional(),
  refundAmount: z.number().min(0).optional(),
});

router.patch(
  '/simulations/:id/assumptions',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const assumptions = AssumptionsSchema.parse(req.body);

    // Partial update: COALESCE keeps existing values when new value is NULL
    const result = await query(
      `UPDATE simulated_subscriptions
       SET
         sim_contract_value = COALESCE($1::numeric, sim_contract_value),
         sim_end_date       = COALESCE($2::date, sim_end_date),
         sim_refund_amount  = COALESCE($3::numeric, sim_refund_amount)
       WHERE session_id = $4
       RETURNING *`,
      [
        assumptions.contractValue ?? null,
        assumptions.endDate ?? null,
        assumptions.refundAmount ?? null,
        sessionId,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'No subscription found for this session — clone one first',
      });
      return;
    }

    res.json(result.rows[0]);
  })
);

// ============================================================
// GET /api/simulations/:id/revenue-preview
//
// Computes and returns the Actual vs Simulated revenue schedule.
//
// Performance:
//   Computation is O(n) on contract months — typically <5ms for
//   a 24-month contract. For 1k subscriptions in a batch mode,
//   results would be cached in simulated_revenue_schedule.
//
// Response shape:
//   { subscription, actual[], simulated[], delta[], summary }
// ============================================================
router.get(
  '/simulations/:id/revenue-preview',
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.id;

    const subResult = await query<{
      id: string;
      session_id: string;
      source_subscription_id: string;
      customer_name: string;
      plan_name: string;
      contract_value: string;
      start_date: Date;
      end_date: Date;
      sim_contract_value: string | null;
      sim_end_date: Date | null;
      sim_refund_amount: string;
    }>(
      `SELECT *
       FROM simulated_subscriptions
       WHERE session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    if (subResult.rows.length === 0) {
      res.status(404).json({
        error: 'No subscription found for this session — clone one first',
      });
      return;
    }

    const row = subResult.rows[0];

    // Build base (production snapshot)
    const base = {
      contractValue: parseFloat(row.contract_value),
      startDate: toDateString(row.start_date)!,
      endDate: toDateString(row.end_date)!,
    };

    // Build overrides — only include if explicitly set
    const overrides = {
      contractValue: row.sim_contract_value
        ? parseFloat(row.sim_contract_value)
        : undefined,
      endDate: row.sim_end_date
        ? toDateString(row.sim_end_date)!
        : undefined,
      refundAmount: parseFloat(row.sim_refund_amount) || 0,
    };

    // Core computation — pure function, no DB writes
    const preview = simulateRevenueSchedule(base, overrides);

    res.json({
      subscription: {
        id: row.id,
        sessionId: row.session_id,
        customerName: row.customer_name,
        planName: row.plan_name,
        sourceId: row.source_subscription_id,
      },
      ...preview,
    });
  })
);

export default router;
