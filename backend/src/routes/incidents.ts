import { Router, Request, Response } from 'express';
import { db } from '../database';
import { Incident } from '../types';

const router = Router();

// Get list of incidents (security detections, loitering, intrusions)
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, severity } = req.query;
    let incidents = db.getIncidents();

    if (status) {
      incidents = incidents.filter(i => i.status === status);
    }
    if (severity) {
      incidents = incidents.filter(i => i.severity === severity);
    }

    res.json(incidents);
  } catch (error: any) {
    db.addLog('error', 'GET /api/incidents', 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update specific incident status or details (Triage Actions)
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, note } = req.body;

    const incidents = db.getIncidents();
    const incident = incidents.find(i => i.incident_id === id);

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // Optimistic / complete modifications
    if (status) incident.status = status;
    if (assigned_to) incident.assigned_to = assigned_to;

    if (note) {
      incident.operator_notes.push({
        timestamp: new Date().toISOString(),
        operator: assigned_to || "Operator Console",
        text: note
      });
    }

    db.updateIncident(incident);
    db.addLog('info', `PUT /api/incidents/${id}`, 200, `Incident ${id} triaged: status=${incident.status}, assigned=${incident.assigned_to}`);

    res.json({ success: true, incident });
  } catch (error: any) {
    db.addLog('error', `PUT /api/incidents/${req.params.id}`, 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
