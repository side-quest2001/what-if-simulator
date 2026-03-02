/**
 * API client — thin wrappers around fetch().
 *
 * All simulation interactions are orchestrated as a sequential
 * 4-step flow inside runSimulation():
 *   1. Create session  (POST /api/simulations)
 *   2. Clone sub       (POST /api/simulations/:id/clone-subscription)
 *   3. Apply overrides (PATCH /api/simulations/:id/assumptions)
 *   4. Fetch preview   (GET  /api/simulations/:id/revenue-preview)
 *
 * Each new "Run Simulation" click creates a fresh session so
 * partial state from the previous run never bleeds in.
 */

import { ProductionSubscription, RevenuePreviewResponse, SimulationOverrides } from '../types';

const BASE = '/api';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<ProductionSubscription[]> {
  return apiFetch<ProductionSubscription[]>(`${BASE}/subscriptions`);
}

/**
 * Runs a full simulation in one call:
 *   create → clone → patch → preview
 *
 * Returns the revenue comparison ready to render in the UI.
 */
export async function runSimulation(
  subscriptionId: string,
  overrides: SimulationOverrides
): Promise<RevenuePreviewResponse> {
  // Step 1: Create an isolated simulation session
  const session = await apiFetch<{ id: string }>(`${BASE}/simulations`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Quick Simulation', userId: 'demo-user' }),
  });

  // Step 2: Snapshot the selected production subscription into the session
  await apiFetch(`${BASE}/simulations/${session.id}/clone-subscription`, {
    method: 'POST',
    body: JSON.stringify({ subscriptionId }),
  });

  // Step 3: Apply user-supplied assumption overrides
  const hasOverrides = Object.values(overrides).some(
    (v) => v !== undefined && v !== 0 && v !== ''
  );
  if (hasOverrides) {
    await apiFetch(`${BASE}/simulations/${session.id}/assumptions`, {
      method: 'PATCH',
      body: JSON.stringify(overrides),
    });
  }

  // Step 4: Compute and return revenue preview
  return apiFetch<RevenuePreviewResponse>(
    `${BASE}/simulations/${session.id}/revenue-preview`
  );
}
