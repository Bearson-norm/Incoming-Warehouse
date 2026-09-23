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
    return this.findLatest(
      preferredGatewayId,
      (snapshot) => this.isUsable(snapshot, maxAgeMs),
    );
  }

  getFreshStable(
    preferredGatewayId?: string | null,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  ): WeightSnapshot | null {
    return this.findLatest(
      preferredGatewayId,
      (snapshot) => this.isFreshStable(snapshot, maxAgeMs),
    );
  }

  private findLatest(
    preferredGatewayId: string | null | undefined,
    predicate: (snapshot: WeightSnapshot | undefined) => boolean,
  ): WeightSnapshot | null {
    if (preferredGatewayId) {
      const preferred = this.snapshots.get(preferredGatewayId);
      return predicate(preferred) ? preferred! : null;
    }

    const matching = [...this.snapshots.values()].filter((snapshot) =>
      predicate(snapshot),
    );
    if (matching.length === 0) {
      return null;
    }
    matching.sort((a, b) => b.ts - a.ts);
    return matching[0];
  }

  private isUsable(
    snapshot: WeightSnapshot | undefined,
    maxAgeMs: number,
  ): boolean {
    return this.isFreshStable(snapshot, maxAgeMs) && snapshot!.weight > 0;
  }

  private isFreshStable(
    snapshot: WeightSnapshot | undefined,
    maxAgeMs: number,
  ): boolean {
    if (!snapshot) {
      return false;
    }
    if (!snapshot.stable) {
      return false;
    }
    return Date.now() - snapshot.ts <= maxAgeMs;
  }
}
