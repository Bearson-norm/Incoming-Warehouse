import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { WeighingRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Package, Scale, TrendingUp } from 'lucide-react';

type TimePeriod = 'today' | 'week' | 'month' | 'custom';

export default function Home() {
  const { t } = useI18n();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const [records, setRecords] = useState<WeighingRecord[]>([]);

  useEffect(() => {
    const savedRecords = localStorage.getItem('weighingRecords');
    if (savedRecords) {
      setRecords(JSON.parse(savedRecords));
    }
  }, []);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return records.filter(record => {
      const recordDate = new Date(record.date);
      
      switch (timePeriod) {
        case 'today':
          return recordDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return recordDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return recordDate >= monthAgo;
        default:
          return true;
      }
    });
  }, [records, timePeriod]);

  const stats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const totalWeight = filteredRecords.reduce((sum, r) => sum + r.net, 0);
    
    // Group by vendor
    const byVendor = filteredRecords.reduce((acc, record) => {
      if (!acc[record.vendorName]) {
        acc[record.vendorName] = { count: 0, weight: 0 };
      }
      acc[record.vendorName].count += 1;
      acc[record.vendorName].weight += record.net;
      return acc;
    }, {} as Record<string, { count: number; weight: number }>);

    return { totalRecords, totalWeight, byVendor };
  }, [filteredRecords]);

  const vendorChartData = Object.entries(stats.byVendor).map(([name, data]) => ({
    name,
    weight: parseFloat(data.weight.toFixed(2)),
    count: data.count,
  }));

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl mb-2">{t('dashboard')}</h1>
        <p className="text-gray-600">{t('weighingResults')}</p>
      </div>

      {/* Time Period Selection */}
      <div className="mb-6">
        <label className="block text-sm mb-2">{t('selectTimePeriod')}</label>
        <Select value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('today')}</SelectItem>
            <SelectItem value="week">{t('thisWeek')}</SelectItem>
            <SelectItem value="month">{t('thisMonth')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">{t('totalRecords')}</CardTitle>
            <Package className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalRecords}</div>
            <p className="text-xs text-gray-500 mt-1">
              {t('recordDocuments').toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">{t('totalWeight')}</CardTitle>
            <Scale className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalWeight.toFixed(2)} kg</div>
            <p className="text-xs text-gray-500 mt-1">
              {t('net').toLowerCase()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">{t('byVendor')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{Object.keys(stats.byVendor).length}</div>
            <p className="text-xs text-gray-500 mt-1">
              {t('vendor').toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('byVendor')} - {t('weight')}</CardTitle>
          </CardHeader>
          <CardContent>
            {vendorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="weight" fill="#6366f1" name={t('weight') + ' (kg)'} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                {t('noRecords')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('byVendor')} - {t('totalRecords')}</CardTitle>
          </CardHeader>
          <CardContent>
            {vendorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={vendorChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {vendorChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                {t('noRecords')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
