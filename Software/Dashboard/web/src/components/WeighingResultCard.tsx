import { ConfirmResult } from '../types/weighing';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { useI18n } from '../contexts/I18nContext';
import { Printer, Upload } from 'lucide-react';

interface WeighingResultCardProps {
  result: ConfirmResult;
  onSendToOdoo?: () => void;
  sending?: boolean;
  onPrint?: () => void;
}

export default function WeighingResultCard({
  result,
  onSendToOdoo,
  sending,
  onPrint,
}: WeighingResultCardProps) {
  const { t } = useI18n();
  const status = result.weightStatus?.toLowerCase();
  const passed = status === 'pass';
  const local = status === 'local' || result.weighingMethod === 'internal';
  const showSend =
    result.weighingMethod === 'internal' && !result.syncedToOdoo && onSendToOdoo;

  return (
    <Card
      className={cn(
        'mb-6 border-2 shadow-md',
        passed
          ? 'border-green-300 bg-green-50'
          : local
            ? 'border-[#d7ccc8] bg-[#fff8f0]'
            : 'border-red-300 bg-red-50',
      )}
    >
      <CardContent className="pt-6 pb-6 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider">
          {passed ? t('weightPass') : local ? t('savedLocally') : t('weightFail')}
          {result.packageUid ? ` — ${result.packageUid}` : ''}
        </p>
        {result.message ? (
          <p className="text-sm text-gray-700">{result.message}</p>
        ) : null}
        <p className="text-xs text-gray-600 font-mono">
          {t('gross')}: {result.grossWeight ?? '-'} kg · {t('tare')}:{' '}
          {result.tareWeight ?? '-'} kg · {t('net')}: {result.netWeight ?? '-'} kg
        </p>
        <p className="text-xs text-[#8d6e63]">
          {result.syncedToOdoo ? t('sentToOdoo') : t('localOnly')}
        </p>
        {(showSend || onPrint) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {showSend && (
              <Button
                onClick={onSendToOdoo}
                disabled={sending}
                className="h-9 brown-gradient-animated text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                {sending ? '...' : t('sendToOdoo')}
              </Button>
            )}
            {onPrint && (
              <Button variant="outline" onClick={onPrint} className="h-9 border-[#d7ccc8]">
                <Printer className="w-4 h-4 mr-2" />
                {t('print')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
