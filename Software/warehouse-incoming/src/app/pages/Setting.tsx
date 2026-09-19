import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Settings, Languages } from 'lucide-react';
import { toast } from 'sonner';

export default function Setting() {
  const { t, language, setLanguage } = useI18n();

  const handleLanguageChange = (newLanguage: 'id' | 'en') => {
    setLanguage(newLanguage);
    toast.success(language === 'id' ? 'Bahasa diubah' : 'Language changed');
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl mb-2">{t('setting')}</h1>
        <p className="text-gray-600">Pengaturan aplikasi</p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('setting')}
            </CardTitle>
            <CardDescription>
              Atur preferensi aplikasi Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Setting */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-indigo-600" />
                <Label className="text-base">{t('language')}</Label>
              </div>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">
                    <span className="flex items-center gap-2">
                      🇮🇩 {t('indonesian')}
                    </span>
                  </SelectItem>
                  <SelectItem value="en">
                    <span className="flex items-center gap-2">
                      🇬🇧 {t('english')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                {language === 'id' 
                  ? 'Pilih bahasa untuk antarmuka aplikasi'
                  : 'Select language for application interface'
                }
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Additional Settings Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">
                {language === 'id' ? 'Informasi Sistem' : 'System Information'}
              </h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Version: 1.0.0</p>
                <p>
                  {language === 'id' 
                    ? 'Sistem Dokumentasi Barang Incoming' 
                    : 'Incoming Goods Documentation System'
                  }
                </p>
                <p>
                  {language === 'id' 
                    ? 'Dengan integrasi WebSocket untuk penimbangan real-time' 
                    : 'With WebSocket integration for real-time weighing'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
