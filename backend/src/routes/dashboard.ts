import { Router } from 'express';
import { AlertModel, CameraModel, EventModel } from '../db.js';
import { buildDashboardStats, buildSystemMetrics } from '../metrics.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', async (_req, res) => {
  const cameras = await CameraModel.find().lean();
  const active = cameras.filter((c) => c.status === 'active').length;
  const activeAlerts = await AlertModel.countDocuments({ status: 'active' });
  const stats = await buildDashboardStats(active, cameras.length, activeAlerts);
  res.json(stats);
});

dashboardRouter.get('/heatmap', async (_req, res) => {
  const events = await EventModel.find({
    coordinates: { $exists: true },
  })
    .sort({ timestamp: -1 })
    .limit(500)
    .lean();

  const zones: Record<string, number> = {
    'Aisle 1': 0,
    'Billing Counter': 0,
    'Entrance': 0,
    'Restricted Area': 0,
  };

  for (const evt of events) {
    if (!evt.coordinates) continue;
    const x = evt.coordinates.x ?? 0;
    const y = evt.coordinates.y ?? 0;
    if (y < 200) zones['Entrance'] += 1;
    else if (x < 300) zones['Aisle 1'] += 1;
    else if (x < 600) zones['Billing Counter'] += 1;
    else zones['Restricted Area'] += 1;
  }

  const heatmap = Object.entries(zones).map(([zone, density]) => ({
    zone,
    density,
    level:
      density > 40 ? 'high' : density > 15 ? 'medium' : density > 0 ? 'low' : 'idle',
  }));

  res.json(heatmap);
});

dashboardRouter.get('/metrics', (_req, res) => {
  res.json(buildSystemMetrics());
});
