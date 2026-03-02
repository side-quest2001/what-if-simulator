/**
 * Revenue Recognition Simulator — Express Server
 *
 * Why Express over Fastify?
 *   Express has a larger middleware ecosystem and better TypeScript
 *   community support for quick SaaS MVPs. Fastify is preferable
 *   for high-throughput microservices where schema serialization
 *   speed is the bottleneck — not the case here.
 */

import express from 'express';
import cors from 'cors';
import simulationsRouter from './routes/simulations';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3001', 'http://localhost:5173'] }));
app.use(express.json());

// Request logging (lightweight — no morgan dependency)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', simulationsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Revenue Simulator API`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → http://localhost:${PORT}/health\n`);
});

export default app;
