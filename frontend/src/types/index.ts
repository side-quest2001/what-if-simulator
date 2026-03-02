// Mirror of backend types — shared contract between API and UI

export interface ProductionSubscription {
  id: string;
  customer_name: string;
  plan_name: string;
  contract_value: number;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  status: 'active' | 'cancelled' | 'expired';
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
  arrImpact: number;
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
  endDate?: string;      // YYYY-MM-DD
  refundAmount?: number;
}
