import { ConflictException } from '@nestjs/common';
import { CloudMasterDataService } from './cloud-master-data.service';

describe('CloudMasterDataService', () => {
  it('rejects stale revisions before changing master data', async () => {
    const tx = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({
          cloudId: 'vendor-1',
          name: 'Current',
          revision: 3,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new CloudMasterDataService(
      prisma as any,
      { isRemoteMode: () => false } as any,
      {} as any,
    );

    await expect(
      service.update(
        'vendor',
        'vendor-1',
        { expectedRevision: 2, reason: 'audit correction', name: 'New' },
        { username: 'admin' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('writes the update and append-only audit event in one transaction', async () => {
    const before = { cloudId: 'vendor-1', name: 'Old', revision: 1 };
    const after = { cloudId: 'vendor-1', name: 'New', revision: 2 };
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      vendor: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(before)
          .mockResolvedValueOnce(after),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      masterDataAuditEvent: { create: auditCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new CloudMasterDataService(
      prisma as any,
      { isRemoteMode: () => false } as any,
      {} as any,
    );

    await service.update(
      'vendor',
      'vendor-1',
      { expectedRevision: 1, reason: 'legal name update', name: 'New' },
      { username: 'admin', stationId: 'station-a' },
    );

    expect(tx.vendor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cloudId: 'vendor-1', revision: 1 },
        data: expect.objectContaining({ revision: { increment: 1 } }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityCloudId: 'vendor-1',
          revision: 2,
          reason: 'legal name update',
        }),
      }),
    );
  });
});
