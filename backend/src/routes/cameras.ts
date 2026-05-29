import { Router } from 'express';
import { CameraModel } from '../db.js';
import { runtimeMetrics } from '../metrics.js';

export const camerasRouter = Router();

camerasRouter.get('/', async (_req, res) => {
  const cameras = await CameraModel.find().sort({ camera_id: 1 }).lean();
  res.json(cameras);
});

camerasRouter.post('/', async (req, res) => {
  const { camera_id, name, status = 'active', source } = req.body;
  if (!camera_id || !name) {
    res.status(400).json({ error: 'camera_id and name are required' });
    return;
  }
  const camera = await CameraModel.findOneAndUpdate(
    { camera_id },
    { camera_id, name, status, source },
    { upsert: true, new: true }
  );
  res.status(201).json(camera);
});

camerasRouter.patch('/:cameraId', async (req, res) => {
  const camera = await CameraModel.findOneAndUpdate(
    { camera_id: req.params.cameraId },
    req.body,
    { new: true }
  );
  if (!camera) {
    res.status(404).json({ error: 'Camera not found' });
    return;
  }
  res.json(camera);
});

camerasRouter.post('/:cameraId/heartbeat', async (req, res) => {
  runtimeMetrics.active_streams += 1;
  await CameraModel.updateOne(
    { camera_id: req.params.cameraId },
    { status: 'active' }
  );
  res.json({ ok: true });
});
