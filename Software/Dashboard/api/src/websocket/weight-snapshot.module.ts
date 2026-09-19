import { Module } from '@nestjs/common';
import { WeightSnapshotStore } from './weight-snapshot.store';

@Module({
  providers: [WeightSnapshotStore],
  exports: [WeightSnapshotStore],
})
export class WeightSnapshotModule {}
