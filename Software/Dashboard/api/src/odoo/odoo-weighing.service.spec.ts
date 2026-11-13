import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OdooWeighingService } from './odoo-weighing.service';

describe('OdooWeighingService incoming contract', () => {
  const settings = {
    getBaseUrl: () => 'http://odoo.test',
    getApiKey: () => 'secret-key',
  };

  const successBody = {
    success: true,
    log_id: 182,
    package_id: 475,
    gross_weight: 208.6,
    tare_weight: 8.5,
    net_weight: 200.1,
    weight_status: 'pass',
    message: 'Weight recorded',
  };

  const makeService = () => {
    const service = new OdooWeighingService(settings as any);
    (service as any).retryDelaysMs = [0, 0, 0];
    return service;
  };

  const fetchMock = () => global.fetch as jest.Mock;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function ok(body: unknown = successBody) {
    fetchMock().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => body,
    });
  }

  function postedBody() {
    const init = fetchMock().mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-FOOM-IoT-Key': 'secret-key',
    });
    return JSON.parse(String(init.body));
  }

  it('sends the legacy body when no incoming contract is given', async () => {
    ok();
    const service = makeService();
    await service.submitWeight('RM-1', 10.126);
    expect(postedBody()).toEqual({
      package_uid: 'RM-1',
      gross_weight: 10.1,
    });
  });

  it('sends inbound with weighing_type and device_uid', async () => {
    ok();
    const service = makeService();
    await service.submitWeight('RM-BOMRM-VB01-000168', 208.6, {
      weighingType: 'inbound',
      deviceUid: 'SCALE-INB-01',
    });
    expect(postedBody()).toEqual({
      package_uid: 'RM-BOMRM-VB01-000168',
      gross_weight: 208.6,
      weighing_type: 'inbound',
      device_uid: 'SCALE-INB-01',
    });
  });

  it('sends qc_sample with tare and without package_uid when LPN is blank', async () => {
    ok({
      ...successBody,
      weight_status: undefined,
      weighing_type: 'qc_sample',
      message: 'QC sample weight recorded',
    });
    const service = makeService();
    await service.submitWeight('', 0.62, {
      weighingType: 'qc_sample',
      deviceUid: 'SCALE-QC-01',
      qcRecord: 'INBOUND-QC-000161',
      tareWeightG: 0.12,
    });
    expect(postedBody()).toEqual({
      gross_weight: 0.6,
      weighing_type: 'qc_sample',
      device_uid: 'SCALE-QC-01',
      qc_reference: 'INBOUND-QC-000161',
      qc_record: 'INBOUND-QC-000161',
      tare_weight: 0.1,
    });
  });

  it('sends production with package_uid', async () => {
    ok({ ...successBody, weight_status: 'pending' });
    const service = makeService();
    await service.submitWeight('RM-1', 108.1, {
      weighingType: 'production',
      deviceUid: 'SCALE-PROD-01',
    });
    expect(postedBody()).toEqual({
      package_uid: 'RM-1',
      gross_weight: 108.1,
      weighing_type: 'production',
      device_uid: 'SCALE-PROD-01',
    });
  });

  it('does not retry HTTP 409 or 422', async () => {
    fetchMock().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: 'already weighed' }),
    });
    const service = makeService();
    await expect(
      service.submitWeight('RM-1', 1, {
        weighingType: 'inbound',
        deviceUid: 'SCALE-INB-01',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    fetchMock().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ success: false, error: 'missing tare' }),
    });
    await expect(
      service.submitWeight('RM-1', 1, {
        weighingType: 'inbound',
        deviceUid: 'SCALE-INB-01',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it('retries a 500 once and then accepts the next response', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'busy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => successBody,
      });
    const service = makeService();
    await expect(
      service.submitWeight('RM-1', 1, {
        weighingType: 'inbound',
        deviceUid: 'SCALE-INB-01',
      }),
    ).resolves.toMatchObject({ log_id: 182 });
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it('retries network failures up to 3 times', async () => {
    fetchMock().mockRejectedValue(new Error('network down'));
    const service = makeService();
    await expect(service.submitWeight('RM-1', 1)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(fetchMock()).toHaveBeenCalledTimes(4);
  });

  it('rejects qc tare that is not below gross', async () => {
    const service = makeService();
    await expect(
      service.submitWeight('RM-1', 0.1, {
        weighingType: 'qc_sample',
        deviceUid: 'SCALE-QC-01',
        qcRecord: 'QC-1',
        tareWeightG: 0.1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('converts kilograms and pounds to grams', () => {
    const service = makeService();
    expect(service.toGrossWeightG(1000, 'g')).toBe(1000);
    expect(service.toGrossWeightG(1, 'kg')).toBe(1000);
    expect(service.toGrossWeightG(1, 'lb')).toBeCloseTo(453.59237);
  });
});
