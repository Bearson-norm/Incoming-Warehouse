import { ConflictException } from '@nestjs/common';
import { SessionsService } from './sessions.service';

describe('SessionsService incoming LPN rules', () => {
  const makeService = (existing: Array<{ id: number; packageUid: string }> = []) => {
    const prisma = {
      weighSession: {
        findMany: jest.fn().mockResolvedValue(existing),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 10,
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
    const cloudSync = { scheduleTraceEvent: jest.fn() };
    const service = new SessionsService(
      prisma as any,
      {} as any,
      cloudSync as any,
    );
    return { service, prisma };
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
      labelMetadata: {
        referenceOdoo: 'WRMPM/IN/13010',
        batch: '11469',
        arrivalAt: '2026-03-01',
        expiredDate: '2027-03-01',
      },
    });

    const createArg = prisma.weighSession.create.mock.calls[0][0];
    const lpn = createArg.data.packageUid as string;
    expect(lpn).toMatch(
      /^[0-9A-F]{4}\d{4}-WRMPM\/IN\/13010-PMSTK00297-11469$/,
    );
    const meta = JSON.parse(createArg.data.labelMetadata as string);
    expect(meta.labelProductNumber).toBe(lpn);
    expect(meta.lpnUniqueSegment).toMatch(/^[0-9A-F]{4}\d{4}$/);
    expect(lpn.startsWith(`${meta.lpnUniqueSegment}-`)).toBe(true);
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
});
