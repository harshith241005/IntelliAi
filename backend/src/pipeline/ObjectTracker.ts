import { CCTVEvent } from '../types';

export interface ActiveTrack {
  track_id: string;
  store_id: string;
  camera_id: string;
  zone_id: string;
  label: 'person' | 'shopping_cart' | 'backpack' | 'unattended_box';
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number; // velocity x
  vy: number; // velocity y
  speed: number; // px/s
  dwell_start: number; // timestamp ms
  last_update: number; // timestamp ms
  path: { x: number; y: number }[];
  is_stationary: boolean;
  stationary_timer?: number; // timestamp ms
}

export class ObjectTracker {
  private activeTracks: Map<string, ActiveTrack> = new Map();
  private trackCounter = 0;

  constructor() {}

  // Determine the zone ID based on 2D coordinates in store schematic space [0-100, 0-100]
  public getZoneId(x: number, y: number, storeId: string, cameraId: string): string {
    if (cameraId === 'cam_104_04') {
      return 'zone_restricted_loading';
    }
    if (cameraId === 'cam_208_02') {
      return 'zone_restricted_safe';
    }

    // Default layout mapping
    if (x <= 30 && y <= 35) return 'zone_entrance';
    if (x >= 70 && y >= 70) return 'zone_restricted_loading';
    if (y >= 65) return 'zone_checkout';
    return 'zone_aisle_electronics';
  }

