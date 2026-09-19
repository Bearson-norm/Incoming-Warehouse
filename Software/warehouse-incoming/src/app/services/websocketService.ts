// Mock WebSocket Service untuk simulasi penimbangan
// Dalam produksi, ini akan terhubung ke gateway program yang sebenarnya

export type WeightData = {
  gross: number;
  stable: boolean;
  timestamp: number;
};

export class WebSocketService {
  private listeners: ((data: WeightData) => void)[] = [];
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Simulasi data penimbangan yang berubah-ubah
  private simulateWeight(): WeightData {
    const baseWeight = 25; // Base weight around 25kg
    const variation = this.isRunning ? Math.random() * 10 : Math.random() * 0.5;
    const gross = parseFloat((baseWeight + variation).toFixed(2));
    const stable = variation < 0.3; // Stabil jika variasi kecil

    return {
      gross,
      stable,
      timestamp: Date.now(),
    };
  }

  connect() {
    console.log('WebSocket connected (mock)');
    
    // Simulasi data yang datang setiap 500ms
    this.interval = setInterval(() => {
      const data = this.simulateWeight();
      this.listeners.forEach(listener => listener(data));
    }, 500);
  }

  disconnect() {
    console.log('WebSocket disconnected (mock)');
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.listeners = [];
    this.isRunning = false;
  }

  subscribe(callback: (data: WeightData) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Metode untuk mengubah mode penimbangan (untuk simulasi)
  setRunningMode(running: boolean) {
    this.isRunning = running;
  }
}

export const websocketService = new WebSocketService();
