import { Injectable } from '@nestjs/common';

export interface WeightSnapshot {
  gatewayId: string;
  readingId: string;
  weight: number;
  unit: string;
  stable: boolean;
  rawLine?: string;
  capturedAt: string;
  ts: number;
}

const DEFAULT_MAX_AGE_MS = 8000;

@Injectable()
export class WeightSnapshotStore {
  private readonly snapshots = new Map<string, WeightSnapshot>();

  set(snapshot: WeightSnapshot): void {
    this.snapshots.set(snapshot.gatewayId, snapshot);
  }

  get(gatewayId: string): WeightSnapshot | undefined {
    return this.snapshots.get(gatewayId);
  }

  listGatewayIds(): string[] {
    return [...this.snapshots.keys()];
  }

  getUsable(
    preferredGatewayId?: string | null,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  ): WeightSnapshot | null {
    if (preferredGatewayId) {
      const preferred = this.snapshots.get(preferredGatewayId);
      return this.isUsable(preferred, maxAgeMs) ? preferred! : null;
    }

    const usable = [...this.snapshots.values()].filter((s) =>
      this.isUsable(s, maxAgeMs),
    );
    if (usable.length === 0) {
      return null;
    }
    usable.sort((a, b) => b.ts - a.ts);
    return usable[0];
  }

  private isUsable(
    snapshot: WeightSnapshot | undefined,
    maxAgeMs: number,
  ): boolean {
    if (!snapshot) {
      return false;
    }
    if (!snapshot.stable) {
      return false;
    }
    if (!(snapshot.weight > 0)) {
      return false;
    }
    return Date.now() - snapshot.ts <= maxAgeMs;
  }
}
