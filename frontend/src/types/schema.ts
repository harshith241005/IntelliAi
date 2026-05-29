export type EventType =
  | 'person_detected'
  | 'person_entered'
  | 'person_exited'
  | 'crowd_detected'
  | 'zone_breach'
  | 'high_occupancy'
  | 'occupancy_update';

export type Severity = 'info' | 'medium' | 'high' | 'critical';

export interface StoreEvent {
  event_id: string;
  event_type: EventType | string;
  camera_id: string;
  person_id?: number;
  timestamp: string;
  confidence?: number;
  severity: Severity | string;
  message?: string;
  count?: number;
  coordinates?: { x: number; y: number };
}

export interface Camera {
  camera_id: string;
  name: string;
  status: 'active' | 'offline' | 'degraded';
  source?: string;
}

export interface Alert {
  alert_id: string;
  type: string;
  status: 'active' | 'silenced' | 'investigating' | 'resolved';
  camera_id: string;
  severity: Severity | string;
  message: string;
  created_at: string;
  event_id?: string;
}

export interface DashboardStats {
  active_cameras: number;
  total_cameras: number;
  live_occupancy: number;
  events_per_minute: number;
  avg_ingestion_lag_ms: number;
  active_alerts: number;
}

export interface HeatmapZone {
  zone: string;
  density: number;
  level: 'idle' | 'low' | 'medium' | 'high';
}

export interface SystemMetrics {
  fps: number;
  ai_processing_ms: number;
  queue_size: number;
  api_latency_ms: number;
  active_streams: number;
  events_ingested_total: number;
}
