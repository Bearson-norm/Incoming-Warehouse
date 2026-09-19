import { useState, useEffect } from 'react';
import api from '../services/api';
import './Explore.css';

interface Reading {
  id: number;
  weight: number;
  unit: string;
  stable: boolean;
  capturedAt: string;
  session: {
    id: number;
    vendor: { name: string };
    packaging: { name: string };
    user: { username: string };
  };
}

export default function Explore() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    vendorId: '',
    packagingId: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50,
  });
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVendors();
    loadReadings();
  }, []);

  useEffect(() => {
    loadReadings();
  }, [filters]);

  const loadVendors = async () => {
    try {
      const response = await api.get('/vendors');
      setVendors(response.data);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const loadReadings = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: filters.page,
        limit: filters.limit,
      };
      if (filters.vendorId) params.vendorId = filters.vendorId;
      if (filters.packagingId) params.packagingId = filters.packagingId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/readings', { params });
      setReadings(response.data.data);
      setMeta(response.data.meta);
    } catch (error) {
      console.error('Failed to load readings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="explore p-6 lg:p-8 max-w-[1400px] mx-auto bg-[#f5ebe0] min-h-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl brown-gradient-animated flex items-center justify-center shadow-md brown-glow-animated">
            <span className="text-white brown-pulse-animated text-xl">🔍</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#3e2723]">Explore</h1>
            <p className="text-sm text-[#8d6e63]">Jelajahi data penimbangan</p>
          </div>
        </div>
      </div>

      <div className="filters mb-8">
        <div className="filter-group">
          <label>Vendor</label>
          <select
            value={filters.vendorId}
            onChange={(e) => handleFilterChange('vendorId', e.target.value)}
          >
            <option value="">All</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Per Page</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', +e.target.value)}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="readings-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Packaging</th>
                  <th>Weight</th>
                  <th>Status</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="no-data">
                      No readings found
                    </td>
                  </tr>
                ) : (
                  readings.map((reading) => (
                    <tr key={reading.id}>
                      <td>{formatDate(reading.capturedAt)}</td>
                      <td>{reading.session.vendor.name}</td>
                      <td>{reading.session.packaging.name}</td>
                      <td>
                        {(reading.weight * 1000).toFixed(2)} g
                      </td>
                      <td>
                        <span className={`status ${reading.stable ? 'stable' : 'unstable'}`}>
                          {reading.stable ? 'STABLE' : 'UNSTABLE'}
                        </span>
                      </td>
                      <td>{reading.session.user.username}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta && (
            <div className="pagination">
              <button
                disabled={filters.page === 1}
                onClick={() => handleFilterChange('page', filters.page - 1)}
              >
                Previous
              </button>
              <span>
                Page {meta.page} of {meta.totalPages} (Total: {meta.total})
              </span>
              <button
                disabled={filters.page >= meta.totalPages}
                onClick={() => handleFilterChange('page', filters.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
