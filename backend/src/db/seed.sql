-- ============================================================
-- Seed: Mock production subscriptions (Stripe-like data)
-- These represent real subscriptions already ingested from Stripe.
-- ============================================================

INSERT INTO production_subscriptions
  (id, customer_name, plan_name, contract_value, start_date, end_date, status)
VALUES
  -- Classic annual plan: $100/month straight-line
  ('sub_001', 'Acme Corp',         'Annual Pro',         1200.00,  '2025-01-01', '2025-12-31', 'active'),

  -- Large enterprise: $500/month, mid-month start (March 15)
  ('sub_002', 'TechStart Inc',     'Annual Enterprise',  6000.00,  '2025-03-15', '2026-03-14', 'active'),

  -- 6-month contract: $600/month — good for early-cancellation scenario
  ('sub_003', 'CloudVentures',     'Semi-Annual Growth', 3600.00,  '2025-01-01', '2025-06-30', 'active'),

  -- Crosses year boundary: tests cross-year reporting
  ('sub_004', 'DataMesh Ltd',      'Annual Pro',         1200.00,  '2024-07-01', '2025-06-30', 'active'),

  -- High-value annual: $1,000/month — high-impact simulation
  ('sub_005', 'Nexus Analytics',   'Annual Enterprise',  12000.00, '2025-01-01', '2025-12-31', 'active'),

  -- Short 3-month trial-to-paid: tests short contracts
  ('sub_006', 'PilotApp LLC',      'Quarterly Starter',  900.00,   '2025-02-01', '2025-04-30', 'active')

ON CONFLICT (id) DO NOTHING;
