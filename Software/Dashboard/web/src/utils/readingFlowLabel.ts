import { parseLabelMetadata, Reading } from '../types/weighing';

/** Label for Alur column: Incoming / QC sample / Production / Intrans. */
export function readingFlowLabelKey(reading: {
  session: Pick<Reading['session'], 'flowType' | 'weighingMethod' | 'labelMetadata'>;
}): string {
  if (reading.session.flowType === 'intrans') {
    return 'intrans';
  }
  if (reading.session.weighingMethod === 'odoo') {
    const meta = parseLabelMetadata(reading.session.labelMetadata);
    if (meta.odooWeighingType === 'qc_sample') {
      return 'odooProcessQc';
    }
    if (meta.odooWeighingType === 'production') {
      return 'odooProcessProduction';
    }
  }
  return 'incoming';
}
