import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Scale, CheckCircle } from 'lucide-react';
import { cn } from './ui/utils';
import { WeightLivePayload } from '../types/socket';
import { useI18n } from '../contexts/I18nContext';

function formatKg(weight: WeightLivePayload | null): string {
  if (!weight) return '0.000';
  if (weight.unit === 'g') return (weight.weight / 1000).toFixed(3);
  return weight.weight.toFixed(3);
}

interface WeighingScaleCardProps {
  currentWeight: WeightLivePayload | null;
  isWeighing: boolean;
  confirming: boolean;
  canStart: boolean;
  confirmLabel: string;
  scaleName?: string | null;
  onStart: () => void;
  onConfirm: () => void;
}

export default function WeighingScaleCard({
  currentWeight,
  isWeighing,
  confirming,
  canStart,
  confirmLabel,
  scaleName,
  onStart,
  onConfirm,
}: WeighingScaleCardProps) {
  const { t } = useI18n();

  return (
    <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0] my-2">
      <div className="h-2 brown-gradient-animated relative overflow-hidden">
        <div className="absolute inset-0 brown-shimmer"></div>
      </div>
      <CardHeader className="bg-gradient-to-r from-[#f5ebe0]/80 to-[#efebe9]/80 pb-3 px-6 pt-6">
        <CardTitle className="flex items-center justify-between flex-wrap gap-3 leading-tight break-words">
          <span className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
              <Scale className="w-5 h-5 text-[#6d4c41]" />
            </div>
            <span className="text-base font-semibold text-gray-900 leading-tight">
              {scaleName ? `${t('scale')}: ${scaleName}` : t('currentWeight')}
            </span>
          </span>
          <span
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-semibold transition-all duration-300 leading-none',
              currentWeight?.stable
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700',
            )}
          >
            {currentWeight?.stable ? t('stable') : t('unstable')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-8 pb-8">
        <div className="space-y-8">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wider">
              {t('gross')} (kg)
            </p>
            <div className="text-5xl lg:text-6xl font-mono bg-gray-50 py-6 rounded-xl border border-gray-100 leading-none">
              <span className="text-gray-800">{formatKg(currentWeight)}</span>
              <span className="text-2xl text-gray-400 ml-2">kg</span>
            </div>
          </div>

          <div className="pt-4">
            {!isWeighing ? (
              <Button
                onClick={onStart}
                disabled={!canStart}
                className="w-full h-14 text-base brown-gradient-animated text-white font-bold shadow-lg brown-hover-effect brown-glow-animated disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                <Scale className="w-5 h-5 mr-2 flex-shrink-0" />
                {t('start')}
              </Button>
            ) : (
              <Button
                onClick={onConfirm}
                disabled={!canStart || confirming}
                className="w-full h-14 text-base bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-lg transition-all duration-200 disabled:opacity-50"
                size="lg"
              >
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                {confirming ? '...' : confirmLabel}
              </Button>
            )}
            {!canStart && !isWeighing && (
              <p className="text-xs text-amber-600 text-center mt-3 font-medium animate-pulse">
                {t('waitForStableWeight')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
