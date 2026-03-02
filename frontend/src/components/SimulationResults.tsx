import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { RevenuePreviewResponse } from '../types';

interface Props {
  data: RevenuePreviewResponse;
  onReset: () => void;
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function usd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function signedUsd(n: number): string {
  return `${n >= 0 ? '+' : ''}${usd(n)}`;
}

function shortMonth(m: string): string {
  // "2025-03" → "Mar '25"
  const [year, month] = m.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ── Custom Tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-month">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <strong>{usd(entry.value)}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function SimulationResults({ data, onReset }: Props) {
  const { actual, simulated, delta, summary, subscription } = data;

  // Merge for chart — recharts needs a single array
  const chartData = actual.map((a, i) => ({
    month: shortMonth(a.month),
    rawMonth: a.month,
    Actual: a.recognized,
    Simulated: simulated[i]?.recognized ?? 0,
  }));

  const isPositive = summary.totalDifference >= 0;

  return (
    <div className="results-panel">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="results-header">
        <div>
          <h2>Simulation Results</h2>
          <p className="sub-title">
            {subscription.customerName} &mdash; {subscription.planName}
          </p>
        </div>
        <button onClick={onReset} className="btn-secondary">
          ← New Simulation
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="summary-grid">
        <div className="summary-card">
          <span className="card-label">Total Actual Revenue</span>
          <span className="card-value card-actual">
            {usd(summary.totalActual)}
          </span>
        </div>

        <div className="summary-card">
          <span className="card-label">Total Simulated Revenue</span>
          <span className="card-value card-simulated">
            {usd(summary.totalSimulated)}
          </span>
        </div>

        <div className={`summary-card ${isPositive ? 'card-bg-green' : 'card-bg-red'}`}>
          <span className="card-label">Revenue Delta</span>
          <span
            className={`card-value ${isPositive ? 'card-positive' : 'card-negative'}`}
          >
            {signedUsd(summary.totalDifference)}
          </span>
        </div>

        <div className={`summary-card ${isPositive ? 'card-bg-green' : 'card-bg-red'}`}>
          <span className="card-label">ARR Impact</span>
          <span
            className={`card-value ${isPositive ? 'card-positive' : 'card-negative'}`}
          >
            {signedUsd(summary.arrImpact)}/yr
          </span>
          <span className="card-sub">Annualised delta</span>
        </div>
      </div>

      {/* ── Line Chart ─────────────────────────────────────────────────── */}
      <div className="chart-section">
        <h3>Monthly Revenue: Actual vs Simulated</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 24, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Line
              type="monotone"
              dataKey="Actual"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="Simulated"
              stroke="#10b981"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: '#10b981' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Comparison Table ───────────────────────────────────────────── */}
      <div className="table-section">
        <h3>Month-by-Month Breakdown</h3>
        <div className="table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Actual</th>
                <th>Simulated</th>
                <th>Delta</th>
                <th>Act. Deferred</th>
                <th>Sim. Deferred</th>
              </tr>
            </thead>
            <tbody>
              {actual.map((row, i) => {
                const diff = delta[i]?.difference ?? 0;
                const pos = diff >= 0;
                return (
                  <tr key={row.month}>
                    <td className="col-month">{row.month}</td>
                    <td className="col-num">{usd(row.recognized)}</td>
                    <td className="col-num col-sim">
                      {usd(simulated[i]?.recognized ?? 0)}
                    </td>
                    <td
                      className={`col-num col-delta ${pos ? 'positive' : 'negative'}`}
                    >
                      {signedUsd(diff)}
                    </td>
                    <td className="col-num col-muted">{usd(row.deferred)}</td>
                    <td className="col-num col-muted">
                      {usd(simulated[i]?.deferred ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td>Total</td>
                <td className="col-num">{usd(summary.totalActual)}</td>
                <td className="col-num col-sim">{usd(summary.totalSimulated)}</td>
                <td
                  className={`col-num col-delta ${isPositive ? 'positive' : 'negative'}`}
                >
                  {signedUsd(summary.totalDifference)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
