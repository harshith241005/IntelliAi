import { connectDb, CameraModel, EventModel, AlertModel } from './db.js';

const CAMERAS = [
  { camera_id: 'CAM_01', name: 'Entrance', status: 'active', source: 'webcam' },
  { camera_id: 'CAM_02', name: 'Aisle 1', status: 'active', source: 'simulated' },
  { camera_id: 'CAM_03', name: 'Billing Counter', status: 'active', source: 'simulated' },
];

const SAMPLE_EVENTS = [
  {
    event_id: 'EVT_SEED_001',
    event_type: 'person_entered',
    camera_id: 'CAM_01',
    person_id: 12,
    timestamp: new Date().toISOString(),
    confidence: 0.94,
    severity: 'medium',
    message: 'Person entered store',
  },
  {
    event_id: 'EVT_SEED_002',
    event_type: 'person_detected',
    camera_id: 'CAM_02',
    person_id: 13,
    timestamp: new Date().toISOString(),
    confidence: 0.91,
    severity: 'info',
    message: 'Person detected in Aisle 1',
  },
];

export async function seedIfEmpty(): Promise<void> {
  const cameraCount = await CameraModel.countDocuments();
  if (cameraCount > 0) return;

  await CameraModel.insertMany(CAMERAS);
  await EventModel.insertMany(SAMPLE_EVENTS);
  console.log('[seed] Initialized cameras and sample events');
}
