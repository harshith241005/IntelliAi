import { Router } from 'express';
import { AlertModel } from '../db.js';
import { emitAlert } from '../socket.js';

export const alertsRouter = Router();

alertsRouter.get('/', async (req, res) => {
  const { status } = req.query;
  const filter: Record<string, string> = {};
  if (status) filter.status = String(status);

  const alerts = await AlertModel.find(filter)
    .sort({ created_at: -1 })
    .limit(50)
    .lean();
  res.json(alerts);
});

alertsRouter.patch('/:alertId', async (req, res) => {
  const { status } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const alert = await AlertModel.findOneAndUpdate(
    { alert_id: req.params.alertId },
    { status },
    { new: true }
  );

  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }

  emitAlert(alert.toObject() as import('../types.js').AlertDoc);
  res.json(alert);
});

alertsRouter.post('/:alertId/silence', async (req, res) => {
  const alert = await AlertModel.findOneAndUpdate(
    { alert_id: req.params.alertId },
    { status: 'silenced' },
    { new: true }
  );
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  res.json(alert);
});

alertsRouter.post('/:alertId/investigate', async (req, res) => {
  const alert = await AlertModel.findOneAndUpdate(
    { alert_id: req.params.alertId },
    { status: 'investigating' },
    { new: true }
  );
  if (!alert) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  res.json(alert);
});
