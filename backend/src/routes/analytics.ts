import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || '24h';
    
    // Determine data density based on requested scope
    let dataPoints = 24;
    let timeLabel = (idx: number) => `${idx.toString().padStart(2, '0')}:00`;
    
    if (range === '1h') {
      dataPoints = 12; // 5-minute ticks
      timeLabel = (idx: number) => {
        const time = new Date(Date.now() - (12 - idx) * 5 * 60 * 1000);
        return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      };
    } else if (range === '7d') {
      dataPoints = 7;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      timeLabel = (idx: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (7 - idx));
        return days[d.getDay()];
      };
    } else if (range === '30d') {
      dataPoints = 30;
      timeLabel = (idx: number) => {
        const d = new Date();
        d.setDate(d.getDate() - (30 - idx));
        return `${d.getMonth() + 1}/${d.getDate()}`;
      };
    }

    // 1. Footfall / unique tracks telemetry
    const footfallData = Array.from({ length: dataPoints }).map((_, idx) => {
      const label = timeLabel(idx);
      // Realistic high-traffic curves matching store business hours
      const hour = range === '24h' ? idx : 12; // default peak mid-day
      const scale = hour >= 8 && hour <= 21 ? Math.sin((hour - 8) / 13 * Math.PI) : 0.08;
      
      const store104 = Math.round(15 + scale * 90 + Math.random() * 12);
      const store208 = Math.round(5 + scale * 45 + Math.random() * 6);

      return {
        timestamp: label,
        "Metrotown Flagship": store104,
        "Downtown Express": store208,
        "Total Fleet": store104 + store208
      };
    });

    // 2. Zone dwell time distributions
    const zoneDwellData = [
      { name: "Entrance Vestibule", average_dwell_sec: 14, p95_dwell_sec: 42, count: 480 },
      { name: "Electronics Aisle", average_dwell_sec: 180, p95_dwell_sec: 540, count: 240 },
      { name: "Produce Section", average_dwell_sec: 94, p95_dwell_sec: 210, count: 320 },
      { name: "Checkout Aisles", average_dwell_sec: 145, p95_dwell_sec: 390, count: 410 },
      { name: "Restricted Warehouse", average_dwell_sec: 38, p95_dwell_sec: 95, count: 32 }
    ];

    // 3. Event types distribution
    const eventBreakdown = [
      { category: "Detections", count: 8402, percentage: 76.5 },
      { category: "Track Updates", count: 2140, percentage: 19.5 },
      { category: "Anomalies", count: 312, percentage: 2.8 },
      { category: "Critical Alerts", count: 128, percentage: 1.2 }
    ];

    // 4. Ingestion latency percentiles over time (ms)
    const pipelineLatency = Array.from({ length: dataPoints }).map((_, idx) => {
      const label = timeLabel(idx);
      const baseLag = 35 + Math.random() * 4;
      const spike = Math.random() > 0.90 ? 25 + Math.random() * 80 : 0; // random telemetry latency spike

      return {
        timestamp: label,
        p50: Math.round(baseLag),
        p95: Math.round(baseLag * 1.8 + spike),
        p99: Math.round(baseLag * 2.8 + spike * 1.6)
      };
    });

    // 5. Anomaly comparison by store
    const anomalyByStore = [
      { name: "Restricted Entry", "Metrotown Flagship": 8, "Downtown Express": 4 },
      { name: "Loitering", "Metrotown Flagship": 24, "Downtown Express": 18 },
      { name: "Crowd Surge", "Metrotown Flagship": 14, "Downtown Express": 3 },
      { name: "Unattended Object", "Metrotown Flagship": 6, "Downtown Express": 9 }
    ];

    res.json({
      footfall: footfallData,
      dwell: zoneDwellData,
      breakdown: eventBreakdown,
      latency: pipelineLatency,
      anomalies: anomalyByStore
    });

  } catch (error: any) {
    db.addLog('error', 'GET /api/analytics', 500, error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
