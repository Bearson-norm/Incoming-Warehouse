import { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Scale, TrendingUp, LayoutDashboard } from 'lucide-react';
import api from '../services/api';

type TimePeriod = 'today' | 'week' | 'month';

interface StatsResponse {
  sessionCount: number;
  totalNetWeight: number;
  byLabel: Record<string, { count: number; weight: number }>;
}

export default function Home() {
  const { t } = useI18n();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const [stats, setStats] = useState<StatsResponse>({
    sessionCount: 0,
    totalNetWeight: 0,
    byLabel: {},
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, [timePeriod]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      switch (timePeriod) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      const response = await api.get('/readings/stats', {
        params: { startDate: startDate.toISOString() },
      });
      setStats({
        sessionCount: response.data.sessionCount || 0,
        totalNetWeight: response.data.totalNetWeight || 0,
        byLabel: response.data.byLabel || {},
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats({ sessionCount: 0, totalNetWeight: 0, byLabel: {} });
    } finally {
      setLoading(false);
    }
  };

  const vendorChartData = Object.entries(stats.byLabel).map(([name, data]) => ({
    name,
    weight: parseFloat((data.weight * 1000).toFixed(2)),
    count: data.count,
  }));

  const COLORS = ['#8d6e63', '#a1887f', '#bcaaa4', '#d7ccc8', '#efebe9', '#c8a882'];

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <LayoutDashboard className="w-5 h-5 text-white brown-pulse-animated" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">{t('dashboard')}</h1>
            <p className="text-sm text-[#8d6e63]">{t('weighingResults')}</p>
          </div>
        </div>
      </div>

      {/* Time Period Selection */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2 text-[#5d4037]">{t('selectTimePeriod')}</label>
        <Select value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
          <SelectTrigger className="w-full sm:w-56 h-10 brown-hover-effect border-[#d7ccc8] focus:border-[#8d6e63] focus:ring-[#8d6e63]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#fff8f0] border-[#d7ccc8]">
            <SelectItem value="today" className="hover:bg-[#f5ebe0] focus:bg-[#f5ebe0] text-[#3e2723]">{t('today')}</SelectItem>
            <SelectItem value="week" className="hover:bg-[#f5ebe0] focus:bg-[#f5ebe0] text-[#3e2723]">{t('thisWeek')}</SelectItem>
            <SelectItem value="month" className="hover:bg-[#f5ebe0] focus:bg-[#f5ebe0] text-[#3e2723]">{t('thisMonth')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0] my-2">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-[#5d4037] leading-tight break-words">{t('totalRecords')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
              <Package className="h-4 w-4 text-[#6d4c41]" />
            </div>
          </CardHeader>
          <CardContent className="pb-6 pt-2">
            <div className="text-3xl font-bold text-[#3e2723] mb-1.5 leading-tight break-words">
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-[#8d6e63] border-t-transparent rounded-full animate-spin" />
              ) : (
                stats.sessionCount
              )}
            </div>
            <p className="text-xs text-[#8d6e63] leading-relaxed break-words">{t('recordDocuments').toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0] my-2">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-[#5d4037] leading-tight break-words">{t('totalWeight')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
              <Scale className="h-4 w-4 text-[#6d4c41]" />
            </div>
          </CardHeader>
          <CardContent className="pb-6 pt-2">
            <div className="text-3xl font-bold text-[#3e2723] mb-1.5 leading-tight break-words">
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-[#8d6e63] border-t-transparent rounded-full animate-spin" />
              ) : (
                `${(stats.totalNetWeight * 1000).toFixed(2)} g`
              )}
            </div>
            <p className="text-xs text-[#8d6e63] leading-relaxed break-words">{t('net').toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0] my-2 sm:col-span-2 lg:col-span-1">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-[#5d4037] leading-tight break-words">{t('byVendor')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
              <TrendingUp className="h-4 w-4 text-[#6d4c41]" />
            </div>
          </CardHeader>
          <CardContent className="pb-6 pt-2">
            <div className="text-3xl font-bold text-[#3e2723] mb-1.5 leading-tight break-words">
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-[#8d6e63] border-t-transparent rounded-full animate-spin" />
              ) : (
                Object.keys(stats.byLabel).length
              )}
            </div>
            <p className="text-xs text-[#8d6e63] leading-relaxed break-words">{t('vendor').toLowerCase()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart */}
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0] my-2">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold text-[#3e2723] leading-tight break-words">{t('byVendor')} — {t('weight')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-6 px-6">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#8d6e63] border-t-transparent" />
              </div>
            ) : vendorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8d5c4" />
                  <XAxis dataKey="name" tick={{ fill: '#8d6e63', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8d6e63', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff8f0', 
                      border: '1px solid #d7ccc8',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(109, 76, 65, 0.1)',
                      fontSize: '13px',
                      color: '#3e2723',
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '13px', color: '#3e2723' }} />
                  <Bar dataKey="weight" fill="#8d6e63" name={t('weight') + ' (g)'} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-[#a1887f]">
                <Package className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium text-[#8d6e63] break-words">{t('noRecords')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="border-2 border-[#d7ccc8] shadow-md overflow-visible brown-hover-effect bg-[#fff8f0] my-2">
          <div className="h-2 brown-gradient-animated relative overflow-hidden">
            <div className="absolute inset-0 brown-shimmer"></div>
          </div>
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-base font-semibold text-[#3e2723] leading-tight break-words">{t('byVendor')} — {t('totalRecords')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 pb-6 px-6">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#8d6e63] border-t-transparent" />
              </div>
            ) : vendorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={vendorChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={95}
                    fill="#8d6e63"
                    dataKey="count"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {vendorChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff8f0', 
                      border: '1px solid #d7ccc8',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(109, 76, 65, 0.1)',
                      fontSize: '13px',
                      color: '#3e2723',
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-[#a1887f]">
                <TrendingUp className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium text-[#8d6e63] break-words">{t('noRecords')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
