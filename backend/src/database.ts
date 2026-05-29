import fs from 'fs';
import path from 'path';
import { Store, Camera, Incident } from './types';

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export interface DatabaseSchema {
  stores: Store[];
  cameras: Camera[];
  incidents: Incident[];
  systemLogs: { timestamp: string; level: string; endpoint: string; status: number; message: string }[];
}

const DEFAULT_STORES: Store[] = [
  {
    store_id: "store_104",
    name: "Metrotown Flagship",
    location: "Burnaby, BC",
    status: "online",
    active_cameras: 4,
    occupancy: 28
  },
  {
    store_id: "store_208",
    name: "Downtown Express",
    location: "Vancouver, BC",
    status: "degraded",
    active_cameras: 2,
    occupancy: 12
  }
];

const DEFAULT_CAMERAS: Camera[] = [
  // Store 104
  {
    camera_id: "cam_104_01",
    store_id: "store_104",
    name: "Main Entrance North",
    zone_id: "zone_entrance",
    status: "online",
    fps: 30,
    resolution: "1920x1080",
    stream_health: 99.4,
    last_heartbeat: new Date().toISOString(),
    model_version: "YOLOv8x-Store-v2.4",
    frame_drop_rate: 0.1,
    latency_ms: 42
  },
  {
    camera_id: "cam_104_02",
    store_id: "store_104",
    name: "Checkout Aisle A-C",
    zone_id: "zone_checkout",
    status: "online",
    fps: 30,
    resolution: "1920x1080",
    stream_health: 98.7,
    last_heartbeat: new Date().toISOString(),
    model_version: "YOLOv8x-Store-v2.4",
    frame_drop_rate: 0.3,
    latency_ms: 45
  },
  {
    camera_id: "cam_104_03",
    store_id: "store_104",
    name: "Electronics Area",
    zone_id: "zone_aisle_electronics",
    status: "online",
    fps: 24,
    resolution: "1280x720",
    stream_health: 94.2,
    last_heartbeat: new Date().toISOString(),
    model_version: "YOLOv8x-Store-v2.4",
    frame_drop_rate: 1.2,
    latency_ms: 68
  },
  {
    camera_id: "cam_104_04",
    store_id: "store_104",
    name: "Back Warehouse Loading",
    zone_id: "zone_restricted_loading",
    status: "online",
    fps: 30,
    resolution: "1920x1080",
    stream_health: 100.0,
    last_heartbeat: new Date().toISOString(),
    model_version: "YOLOv8x-Store-v2.4",
    frame_drop_rate: 0.0,
    latency_ms: 38
  },
  // Store 208
  {
    camera_id: "cam_208_01",
    store_id: "store_208",
    name: "Main Entrance Main",
    zone_id: "zone_entrance",
    status: "online",
    fps: 30,
    resolution: "1920x1080",
    stream_health: 97.2,
    last_heartbeat: new Date().toISOString(),
    model_version: "YOLOv8s-Store-v1.8",
    frame_drop_rate: 0.8,
    latency_ms: 54
  },
  {
    camera_id: "cam_208_02",
    store_id: "store_208",
    name: "Safe Counter",
    zone_id: "zone_restricted_safe",
    status: "degraded",
    fps: 15,
    resolution: "1280x720",
    stream_health: 78.4,
    last_heartbeat: new Date().toISOString(),
    model_version: "YOLOv8s-Store-v1.8",
    frame_drop_rate: 4.8,
    latency_ms: 124
  }
];

const DEFAULT_INCIDENTS: Incident[] = [
  {
    incident_id: "inc_001",
    store_id: "store_104",
    camera_id: "cam_104_04",
    zone_id: "zone_restricted_loading",
    anomaly_type: "Restricted Zone Entry",
    score: 0.96,
    severity: "critical",
    status: "investigating",
    sla_started_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago
    assigned_to: "Operator Alex",
    operator_notes: [
      {
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        operator: "Operator Alex",
        text: "Unauthorized delivery personnel entered high-risk server rack area. Alert dispatched."
      },
      {
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        operator: "Operator Alex",
        text: "Confirmed standard delivery driver taking wrong hallway. Verbal warning issued."
      }
    ],
    correlated_event_ids: ["evt_hist_001", "evt_hist_002"],
    track_id: "track_restricted_991",
    media_url: "https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=600&auto=format&fit=crop"
  },
  {
    incident_id: "inc_002",
    store_id: "store_104",
    camera_id: "cam_104_03",
    zone_id: "zone_aisle_electronics",
    anomaly_type: "Loitering Suspicion",
    score: 0.82,
    severity: "warning",
    status: "open",
    sla_started_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12m ago
    operator_notes: [],
    correlated_event_ids: ["evt_hist_003"],
    track_id: "track_loiter_821",
    media_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop"
  }
];

const DEFAULT_LOGS = [
  {
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    level: "warning",
    endpoint: "POST /api/cameras/cam_208_02/reconnect",
    status: 408,
    message: "Camera request timeout. Frame ingestion lag exceeded 5000ms threshold."
  },
  {
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    level: "error",
    endpoint: "GET /api/media/clips/inc_003.mp4",
    status: 504,
    message: "Failed to download media clip: Object Store gateway connection refused."
  }
];

export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
      stores: DEFAULT_STORES,
      cameras: DEFAULT_CAMERAS,
      incidents: DEFAULT_INCIDENTS,
      systemLogs: DEFAULT_LOGS
    };
    this.initDb();
  }

  private initDb() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (e) {
      console.error("Failed to initialize JSON database, using memory store:", e);
    }
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error("Failed to write to db.json file:", e);
    }
  }

  public getStores(): Store[] {
    return this.data.stores;
  }

  public getCameras(): Camera[] {
    return this.data.cameras;
  }

  public getIncidents(): Incident[] {
    return this.data.incidents;
  }

  public getLogs() {
    return this.data.systemLogs;
  }

  public updateIncident(incident: Incident): boolean {
    const idx = this.data.incidents.findIndex(inc => inc.incident_id === incident.incident_id);
    if (idx !== -1) {
      this.data.incidents[idx] = incident;
      this.save();
      return true;
    }
    return false;
  }

  public addIncident(incident: Incident) {
    this.data.incidents.unshift(incident);
    // Limit to last 50 incidents to prevent file bloat
    if (this.data.incidents.length > 50) {
      this.data.incidents.pop();
    }
    this.save();
  }

  public addLog(level: 'info' | 'warning' | 'error', endpoint: string, status: number, message: string) {
    this.data.systemLogs.unshift({
      timestamp: new Date().toISOString(),
      level,
      endpoint,
      status,
      message
    });
    if (this.data.systemLogs.length > 100) {
      this.data.systemLogs.pop();
    }
    this.save();
  }

  public updateCameraStatus(cameraId: string, status: 'online' | 'degraded' | 'offline', fps: number, dropRate: number, latency: number) {
    const cam = this.data.cameras.find(c => c.camera_id === cameraId);
    if (cam) {
      cam.status = status;
      cam.fps = fps;
      cam.frame_drop_rate = parseFloat(dropRate.toFixed(2));
      cam.latency_ms = Math.round(latency);
      cam.last_heartbeat = new Date().toISOString();
      if (status === 'online') {
        cam.stream_health = Math.min(100, Math.max(90, cam.stream_health + 0.1));
      } else if (status === 'degraded') {
        cam.stream_health = Math.max(50, cam.stream_health - 0.5);
      } else {
        cam.stream_health = 0;
      }
      this.save();
    }
  }
}

export const db = new Database();