  // Generate a random path starting point
  private createNewTrack(storeId: string, cameraId: string): ActiveTrack {
    this.trackCounter++;
    const trackId = `track_${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
    
    // Choose entity type
    const rand = Math.random();
    let label: ActiveTrack['label'] = 'person';
    if (rand > 0.85) {
      label = 'shopping_cart';
    } else if (rand > 0.75) {
      label = 'backpack';
    }

    // Start near entrances or borders
    const isEntrance = Math.random() > 0.4;
    let x = isEntrance ? 10 + Math.random() * 15 : Math.random() * 100;
    let y = isEntrance ? 10 + Math.random() * 15 : Math.random() * 10;

    // Loading dock camera starts in dock
    if (cameraId === 'cam_104_04') {
      x = 40 + Math.random() * 20;
      y = 10 + Math.random() * 20;
    } else if (cameraId === 'cam_208_02') {
      x = 50 + Math.random() * 10;
      y = 50 + Math.random() * 10;
    }

    const zoneId = this.getZoneId(x, y, storeId, cameraId);
    const now = Date.now();

    // Random speeds
    const speedMultiplier = label === 'person' ? 1.5 : 0.8;
    const vx = (Math.random() - 0.5) * 4 * speedMultiplier;
    const vy = (Math.random() - 0.2) * 5 * speedMultiplier; // general downward/forward direction

    return {
      track_id: trackId,
      store_id: storeId,
      camera_id: cameraId,
      zone_id: zoneId,
      label,
      x,
      y,
      width: label === 'person' ? 24 : 32,
      height: label === 'person' ? 48 : 32,
      vx,
      vy,
      speed: Math.sqrt(vx * vx + vy * vy) * 10,
      dwell_start: now,
      last_update: now,
      path: [{ x, y }],
      is_stationary: false
    };
  }

  // Update track positions statefully. Simulates movements, velocity, boundaries, transitions
  public tick(storeCameras: { store_id: string; camera_id: string }[]): CCTVEvent[] {
    const events: CCTVEvent[] = [];
    const now = Date.now();

    // 1. Maintain active track counts. If too low, spawn new tracks
    const targetTracks = storeCameras.length * 3; // ~3 tracks per active camera
    if (this.activeTracks.size < targetTracks && Math.random() > 0.3) {
      const targetCam = storeCameras[Math.floor(Math.random() * storeCameras.length)];
      const track = this.createNewTrack(targetCam.store_id, targetCam.camera_id);
      this.activeTracks.set(track.track_id, track);
    }

    // 2. Update each active track
    for (const [trackId, track] of this.activeTracks.entries()) {
      // Simulate slight drift/steering behavior
      if (Math.random() > 0.85 && !track.is_stationary) {
        track.vx += (Math.random() - 0.5) * 2;
        track.vy += (Math.random() - 0.5) * 2;
      }

      // If entity is stationary (e.g. loitering at checkout or loading, or unattended backpack)
      const dwellTime = (now - track.dwell_start) / 1000;
      if (track.label === 'backpack' && dwellTime > 8 && Math.random() > 0.95 && !track.is_stationary) {
        // Backpack gets "unattended" - drops a stationary box object, person continues
        track.is_stationary = true;
        track.vx = 0;
        track.vy = 0;
        track.stationary_timer = now;
      } else if (track.zone_id === 'zone_checkout' && dwellTime > 5 && Math.random() > 0.92 && !track.is_stationary) {
        // Customer standing still in checkout queue
        track.is_stationary = true;
        track.vx = 0;
        track.vy = 0;
        track.stationary_timer = now;
      }

      // Resume moving some stationary tracks
      if (track.is_stationary && track.label !== 'backpack' && Math.random() > 0.95 && (now - (track.stationary_timer || 0)) > 6000) {
        track.is_stationary = false;
        track.vx = (Math.random() - 0.5) * 4;
        track.vy = 1 + Math.random() * 4;
        track.dwell_start = now; // reset dwell timer on move
      }

      // Advance coordinates
      if (!track.is_stationary) {
        track.x += track.vx;
        track.y += track.vy;
      }

      // Enforce frame borders. If out of screen bounds, delete track
      if (track.x < 0 || track.x > 100 || track.y < 0 || track.y > 100) {
        this.activeTracks.delete(trackId);
        continue;
      }

      // Calculate speed
      track.speed = track.is_stationary ? 0 : Math.round(Math.sqrt(track.vx * track.vx + track.vy * track.vy) * 8);
      track.last_update = now;
      track.path.push({ x: Math.round(track.x), y: Math.round(track.y) });
      
      // Limit path history size
      if (track.path.length > 25) {
        track.path.shift();
      }

      // Check zone transition
      const newZoneId = this.getZoneId(track.x, track.y, track.store_id, track.camera_id);
      const zoneTransitioned = newZoneId !== track.zone_id;
      
      if (zoneTransitioned) {
        track.zone_id = newZoneId;
        track.dwell_start = now; // reset dwell on transition
      }

      // Generate a structured track_update event
      const trackEvent: CCTVEvent = {
        event_id: `evt_trk_${Math.random().toString(36).substr(2, 9)}`,
        event_type: 'track_update',
        timestamp: new Date(now).toISOString(),
        store_id: track.store_id,
        camera_id: track.camera_id,
        zone_id: track.zone_id,
        track_id: track.track_id,
        confidence: 0.88 + Math.random() * 0.1,
        severity: 'info',
        payload: {
          coordinates: {
            x: Math.round(track.x),
            y: Math.round(track.y),
            width: track.width,
            height: track.height
          },
          label: track.label,
          speed: track.speed,
          dwell_time: Math.round(dwellTime),
          path: track.path,
          is_stationary: track.is_stationary,
          message: `${track.label} is active in ${track.zone_id.replace('zone_', '')} (speed: ${track.speed}px/s, dwell: ${Math.round(dwellTime)}s)`
        },
        schema_version: "1.2.0"
      };

      events.push(trackEvent);
    }

    return events;
  }

  public getTracks(): ActiveTrack[] {
    return Array.from(this.activeTracks.values());
  }

  public forceIntrusion(storeId: string, cameraId: string): CCTVEvent {
    const trackId = `track_intruder_${Math.floor(100 + Math.random() * 900)}`;
    const now = Date.now();
    
    // Position intruder directly inside restricted safety zone [80-100, 80-100]
    const track: ActiveTrack = {
      track_id: trackId,
      store_id: storeId,
      camera_id: cameraId,
      zone_id: cameraId === 'cam_208_02' ? 'zone_restricted_safe' : 'zone_restricted_loading',
      label: 'person',
      x: 88,
      y: 85,
      width: 24,
      height: 48,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      speed: 2,
      dwell_start: now,
      last_update: now,
      path: [{ x: 88, y: 85 }],
      is_stationary: false
    };

    this.activeTracks.set(track.track_id, track);

    return {
      event_id: `evt_force_${Math.random().toString(36).substr(2, 9)}`,
      event_type: 'detection',
      timestamp: new Date(now).toISOString(),
      store_id: storeId,
      camera_id: cameraId,
      zone_id: track.zone_id,
      track_id: track.track_id,
      confidence: 0.99,
      severity: 'critical',
      payload: {
        coordinates: { x: 88, y: 85, width: 24, height: 48 },
        label: 'person',
        message: 'Security detection: Person isolated inside restricted area border'
      },
      schema_version: "1.2.0"
    };
  }
}
