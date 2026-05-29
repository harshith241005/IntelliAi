import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { AlertDoc, DashboardStats, StoreEvent } from './types.js';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] Client connected ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitEvent(event: StoreEvent): void {
  io?.emit('event', event);
}

export function emitAlert(alert: AlertDoc): void {
  io?.emit('alert', alert);
}

export function emitDashboard(stats: DashboardStats): void {
  io?.emit('dashboard', stats);
}
