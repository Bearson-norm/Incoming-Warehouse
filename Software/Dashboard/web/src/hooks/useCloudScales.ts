import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { CloudScale } from '../types/weighing';

const LAST_SCALE_KEY = 'last-selected-scale-id';

export function useCloudScales() {
  const [scales, setScales] = useState<CloudScale[]>([]);
  const [scaleId, setScaleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<CloudScale[]>('/cloud/scales');
      setScales(data);
      const saved = localStorage.getItem(LAST_SCALE_KEY);
      if (saved && data.some((s) => String(s.id) === saved)) {
        setScaleId(saved);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Failed to load scales from cloud';
      setError(message);
      setScales([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScales();
  }, [loadScales]);

  const selectScale = (value: string) => {
    setScaleId(value);
    if (value) {
      localStorage.setItem(LAST_SCALE_KEY, value);
    }
  };

  const selectedScale = scales.find((s) => String(s.id) === scaleId);

  return {
    scales,
    scaleId,
    setScaleId: selectScale,
    selectedScale,
    loading,
    error,
    reload: loadScales,
  };
}
