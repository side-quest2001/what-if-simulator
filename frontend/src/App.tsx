import { useState } from 'react';
import SimulationSetup from './components/SimulationSetup';
import SimulationResults from './components/SimulationResults';
import { RevenuePreviewResponse } from './types';

export default function App() {
  const [results, setResults] = useState<RevenuePreviewResponse | null>(null);

  return (
    <div className="app">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon">▲</span>
          <span className="brand-name">LedgerSim</span>
        </div>
        <div className="topbar-meta">
          <span className="badge badge-preview">What-If Preview</span>
          <span className="topbar-hint">
            Simulate revenue without touching production data
          </span>
        </div>
      </header>

      {/* ── Layout: sidebar + main ────────────────────────────────── */}
      <div className="layout">
        <SimulationSetup
          onResults={(r) => {
            setResults(r);
          }}
        />

        <main className="main-content">
          {results ? (
            <SimulationResults
              data={results}
              onReset={() => setResults(null)}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No simulation yet</h3>
              <p>
                Select a subscription, adjust the assumptions on the left, and
                click <strong>Run Simulation</strong> to preview the revenue
                impact.
              </p>
              <ul className="feature-list">
                <li>Model early cancellations</li>
                <li>Preview upsell / downsell effects</li>
                <li>Calculate refund impact on deferred revenue</li>
                <li>Compare Actual vs Simulated side-by-side</li>
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
