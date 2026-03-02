import { useState, useEffect } from 'react';
import { ProductionSubscription, SimulationOverrides, RevenuePreviewResponse } from '../types';
import { getSubscriptions, runSimulation } from '../api/client';

interface Props {
  onResults: (results: RevenuePreviewResponse) => void;
}

export default function SimulationSetup({ onResults }: Props) {
  const [subscriptions, setSubscriptions] = useState<ProductionSubscription[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedSub, setSelectedSub] = useState<ProductionSubscription | null>(null);

  // Assumption overrides — blank = use original value
  const [simContractValue, setSimContractValue] = useState('');
  const [simEndDate, setSimEndDate] = useState('');
  const [simRefundAmount, setSimRefundAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getSubscriptions()
      .then(setSubscriptions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingList(false));
  }, []);

  // Pre-fill form when subscription is selected
  useEffect(() => {
    const sub = subscriptions.find((s) => s.id === selectedId) ?? null;
    setSelectedSub(sub);
    if (sub) {
      setSimContractValue(String(sub.contract_value));
      setSimEndDate(sub.end_date);
      setSimRefundAmount('0');
    }
  }, [selectedId, subscriptions]);

  async function handleRun() {
    if (!selectedId) {
      setError('Please select a subscription first.');
      return;
    }
    setError('');
    setLoading(true);

    const overrides: SimulationOverrides = {};
    const cv = parseFloat(simContractValue);
    if (!isNaN(cv) && selectedSub && cv !== selectedSub.contract_value) {
      overrides.contractValue = cv;
    }
    if (simEndDate && selectedSub && simEndDate !== selectedSub.end_date) {
      overrides.endDate = simEndDate;
    }
    const refund = parseFloat(simRefundAmount);
    if (!isNaN(refund) && refund > 0) {
      overrides.refundAmount = refund;
    }

    try {
      const results = await runSimulation(selectedId, overrides);
      onResults(results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="setup-panel">
      <div className="panel-header">
        <h2>What-If Simulator</h2>
        <span className="badge badge-sandbox">Sandbox Mode</span>
      </div>

      <p className="panel-desc">
        Model revenue outcomes without touching production data.
      </p>

      {/* Subscription selector */}
      <div className="field">
        <label htmlFor="sub-select">Subscription</label>
        {loadingList ? (
          <p className="loading-text">Loading subscriptions…</p>
        ) : (
          <select
            id="sub-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="select"
          >
            <option value="">— select a subscription —</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.customer_name} · {s.plan_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Current values card */}
      {selectedSub && (
        <div className="info-card">
          <div className="info-row">
            <span>Contract value</span>
            <strong>${selectedSub.contract_value.toLocaleString()}</strong>
          </div>
          <div className="info-row">
            <span>Start date</span>
            <strong>{selectedSub.start_date}</strong>
          </div>
          <div className="info-row">
            <span>End date</span>
            <strong>{selectedSub.end_date}</strong>
          </div>
          <div className="info-row">
            <span>Monthly (straight-line)</span>
            <strong>
              ${(selectedSub.contract_value / 12).toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      <hr className="divider" />
      <p className="section-label">Override Assumptions</p>

      {/* Contract value */}
      <div className="field">
        <label htmlFor="cv">New Contract Value ($)</label>
        <input
          id="cv"
          type="number"
          min="0"
          step="0.01"
          value={simContractValue}
          onChange={(e) => setSimContractValue(e.target.value)}
          placeholder="e.g. 900"
          className="input"
        />
        <span className="hint">Change for upsell / downsell scenarios</span>
      </div>

      {/* End date */}
      <div className="field">
        <label htmlFor="end">Simulated End Date</label>
        <input
          id="end"
          type="date"
          value={simEndDate}
          onChange={(e) => setSimEndDate(e.target.value)}
          className="input"
        />
        <span className="hint">Earlier date = early cancellation scenario</span>
      </div>

      {/* Refund */}
      <div className="field">
        <label htmlFor="refund">Refund Amount ($)</label>
        <input
          id="refund"
          type="number"
          min="0"
          step="0.01"
          value={simRefundAmount}
          onChange={(e) => setSimRefundAmount(e.target.value)}
          placeholder="e.g. 200"
          className="input"
        />
        <span className="hint">Reduces total recognizable value</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button
        onClick={handleRun}
        disabled={loading || !selectedId}
        className="btn-primary"
      >
        {loading ? (
          <span className="btn-loading">
            <span className="spinner" /> Computing…
          </span>
        ) : (
          'Run Simulation'
        )}
      </button>

      <p className="sandbox-note">
        ⚡ Read-only · No production data is modified
      </p>
    </aside>
  );
}
