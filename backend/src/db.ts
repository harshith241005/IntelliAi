import mongoose from 'mongoose';

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/store_intelligence';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGO_URI);
  console.log('[db] Connected to MongoDB');
}

const eventSchema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true },
    event_type: { type: String, required: true, index: true },
    camera_id: { type: String, required: true, index: true },
    person_id: Number,
    timestamp: { type: String, required: true, index: true },
    confidence: Number,
    severity: { type: String, required: true, index: true },
    message: String,
    count: Number,
    coordinates: {
      x: Number,
      y: Number,
    },
  },
  { versionKey: false }
);

const cameraSchema = new mongoose.Schema(
  {
    camera_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, default: 'active' },
    source: String,
  },
  { versionKey: false }
);

const alertSchema = new mongoose.Schema(
  {
    alert_id: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    status: { type: String, default: 'active', index: true },
    camera_id: { type: String, required: true },
    severity: { type: String, required: true },
    message: { type: String, required: true },
    created_at: { type: String, required: true },
    event_id: String,
  },
  { versionKey: false }
);

export const EventModel = mongoose.model('Event', eventSchema, 'events');
export const CameraModel = mongoose.model('Camera', cameraSchema, 'cameras');
export const AlertModel = mongoose.model('Alert', alertSchema, 'alerts');
