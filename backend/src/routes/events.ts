import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AlertModel, EventModel } from '../db.js';
import { emitAlert, emitDashboard, emitEvent } from '../socket.js';
import {
  buildDashboardStats,
  getOccupancy,
  recordIngestion,
  runtimeMetrics,
  setOccupancy,
} from '../metrics.js';
import { CameraModel } from '../db.js';
import type { AlertDoc, Severity, StoreEvent } from '../types.js';

export const eventsRouter = Router();

const ALERT_TYPES = new Set(['zone_breach', 'crowd_detected', 'high_occupancy']);

function normalizeSeverity(raw?: string): Severity {
  const s = (raw || 'info').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'info') {
    return s as Severity;
  }
  if (s === 'warning') return 'medium';
  return 'info';
}

async function maybeCreateAlert(event: StoreEvent): Promise<AlertDoc | null> {
  if (!ALERT_TYPES.has(event.event_type) && event.severity !== 'critical' && event.severity !== 'high') {
    return null;
  }

  const alert: AlertDoc = {
    alert_id: `ALT_${uuidv4().slice(0, 8).toUpperCase()}`,
    type: event.event_type,
    status: 'active',
    camera_id: event.camera_id,
    severity: event.severity === 'info' ? 'high' : event.severity,
    message: event.message || `${event.event_type} on ${event.camera_id}`,
    created_at: event.timestamp,
    event_id: event.event_id,
  };

  await AlertModel.create(alert);
  emitAlert(alert);
  return alert;
}

async function broadcastDashboard(): Promise<void> {
  const cameras = await CameraModel.find().lean();
  const active = cameras.filter((c) => c.status === 'active').length;
  const alerts = await AlertModel.countDocuments({ status: 'active' });
  const stats = await buildDashboardStats(active, cameras.length, alerts);
  emitDashboard(stats);
}

eventsRouter.get('/', async (req, res) => {
  const { camera_id, severity, event_type, limit = '100' } = req.query;
  const filter: Record<string, string> = {};
  if (camera_id) filter.camera_id = String(camera_id);
  if (severity) filter.severity = String(severity);
  if (event_type) filter.event_type = String(event_type);

  const events = await EventModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .lean();

  res.json(events);
});

eventsRouter.post('/', async (req, res) => {
  const receivedAt = Date.now();
  const body = req.body;

  const event: StoreEvent = {
    event_id: body.event_id || `EVT_${uuidv4().slice(0, 8).toUpperCase()}`,
    event_type: body.event_type,
    camera_id: body.camera_id || 'CAM_01',
    person_id: body.person_id,
    timestamp: body.timestamp || new Date().toISOString(),
    confidence: body.confidence ?? body.confidence_score,
    severity: normalizeSeverity(body.severity),
    message: body.message,
    count: body.count,
    coordinates: body.coordinates,
  };

  if (!event.event_type) {
    res.status(400).json({ error: 'event_type is required' });
    return;
  }

  if (body.ai_processing_ms != null) {
    runtimeMetrics.ai_processing_ms = Number(body.ai_processing_ms);
  }
  if (body.fps != null) {
    runtimeMetrics.fps = Number(body.fps);
  }
  if (body.queue_size != null) {
    runtimeMetrics.queue_size = Number(body.queue_size);
  }

  if (event.event_type === 'occupancy_update' && event.count != null) {
    setOccupancy(event.count);
  }

  const eventTime = new Date(event.timestamp).getTime();
  recordIngestion(Math.max(0, receivedAt - (Number.isFinite(eventTime) ? eventTime : receivedAt)));

  try {
    await EventModel.create(event);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code !== 11000) throw err;
  }

  emitEvent(event);
  await maybeCreateAlert(event);
  await broadcastDashboard();

  res.status(201).json({ ok: true, event, occupancy: getOccupancy() });
});
