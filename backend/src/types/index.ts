// ============================================================
// Core domain types for the Revenue Recognition Simulator
// ============================================================

export interface ProductionSubscription {
  id: string;
  customer_name: string;
  plan_name: string;
  contract_value: number;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  status: 'active' | 'cancelled' | 'expired';
}

export interface SimulationSession {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  expires_at: string;
  status: 'active' | 'expired';
}

export interface SimulatedSubscription {
  id: string;
  session_id: string;
  source_subscription_id: string;
  customer_name: string;
  plan_name: string;
  // Production snapshot (immutable)
  contract_value: number;
  start_date: string;
  end_date: string;
  // Simulation overrides (nullable = use original)
  sim_contract_value: number | null;
  sim_end_date: string | null;
  sim_refund_amount: number;
}

export interface MonthlyRevenue {
  month: string;        // YYYY-MM
  recognized: number;
  deferred: number;
}

export interface RevenueSummary {
  totalActual: number;
  totalSimulated: number;
  totalDifference: number;
  arrImpact: number;    // Annualized impact of the delta
}

export interface RevenuePreviewResponse {
  subscription: {
    id: string;
    sessionId: string;
    customerName: string;
    planName: string;
    sourceId: string;
  };
  actual: MonthlyRevenue[];
  simulated: MonthlyRevenue[];
  delta: { month: string; difference: number }[];
  summary: RevenueSummary;
}

export interface SimulationOverrides {
  contractValue?: number;
  endDate?: string;     // YYYY-MM-DD
  refundAmount?: number;
}
