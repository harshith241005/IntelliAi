import { v4 as uuidv4 } from 'uuid';
import { CameraModel, EventModel } from './db.js';
import { emitDashboard, emitEvent } from './socket.js';
import { buildDashboardStats, setOccupancy } from './metrics.js';
import { AlertModel } from './db.js';
import type { StoreEvent } from './types.js';

const EVENT_TYPES = [
  'person_detected',
  'person_entered',
  'occupancy_update',
] as const;

export function startMockPipeline(): void {
  if (process.env.MOCK_EVENTS !== 'true') return;

  console.log('[mock] Simulated CCTV event pipeline enabled');
  let occupancy = 12;

  setInterval(async () => {
    occupancy += Math.random() > 0.7 ? 1 : 0;
    setOccupancy(occupancy);

    const event: StoreEvent = {
      event_id: `EVT_${uuidv4().slice(0, 8).toUpperCase()}`,
      event_type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
      camera_id: `CAM_0${1 + Math.floor(Math.random() * 3)}`,
      person_id: Math.floor(Math.random() * 30) + 1,
      timestamp: new Date().toISOString(),
      confidence: 0.85 + Math.random() * 0.1,
      severity: 'info',
      message: 'Simulated detection',
      count: occupancy,
    };

    try {
      await EventModel.create(event);
    } catch {
      /* duplicate id rare */
    }
    emitEvent(event);

    const cameras = await CameraModel.find().lean();
    const active = cameras.filter((c) => c.status === 'active').length;
    const alerts = await AlertModel.countDocuments({ status: 'active' });
    emitDashboard(await buildDashboardStats(active, cameras.length, alerts));
  }, 2500);
}
