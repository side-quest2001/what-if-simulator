import { Pool, QueryResult, types } from 'pg';

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Date objects.
// Without this, pg converts DATE → midnight UTC → toISOString() shifts the day
// by -1 in any timezone east of UTC (e.g. IST = UTC+5:30).
types.setTypeParser(1082, (val: string) => val);

// Pool is shared across all requests — do not create per-request pools.
// Connection string is read from DATABASE_URL env variable.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://simulator:simulator@localhost:5432/revenue_simulator',
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

// Typed query helper — keeps routes clean
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    console.warn(`[DB] Slow query (${duration}ms):`, text.slice(0, 80));
  }
  return result;
}

export default pool;
