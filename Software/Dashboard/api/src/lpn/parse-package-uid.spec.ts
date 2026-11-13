import { parsePackageUidInput } from './parse-package-uid';

describe('parsePackageUidInput', () => {
  it('uppercases a plain LPN and trims spaces', () => {
    expect(parsePackageUidInput(' rm-abc-01 ')).toEqual({
      kind: 'ok',
      uid: 'RM-ABC-01',
    });
  });

  it('reads uid from an LPN QR without uppercasing the JSON first', () => {
    const raw = '{"type":"lpn","uid":"RM-BOMRM-VB01-000168","pkg_id":475}';
    expect(parsePackageUidInput(raw)).toEqual({
      kind: 'ok',
      uid: 'RM-BOMRM-VB01-000168',
    });
  });

  it('rejects SKU and batch QR codes', () => {
    expect(parsePackageUidInput('{"type":"sku","barcode":"ABC"}').kind).toBe(
      'reject',
    );
    expect(parsePackageUidInput('{"type":"batch","lot":"L1"}').kind).toBe(
      'reject',
    );
  });

  it('rejects invalid JSON and an LPN QR without uid', () => {
    expect(parsePackageUidInput('{not-json}').kind).toBe('reject');
    expect(parsePackageUidInput('{"type":"lpn"}').kind).toBe('reject');
  });

  it('treats blank input as empty', () => {
    expect(parsePackageUidInput('   ')).toEqual({ kind: 'empty' });
  });
});
