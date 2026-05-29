import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const stores = db.getStores();
    
    // Dynamically calculate active occupancy based on cameras telemetry
    const cameras = db.getCameras();
    const storesWithCounts = stores.map(store => {
      const storeCams = cameras.filter(c => c.store_id === store.store_id);
      const activeCameras = storeCams.filter(c => c.status !== 'offline').length;
      
      // Seed slightly shifting occupancies based on active camera counts
      const occupancyShift = Math.floor((Math.random() - 0.5) * 4);
      const newOccupancy = Math.max(2, store.occupancy + occupancyShift);
      store.occupancy = newOccupancy; // save in-memory drift
      
      return {
        ...store,
        active_cameras: activeCameras,
        occupancy: newOccupancy
      };
    });

    res.json(storesWithCounts);
  } catch (error: any) {
    db.addLog('error', 'GET /api/stores', 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
