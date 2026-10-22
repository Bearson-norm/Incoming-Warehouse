import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface OdooLocalFallbackDialogProps {
  open: boolean;
  error: string;
  saving: boolean;
  onCancel: () => void;
  onSaveLocal: () => void;
}

export default function OdooLocalFallbackDialog({
  open,
  error,
  saving,
  onCancel,
  onSaveLocal,
}: OdooLocalFallbackDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            {t('odooSaveFailedTitle')}
          </DialogTitle>
          <DialogDescription>{t('odooSaveFailedDescription')}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={onSaveLocal} disabled={saving}>
            {saving ? t('savingLocal') : t('saveLocal')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
