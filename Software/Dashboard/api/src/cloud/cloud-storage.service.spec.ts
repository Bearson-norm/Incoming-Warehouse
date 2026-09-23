import { CloudStorageService } from './cloud-storage.service';

describe('CloudStorageService', () => {
  it('updates the existing cloud reading when an idempotent retry carries Odoo data', async () => {
    const cloudScale = { findFirst: jest.fn().mockResolvedValue({ id: 7 }) };
    const cloudWeighReading = {
      create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      findFirst: jest.fn().mockResolvedValue({ id: 41 }),
      update: jest.fn().mockResolvedValue({ id: 41, odooLogId: 99 }),
    };
    const service = new CloudStorageService({
      cloudScale,
      cloudWeighReading,
    } as any);

    const result = await service.ingestReading({
      scaleId: 7,
      scaleName: 'Scale A',
      username: 'operator',
      stationId: 'station-a',
      localReadingId: 12,
      eventId: 'station-a:reading-12-odoo',
      packageUid: 'lpn-1',
      flowType: 'incoming',
      weighingMethod: 'internal',
      weight: 10,
      odooLogId: 99,
      capturedAt: '2026-09-23T08:00:00.000Z',
    });

    expect(result).toEqual({ id: 41, odooLogId: 99 });
    expect(cloudWeighReading.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 41 },
        data: expect.objectContaining({ odooLogId: 99 }),
      }),
    );
  });

  it('normalizes exact LPN queries before querying storage', async () => {
    const cloudWeighReading = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const service = new CloudStorageService({
      cloudWeighReading,
      vendor: { findMany: jest.fn().mockResolvedValue([]) },
      packaging: { findMany: jest.fn().mockResolvedValue([]) },
      rmCode: { findMany: jest.fn().mockResolvedValue([]) },
    } as any);

    await service.queryReadings({ packageUid: ' lpn-1 ' });

    expect(cloudWeighReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { packageUid: 'LPN-1' } }),
    );
  });
});
