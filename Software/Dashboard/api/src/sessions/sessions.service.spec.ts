import { BadRequestException, ConflictException } from '@nestjs/common';
import { SessionsService } from './sessions.service';

describe('SessionsService incoming LPN rules', () => {
  const internalMeta = {
    referenceOdoo: 'WRMPM/IN/13010',
    poNumber: 'PO-TEST-001',
    batch: '11469',
    arrivalAt: '2026-03-01',
    expiredDate: '2027-03-01',
  };

  const makeService = (existing: Array<{ id: number; packageUid: string }> = []) => {
    let nextId = 10;
    const prisma: any = {
      weighSession: {
        findMany: jest.fn().mockResolvedValue(existing),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: nextId++,
            ...data,
            vendor: null,
            packaging: null,
            rmCode: null,
            user: { id: 1, username: 'tester' },
          }),
        ),
      },
      packaging: {
        findUnique: jest.fn().mockResolvedValue({
          id: 2,
          vendorId: 1,
          tareWeight: 0.5,
        }),
      },
      rmCode: {
        findUnique: jest.fn().mockResolvedValue({
          id: 3,
          vendorId: 1,
          code: 'PMSTK00297',
        }),
      },
    };
    prisma.$transaction = jest.fn(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    const cloudSync = { scheduleTraceEvent: jest.fn() };
    const service = new SessionsService(
      prisma as any,
      {} as any,
      cloudSync as any,
    );
    return { service, prisma, cloudSync };
  };

  const baseDto = {
    flowType: 'incoming',
    weighingMethod: 'odoo',
    scaleId: 1,
    scaleName: 'Scale A',
    autosaveEnabled: false,
  } as const;

  it('normalizes an incoming LPN to uppercase before saving', async () => {
    const { service, prisma } = makeService();

    await service.create(1, { ...baseDto, packageUid: ' rm-abc-01 ' });

    expect(prisma.weighSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ packageUid: 'RM-ABC-01' }),
      }),
    );
  });

  it('rejects an incoming LPN already used with different casing', async () => {
    const { service } = makeService([{ id: 4, packageUid: 'RM-ABC-01' }]);

    await expect(
      service.create(1, { ...baseDto, packageUid: 'rm-abc-01' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('generates LPN for internal incoming from metadata and RM code', async () => {
    const { service, prisma } = makeService();

    await service.create(1, {
      ...baseDto,
      weighingMethod: 'internal',
      vendorId: 1,
      packagingId: 2,
      rmCodeId: 3,
      labelMetadata: internalMeta,
    });

    const createArg = prisma.weighSession.create.mock.calls[0][0];
    const lpn = createArg.data.packageUid as string;
    expect(lpn).toBe('WRMPM/IN/13010-PMSTK00297-11469');
    const meta = JSON.parse(createArg.data.labelMetadata as string);
    expect(meta.labelProductNumber).toBe(lpn);
    expect(meta.lpnUniqueSegment).toBeUndefined();
  });

  it('allows intrans to reuse an incoming LPN', async () => {
    const { service, prisma } = makeService([{ id: 4, packageUid: 'RM-ABC-01' }]);

    await service.create(1, {
      ...baseDto,
      flowType: 'intrans',
      packageUid: 'rm-abc-01',
    });

    expect(prisma.weighSession.findMany).not.toHaveBeenCalled();
    expect(prisma.weighSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flowType: 'intrans',
          packageUid: 'RM-ABC-01',
        }),
      }),
    );
  });

  it('stores an LPN QR uid for incoming Odoo', async () => {
    const { service, prisma } = makeService();

    await service.create(1, {
      ...baseDto,
      packageUid: '{"type":"lpn","uid":"rm-bomrm-vb01-000168","pkg_id":475}',
    });

    expect(prisma.weighSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          packageUid: 'RM-BOMRM-VB01-000168',
        }),
      }),
    );
  });

  it('rejects a SKU QR on incoming Odoo', async () => {
    const { service } = makeService();

    await expect(
      service.create(1, {
        ...baseDto,
        packageUid: '{"type":"sku","barcode":"ABC"}',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows production to reuse an inbound LPN', async () => {
    const { service, prisma } = makeService([{ id: 4, packageUid: 'RM-ABC-01' }]);

    await service.create(1, {
      ...baseDto,
      packageUid: 'rm-abc-01',
      labelMetadata: { odooWeighingType: 'production' },
    });

    expect(prisma.weighSession.findMany).not.toHaveBeenCalled();
    expect(prisma.weighSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ packageUid: 'RM-ABC-01' }),
      }),
    );
  });

  it('creates a QC sample session without an LPN', async () => {
    const { service, prisma } = makeService();

    await service.create(1, {
      ...baseDto,
      labelMetadata: {
        odooWeighingType: 'qc_sample',
        qcRecord: 'INBOUND-QC-000161',
        sampleTareG: 120,
      },
    });

    const createArg = prisma.weighSession.create.mock.calls[0][0];
    expect(createArg.data.packageUid).toBeNull();
    const meta = JSON.parse(createArg.data.labelMetadata as string);
    expect(meta).toMatchObject({
      odooWeighingType: 'qc_sample',
      qcRecord: 'INBOUND-QC-000161',
      sampleTareG: 120,
    });
  });

  it('rejects batch quantity outside internal incoming', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.create(1, { ...baseDto, batchQuantity: 4 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(1, {
        ...baseDto,
        flowType: 'intrans',
        packageUid: 'RM-ABC-01',
        batchQuantity: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(1, {
        ...baseDto,
        weighingMethod: 'internal',
        batchQuantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(1, {
        ...baseDto,
        weighingMethod: 'internal',
        batchQuantity: 31,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.weighSession.create).not.toHaveBeenCalled();
  });

  it('creates one active session and pending siblings with unique LPNs', async () => {
    const { service, prisma, cloudSync } = makeService();

    const created = await service.create(1, {
      ...baseDto,
      weighingMethod: 'internal',
      vendorId: 1,
      packagingId: 2,
      rmCodeId: 3,
      batchQuantity: 4,
      labelMetadata: internalMeta,
    });

    expect(prisma.weighSession.create).toHaveBeenCalledTimes(4);
    const lpns = prisma.weighSession.create.mock.calls.map(
      (call) => call[0].data.packageUid as string,
    );
    expect(lpns).toEqual([
      'WRMPM/IN/13010-PMSTK00297-11469-1',
      'WRMPM/IN/13010-PMSTK00297-11469-2',
      'WRMPM/IN/13010-PMSTK00297-11469-3',
      'WRMPM/IN/13010-PMSTK00297-11469-4',
    ]);
    expect(new Set(lpns).size).toBe(4);
    const drafts = prisma.weighSession.create.mock.calls.map((call) => call[0].data);
    expect(drafts[0].queueStatus).toBe('active');
    expect(drafts[0].batchSequence).toBe(1);
    expect(drafts.slice(1).every((draft) => draft.queueStatus === 'pending')).toBe(
      true,
    );
    expect(new Set(drafts.map((draft) => draft.batchGroupId)).size).toBe(1);
    expect(drafts[0].batchSize).toBe(4);
    if (!('batchQueue' in created) || !created.batchQueue) {
      throw new Error('expected a batch queue');
    }
    expect(created.batchQueue).toHaveLength(4);
    expect(
      created.batchQueue.filter((item) => item.queueStatus === 'active'),
    ).toHaveLength(1);
    expect(created.queueStatus).toBe('active');
    expect(cloudSync.scheduleTraceEvent).toHaveBeenCalledTimes(4);
  });

  it('promotes the next pending batch item after a save', async () => {
    const { service } = makeService();
    const rows = [
      {
        id: 1,
        packageUid: 'AAAA2026-REF-RM-1',
        batchSequence: 1,
        queueStatus: 'done',
        batchGroupId: 'group-1',
        endedAt: new Date(),
      },
      {
        id: 2,
        packageUid: 'BBBB2026-REF-RM-1',
        batchSequence: 2,
        queueStatus: 'pending',
        batchGroupId: 'group-1',
        endedAt: null,
      },
      {
        id: 3,
        packageUid: 'CCCC2026-REF-RM-1',
        batchSequence: 3,
        queueStatus: 'pending',
        batchGroupId: 'group-1',
        endedAt: null,
      },
    ];
    const tx = {
      weighSession: {
        findFirst: jest.fn().mockImplementation(async () => {
          return (
            rows
              .filter((row) => row.queueStatus === 'pending' && row.endedAt == null)
              .sort((a, b) => (a.batchSequence ?? 0) - (b.batchSequence ?? 0))[0] ??
            null
          );
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const row = rows.find((item) => item.id === where.id);
          Object.assign(row, data);
          return row;
        }),
        findMany: jest.fn().mockImplementation(async () => {
          return [...rows].sort(
            (a, b) => (a.batchSequence ?? 0) - (b.batchSequence ?? 0),
          );
        }),
      },
    };

    const advance = await service.promoteNextBatchItem(tx as any, {
      id: 1,
      batchGroupId: 'group-1',
    });

    expect(rows[1].queueStatus).toBe('active');
    expect(rows[2].queueStatus).toBe('pending');
    expect(advance.nextSession?.id).toBe(2);
    expect(advance.batchQueue.map((item) => item.queueStatus)).toEqual([
      'done',
      'active',
      'pending',
    ]);
    expect(
      advance.batchQueue.filter((item) => item.queueStatus === 'active'),
    ).toHaveLength(1);
  });

  it('looks up the active session without treating a normal session as pending', async () => {
    const { service, prisma } = makeService();

    await service.findActive(1, 'incoming');

    expect(prisma.weighSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 1,
          endedAt: null,
          flowType: 'incoming',
          OR: [{ queueStatus: null }, { queueStatus: 'active' }],
        }),
      }),
    );
  });

  it('ends the active item and every pending sibling on reset', async () => {
    const { service, prisma } = makeService();
    prisma.weighSession.findUnique
      .mockResolvedValueOnce({
        id: 2,
        userId: 1,
        batchGroupId: 'group-1',
      })
      .mockResolvedValueOnce({
        id: 2,
        userId: 1,
        batchGroupId: 'group-1',
        endedAt: new Date(),
      });

    await service.end(2, 1);

    expect(prisma.weighSession.updateMany).toHaveBeenCalledWith({
      where: {
        batchGroupId: 'group-1',
        userId: 1,
        endedAt: null,
        queueStatus: { in: ['active', 'pending'] },
      },
      data: { endedAt: expect.any(Date) },
    });
    expect(prisma.weighSession.update).not.toHaveBeenCalled();
  });

  it('allows internal incoming to use a cross-vendor packaging when the selected vendor does not have it', async () => {
    const { service, prisma } = makeService();
    prisma.packaging.findUnique.mockResolvedValueOnce({
      id: 99,
      vendorId: 2,
      tareWeight: 1.25,
    });

    await service.create(1, {
      ...baseDto,
      weighingMethod: 'internal',
      vendorId: 1,
      packagingId: 99,
      rmCodeId: 3,
      labelMetadata: internalMeta,
    });

    expect(prisma.weighSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: 1,
          packagingId: 99,
          rmCodeId: 3,
        }),
      }),
    );
  });
});
