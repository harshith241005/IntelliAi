import http from 'http';
import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import { initSocket } from './socket.js';
import { seedIfEmpty } from './seed.js';
import { eventsRouter } from './routes/events.js';
import { camerasRouter } from './routes/cameras.js';
import { alertsRouter } from './routes/alerts.js';
import { dashboardRouter } from './routes/dashboard.js';
import { startMockPipeline } from './mockPipeline.js';

const PORT = Number(process.env.PORT) || 5000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'online', service: 'store-intelligence-api' });
});

app.use('/api/events', eventsRouter);
app.use('/api/cameras', camerasRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/dashboard', dashboardRouter);

const httpServer = http.createServer(app);
initSocket(httpServer);

async function start(): Promise<void> {
  await connectDb();
  await seedIfEmpty();

  startMockPipeline();

  httpServer.listen(PORT, () => {
    console.log(`[api] Store Intelligence API on http://localhost:${PORT}`);
    console.log(`[api] Socket.IO ready on same port`);
    if (process.env.MOCK_EVENTS === 'true') {
      console.log('[api] MOCK_EVENTS=true — simulated events enabled');
    }
  });
}

start().catch((err) => {
  console.error('[api] Failed to start:', err);
  process.exit(1);
});
