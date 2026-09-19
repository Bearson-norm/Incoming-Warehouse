import { io, Socket } from 'socket.io-client';
import { WeightLivePayload } from '../types/socket';

const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron === true;

const SOCKET_URL = isElectron
  ? 'http://localhost:4123'
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:4123');

let socket: Socket | null = null;
let connectedToken: string | null = null;

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}

export const connectSocket = (): Socket => {
  const token = getAuthToken();
  if (socket && connectedToken === token && socket.connected) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: token ? { token } : {},
  });
  connectedToken = token;
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectedToken = null;
};

export const subscribeToWeight = (
  callback: (payload: WeightLivePayload) => void,
): (() => void) => {
  const s = connectSocket();
  s.on('weight:live', callback);
  return () => {
    s.off('weight:live', callback);
  };
};

export default socket;
