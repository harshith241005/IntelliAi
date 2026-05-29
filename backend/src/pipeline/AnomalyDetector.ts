import { CCTVEvent, Incident } from '../types';
import { ActiveTrack } from './ObjectTracker';
import { db } from '../database';

export class AnomalyDetector {
  private reportedAnomalies: Set<string> = new Set(); // track_id + anomaly_type to prevent event flooding
  
  constructor() {}

  public processTracks(tracks: ActiveTrack[]): CCTVEvent[] {
    const events: CCTVEvent[] = [];
    const now = Date.now();
    const zoneCounts: { [key: string]: number } = {};

    // Group track counts by zone
    tracks.forEach(t => {
      const key = `${t.store_id}:${t.camera_id}:${t.zone_id}`;
      zoneCounts[key] = (zoneCounts[key] || 0) + 1;
    });

    for (const track of tracks) {
      const dwellSeconds = Math.round((now - track.dwell_start) / 1000);
      const isRestrictedZone = track.zone_id.includes('restricted');
      
      // 1. Check: Restricted Zone Intrusion (Critical)
      if (isRestrictedZone) {
        const anomalyKey = `${track.track_id}:restricted_entry`;
        if (!this.reportedAnomalies.has(anomalyKey)) {
          this.reportedAnomalies.add(anomalyKey);

          const anomalyScore = 0.92 + Math.random() * 0.07;
          const correlationId = `corr_${Math.random().toString(36).substr(2, 9)}`;

          const anomalyEvent: CCTVEvent = {
            event_id: `evt_anom_${Math.random().toString(36).substr(2, 9)}`,
            event_type: 'anomaly',
            timestamp: new Date().toISOString(),
            store_id: track.store_id,
            camera_id: track.camera_id,
            zone_id: track.zone_id,
            track_id: track.track_id,
            confidence: 0.98,
            severity: 'critical',
            anomaly_score: anomalyScore,
            correlation_id: correlationId,
            payload: {
              message: `Intrusion alert: Unauthorized entry detected in ${track.zone_id.replace('zone_restricted_', '')} zone.`,
              coordinates: { x: Math.round(track.x), y: Math.round(track.y), width: track.width, height: track.height },
              label: track.label,
              dwell_time: dwellSeconds,
              anomaly_type: "Restricted Zone Entry"
            },
            schema_version: "1.2.0"
          };

          events.push(anomalyEvent);

          // Add to DB Incidents
          const newIncident: Incident = {
            incident_id: `inc_${Math.floor(100 + Math.random() * 900)}`,
            store_id: track.store_id,
            camera_id: track.camera_id,
            zone_id: track.zone_id,
            anomaly_type: "Restricted Zone Entry",
            score: parseFloat(anomalyScore.toFixed(2)),
            severity: "critical",
            status: "open",
            sla_started_at: new Date().toISOString(),
            operator_notes: [],
            correlated_event_ids: [anomalyEvent.event_id],
            track_id: track.track_id,
            media_url: "https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=600&auto=format&fit=crop"
          };
          db.addIncident(newIncident);
        }
      }

      // 2. Check: Loitering Suspicion (Warning)
      if (dwellSeconds > 15 && !isRestrictedZone) {
        const anomalyKey = `${track.track_id}:loitering`;
        if (!this.reportedAnomalies.has(anomalyKey)) {
          this.reportedAnomalies.add(anomalyKey);

          const anomalyScore = 0.70 + Math.random() * 0.15;
          const correlationId = `corr_${Math.random().toString(36).substr(2, 9)}`;

          const anomalyEvent: CCTVEvent = {
            event_id: `evt_anom_${Math.random().toString(36).substr(2, 9)}`,
            event_type: 'anomaly',
            timestamp: new Date().toISOString(),
            store_id: track.store_id,
            camera_id: track.camera_id,
            zone_id: track.zone_id,
            track_id: track.track_id,
            confidence: 0.85,
            severity: 'warning',
            anomaly_score: anomalyScore,
            correlation_id: correlationId,
            payload: {
              message: `Suspicious loitering: ${track.label} stationary in ${track.zone_id.replace('zone_', '')} for >15s.`,
              coordinates: { x: Math.round(track.x), y: Math.round(track.y), width: track.width, height: track.height },
              label: track.label,
              dwell_time: dwellSeconds,
              anomaly_type: "Loitering Suspicion"
            },
            schema_version: "1.2.0"
          };

          events.push(anomalyEvent);

          const newIncident: Incident = {
            incident_id: `inc_${Math.floor(100 + Math.random() * 900)}`,
            store_id: track.store_id,
            camera_id: track.camera_id,
            zone_id: track.zone_id,
            anomaly_type: "Loitering Suspicion",
            score: parseFloat(anomalyScore.toFixed(2)),
            severity: "warning",
            status: "open",
            sla_started_at: new Date().toISOString(),
            operator_notes: [],
            correlated_event_ids: [anomalyEvent.event_id],
            track_id: track.track_id,
            media_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600&auto=format&fit=crop"
          };
          db.addIncident(newIncident);
        }
      }

      // 3. Check: Unattended Object (Critical)
      if (track.label === 'backpack' && track.is_stationary && dwellSeconds > 10) {
        const anomalyKey = `${track.track_id}:unattended`;
        if (!this.reportedAnomalies.has(anomalyKey)) {
          // Verify if there are any moving person tracks nearby (within distance threshold)
          const personsNearby = tracks.filter(t => 
            t.label === 'person' && 
            t.track_id !== track.track_id && 
            Math.sqrt(Math.pow(t.x - track.x, 2) + Math.pow(t.y - track.y, 2)) < 15
          );

          if (personsNearby.length === 0) {
            this.reportedAnomalies.add(anomalyKey);
            const anomalyScore = 0.88 + Math.random() * 0.08;
            const correlationId = `corr_${Math.random().toString(36).substr(2, 9)}`;

            const anomalyEvent: CCTVEvent = {
              event_id: `evt_anom_${Math.random().toString(36).substr(2, 9)}`,
              event_type: 'anomaly',
              timestamp: new Date().toISOString(),
              store_id: track.store_id,
              camera_id: track.camera_id,
              zone_id: track.zone_id,
              track_id: track.track_id,
              confidence: 0.94,
              severity: 'critical',
              anomaly_score: anomalyScore,
              correlation_id: correlationId,
              payload: {
                message: `Unattended item: stationary ${track.label} abandoned in ${track.zone_id.replace('zone_', '')} zone.`,
                coordinates: { x: Math.round(track.x), y: Math.round(track.y), width: track.width, height: track.height },
                label: track.label,
                dwell_time: dwellSeconds,
                anomaly_type: "Unattended Object"
              },
              schema_version: "1.2.0"
            };

            events.push(anomalyEvent);

            const newIncident: Incident = {
              incident_id: `inc_${Math.floor(100 + Math.random() * 900)}`,
              store_id: track.store_id,
              camera_id: track.camera_id,
              zone_id: track.zone_id,
              anomaly_type: "Unattended Object",
              score: parseFloat(anomalyScore.toFixed(2)),
              severity: "critical",
              status: "open",
              sla_started_at: new Date().toISOString(),
              operator_notes: [],
              correlated_event_ids: [anomalyEvent.event_id],
              track_id: track.track_id,
              media_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop"
            };
            db.addIncident(newIncident);
          }
        }
      }
    }

    // 4. Check: Crowd Surge (Warning)
    for (const [key, count] of Object.entries(zoneCounts)) {
      if (count >= 5) { // 5 or more tracks in same zone
        const [storeId, cameraId, zoneId] = key.split(':');
        const anomalyKey = `${cameraId}:${zoneId}:crowdsurge:${Math.floor(now / 60000)}`; // limit to once per minute per zone
        
        if (!this.reportedAnomalies.has(anomalyKey)) {
          this.reportedAnomalies.add(anomalyKey);

          const anomalyScore = 0.72 + Math.random() * 0.12;

          const anomalyEvent: CCTVEvent = {
            event_id: `evt_anom_${Math.random().toString(36).substr(2, 9)}`,
            event_type: 'anomaly',
            timestamp: new Date().toISOString(),
            store_id: storeId,
            camera_id: cameraId,
            zone_id: zoneId,
            confidence: 0.90,
            severity: 'warning',
            anomaly_score: anomalyScore,
            payload: {
              message: `High density warning: Crowd surge detected in ${zoneId.replace('zone_', '')} (${count} active objects).`,
              count,
              anomaly_type: "Crowd Surge"
            },
            schema_version: "1.2.0"
          };

          events.push(anomalyEvent);

          // Purge after 2 mins to allow refiring if crowd persists
          setTimeout(() => {
            this.reportedAnomalies.delete(anomalyKey);
          }, 120000);
        }
      }
    }

    return events;
  }
}
