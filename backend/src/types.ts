export interface CCTVEvent {
  event_id: string;
  event_type: 'detection' | 'track_update' | 'anomaly' | 'alert';
  timestamp: string; // ISO 8601
  store_id: string;
  camera_id: string;
  zone_id: string;
  track_id?: string;
  confidence: number; // 0.0 - 1.0
  severity: 'info' | 'warning' | 'critical';
  payload: {
    coordinates?: { x: number; y: number; width?: number; height?: number };
    label?: string; // e.g. "person", "shopping_cart", "backpack"
    speed?: number; // px/s
    dwell_time?: number; // seconds
    count?: number; // occupancy count in zone
    message?: string; // summary of event
    path?: { x: number; y: number }[]; // historical track coordinates for path drawing
    [key: string]: any;
  };
  media_url?: string;
  anomaly_score?: number; // 0.0 - 1.0
  correlation_id?: string;
  schema_version: string;
}

export interface Store {
  store_id: string;
  name: string;
  location: string;
  status: 'online' | 'degraded' | 'offline';
  active_cameras: number;
  occupancy: number;
}

export interface Camera {
  camera_id: string;
  store_id: string;
  name: string;
  zone_id: string;
  status: 'online' | 'degraded' | 'offline';
  fps: number;
  resolution: string;
  stream_health: number; // 0 - 100%
  last_heartbeat: string;
  model_version: string;
  frame_drop_rate: number; // %
  latency_ms: number;
}

export interface Incident {
  incident_id: string;
  store_id: string;
  camera_id: string;
  zone_id: string;
  anomaly_type: string;
  score: number;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  sla_started_at: string;
  assigned_to?: string;
  operator_notes: {
    timestamp: string;
    operator: string;
    text: string;
  }[];
  correlated_event_ids: string[];
  track_id: string;
  media_url?: string;
}

export interface SystemHealthMetrics {
  api_p50_latency_ms: number;
  api_p95_latency_ms: number;
  api_p99_latency_ms: number;
  events_ingested_per_min: number;
  events_processed_per_min: number;
  ingestion_lag_ms: number;
  active_ws_connections: number;
  schema_version: string;
  features_flags: {
    ingest: boolean;
    detect: boolean;
    track: boolean;
    enrich: boolean;
    publish: boolean;
  };
}
