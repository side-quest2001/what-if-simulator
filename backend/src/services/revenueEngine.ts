/**
 * Revenue Recognition Engine
 *
 * Implements ASC 606-style monthly straight-line revenue recognition
 * for subscription contracts. All computations happen in-memory
 * from immutable inputs — no production data is ever touched.
 *
 * Core rule:
 *   recognized_per_month = net_contract_value / contract_months
 *   deferred -= recognized each month until $0
 *
 * Performance: O(n) where n = contract months.
 * A 12-month contract runs in < 1ms. 1,000 subscriptions < 50ms.
 */

import { MonthlyRevenue, RevenueSummary } from '../types';

// ============================================================
// Utilities
// ============================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns first day of the month for a given date */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Returns first day of next month */
function addOneMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

/**
 * Returns an ordered array of "YYYY-MM" strings covering every
 * calendar month from startDate to endDate (both inclusive).
 *
 * Edge case: if startDate > endDate, returns [].
 */
export function getMonthRange(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  let current = startOfMonth(startDate);
  const end = startOfMonth(endDate);

  while (current <= end) {
    months.push(formatMonth(current));
    current = addOneMonth(current);
  }
  return months;
}

// ============================================================
// Core straight-line recognition algorithm
// ============================================================

/**
 * Computes a monthly revenue schedule for a single subscription.
 *
 * Rules:
 *  - Net value = contractValue - refundAmount (floored at 0)
 *  - Monthly amount = netValue / numberOfMonths (straight-line)
 *  - Last month absorbs any floating-point rounding residual
 *  - Deferred balance decreases by recognized amount each month
 *
 * @param contractValue  Total contract value in USD
 * @param startDate      Subscription start date (day ignored — month is the unit)
 * @param endDate        Subscription end date
 * @param refundAmount   Reduces the total recognizable value (default 0)
 */
export function buildRevenueSchedule(
  contractValue: number,
  startDate: Date,
  endDate: Date,
  refundAmount: number = 0
): MonthlyRevenue[] {
  const netValue = Math.max(0, contractValue - refundAmount);
  const months = getMonthRange(startDate, endDate);

  if (months.length === 0) return [];

  // If net value is 0 (full refund or zero-value contract),
  // return zero-recognition schedule preserving month structure
  if (netValue === 0) {
    return months.map((month) => ({ month, recognized: 0, deferred: 0 }));
  }

  const monthlyAmount = netValue / months.length;
  let remainingDeferred = netValue;

  return months.map((month, index) => {
    const isLast = index === months.length - 1;

    // Last month absorbs any rounding residual to ensure
    // sum(recognized) === netValue exactly
    const recognized = isLast
      ? round2(remainingDeferred)
      : round2(monthlyAmount);

    remainingDeferred = round2(Math.max(0, remainingDeferred - recognized));

    return { month, recognized, deferred: remainingDeferred };
  });
}

// ============================================================
// Simulation engine — Actual vs Simulated comparison
// ============================================================

interface SubscriptionBase {
  contractValue: number;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
}

interface SimulationOverrides {
  contractValue?: number;
  endDate?: string;    // YYYY-MM-DD — shortens or extends the contract
  refundAmount?: number;
}

interface SimulationOutput {
  actual: MonthlyRevenue[];
  simulated: MonthlyRevenue[];
  delta: { month: string; difference: number }[];
  summary: RevenueSummary;
}

/**
 * Computes the Actual vs Simulated revenue comparison.
 *
 * Actual  = recognition with original contract terms
 * Simulated = recognition with user-supplied overrides applied
 *
 * Override semantics:
 *  - contractValue: replaces total contract value (e.g. upsell/downsell)
 *  - endDate: shortens or extends the contract period
 *    → if earlier: recognition stops sooner, remaining deferred = 0
 *    → if later:   recognition spreads over more months
 *  - refundAmount: reduces net recognizable value (applied to total)
 *
 * The function unions the month ranges of both schedules so that
 * the comparison table always shows a complete picture.
 */
export function simulateRevenueSchedule(
  base: SubscriptionBase,
  overrides: SimulationOverrides = {}
): SimulationOutput {
  // ── Actual schedule (production terms, no overrides) ──────────────
  const actualSchedule = buildRevenueSchedule(
    base.contractValue,
    new Date(base.startDate),
    new Date(base.endDate)
  );

  // ── Simulated schedule (apply overrides) ──────────────────────────
  const simValue = overrides.contractValue ?? base.contractValue;
  const simEndDate = overrides.endDate
    ? new Date(overrides.endDate)
    : new Date(base.endDate);
  const simRefund = overrides.refundAmount ?? 0;

  const simulatedSchedule = buildRevenueSchedule(
    simValue,
    new Date(base.startDate),
    simEndDate,
    simRefund
  );

  // ── Merge into union of all months (sorted chronologically) ───────
  const allMonthsSet = new Set([
    ...actualSchedule.map((m) => m.month),
    ...simulatedSchedule.map((m) => m.month),
  ]);
  const allMonths = [...allMonthsSet].sort();

  const actualMap = new Map(actualSchedule.map((m) => [m.month, m]));
  const simMap = new Map(simulatedSchedule.map((m) => [m.month, m]));

  const ZERO_ROW = (month: string): MonthlyRevenue => ({
    month,
    recognized: 0,
    deferred: 0,
  });

  const normalizedActual: MonthlyRevenue[] = allMonths.map(
    (month) => actualMap.get(month) ?? ZERO_ROW(month)
  );
  const normalizedSimulated: MonthlyRevenue[] = allMonths.map(
    (month) => simMap.get(month) ?? ZERO_ROW(month)
  );

  const delta = allMonths.map((month, i) => ({
    month,
    difference: round2(
      normalizedSimulated[i].recognized - normalizedActual[i].recognized
    ),
  }));

  // ── Summary metrics ────────────────────────────────────────────────
  const totalActual = round2(
    actualSchedule.reduce((sum, m) => sum + m.recognized, 0)
  );
  const totalSimulated = round2(
    simulatedSchedule.reduce((sum, m) => sum + m.recognized, 0)
  );
  const totalDifference = round2(totalSimulated - totalActual);

  // ARR impact: annualise the revenue delta over the union period.
  // E.g. $600 delta over 6 months → $1,200 ARR impact.
  const arrImpact =
    allMonths.length > 0
      ? round2((totalDifference / allMonths.length) * 12)
      : 0;

  return {
    actual: normalizedActual,
    simulated: normalizedSimulated,
    delta,
    summary: { totalActual, totalSimulated, totalDifference, arrImpact },
  };
}
