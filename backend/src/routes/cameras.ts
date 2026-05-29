import { Router, Request, Response } from 'express';
import { db } from '../database';
import { pipeline } from '../pipeline/IngestionPipeline';

const router = Router();

// Get camera list
router.get('/', (req: Request, res: Response) => {
  try {
    res.json(db.getCameras());
  } catch (error: any) {
    db.addLog('error', 'GET /api/cameras', 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Modify camera status / controls (e.g. simulate frame rates or shut off)
router.post('/:id/control', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, fps } = req.body;
    
    const cameras = db.getCameras();
    const camera = cameras.find(c => c.camera_id === id);
    
    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    const updatedStatus = status || camera.status;
    const updatedFps = fps !== undefined ? Number(fps) : camera.fps;
    
    db.updateCameraStatus(
      id,
      updatedStatus,
      updatedFps,
      updatedStatus === 'online' ? 0.2 : 5.0,
      updatedStatus === 'online' ? 45 : 180
    );

    db.addLog('info', `POST /api/cameras/${id}/control`, 200, `Camera state updated: status=${updatedStatus}, fps=${updatedFps}`);
    
    res.json({ success: true, camera: cameras.find(c => c.camera_id === id) });
  } catch (error: any) {
    db.addLog('error', `POST /api/cameras/${req.params.id}/control`, 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Force security breach trigger on camera
router.post('/:id/trigger-breach', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cameras = db.getCameras();
    const camera = cameras.find(c => c.camera_id === id);

    if (!camera) {
      return res.status(404).json({ error: "Camera not found" });
    }

    pipeline.forceSecurityBreach(camera.store_id, id);
    db.addLog('warning', `POST /api/cameras/${id}/trigger-breach`, 200, `Forced security intrusion triggered manually on ${id}`);

    res.json({ success: true, message: "Critical Intrusion Event dispatched to stream." });
  } catch (error: any) {
    db.addLog('error', `POST /api/cameras/${req.params.id}/trigger-breach`, 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
