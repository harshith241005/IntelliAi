import { CCTVEvent, Camera } from '../types';
import { ObjectTracker } from './ObjectTracker';
import { AnomalyDetector } from './AnomalyDetector';
import { db } from '../database';

export class IngestionPipeline {
  private tracker: ObjectTracker;
  private detector: AnomalyDetector;
  private intervalId: NodeJS.Timeout | null = null;
  private onEventCallback: (event: CCTVEvent) => void = () => {};
  
  // Pipeline metrics
  private totalEventsIngested = 0;
  private totalEventsProcessed = 0;
  private pipelineLagMs = 38;

  constructor() {
    this.tracker = new ObjectTracker();
    this.detector = new AnomalyDetector();
  }

  public setEventCallback(callback: (event: CCTVEvent) => void) {
    this.onEventCallback = callback;
  }

  public start(tickRateMs: number = 1000) {
    if (this.intervalId) return;

    console.log("Starting CCTV Ingestion & Analytics Pipeline...");
    this.intervalId = setInterval(() => {
      this.tick();
    }, tickRateMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("CCTV Pipeline stopped.");
    }
  }

  private tick() {
    try {
      const activeCameras = db.getCameras().filter(c => c.status !== 'offline');
      
      const activeStoreCameras = activeCameras.map(c => ({
        store_id: c.store_id,
        camera_id: c.camera_id
      }));

      if (activeStoreCameras.length === 0) return;

      // 1. Tick coordinate trackers
      const trackEvents = this.tracker.tick(activeStoreCameras);
      this.totalEventsIngested += trackEvents.length;

      // Dispatch track updates
      trackEvents.forEach(evt => {
        this.onEventCallback(evt);
      });

      // 2. Feed current active tracks to AnomalyDetector
      const activeTracks = this.tracker.getTracks();
      const anomalies = this.detector.processTracks(activeTracks);
      this.totalEventsProcessed += trackEvents.length + anomalies.length;

      // Dispatch anomalies
      anomalies.forEach(evt => {
        this.onEventCallback(evt);
        
        // Also log critical alerts to database logs
        if (evt.severity === 'critical') {
          db.addLog('warning', `SYSTEM PIPELINE`, 200, `Critical anomaly detected on ${evt.camera_id}: ${evt.payload.message}`);
        }
      });

      // 3. Telemetry Update: Simulates slight camera telemetry shifts (frame drops, latency)
      db.getCameras().forEach(cam => {
        if (cam.status === 'offline') return;

        // Slight drift
        const fpsChange = (Math.random() - 0.5) * 2;
        const newFps = Math.min(30, Math.max(10, Math.round(cam.fps + fpsChange)));
        
        const dropChange = (Math.random() - 0.5) * 0.5;
        const newDrop = Math.max(0, Math.min(10, cam.frame_drop_rate + dropChange));
        
        const latChange = (Math.random() - 0.5) * 6;
        const newLat = Math.max(20, Math.min(250, cam.latency_ms + latChange));

        db.updateCameraStatus(cam.camera_id, cam.status, newFps, newDrop, newLat);
      });

    } catch (e: any) {
      console.error("Error in IngestionPipeline tick cycle:", e);
      db.addLog('error', 'INGESTION PIPELINE TICK', 500, e.message || 'Pipeline loop processing crashed.');
    }
  }

  // Force alert action from administrator dashboard
  public forceSecurityBreach(storeId: string, cameraId: string) {
    const breachEvent = this.tracker.forceIntrusion(storeId, cameraId);
    this.onEventCallback(breachEvent);

    const anomalies = this.detector.processTracks(this.tracker.getTracks());
    anomalies.forEach(evt => {
      this.onEventCallback(evt);
    });
  }

  // Metrics getters
  public getIngestedCount() {
    return this.totalEventsIngested;
  }

  public getProcessedCount() {
    return this.totalEventsProcessed;
  }

  public getPipelineLag() {
    // Return average latency of active cameras + queue parsing time
    const activeCams = db.getCameras().filter(c => c.status !== 'offline');
    if (activeCams.length === 0) return 0;
    const avgCamLat = activeCams.reduce((sum, c) => sum + c.latency_ms, 0) / activeCams.length;
    return Math.round(avgCamLat + 2); // 2ms queue lag
  }
}

export const pipeline = new IngestionPipeline();
