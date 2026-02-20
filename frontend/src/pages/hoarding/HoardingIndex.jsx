import React, { useEffect, useState } from 'react';
import axios from '../../utils/axiosInstance';
import CommonTable from '../../components/CommonTable';
import { Link, useNavigate } from 'react-router-dom';

export default function HoardingIndex() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/hoarding/');
        if (!mounted) return;
        // expect response.data to be array or { data: [...] }
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setData(list);
      } catch (e) {
        setError(e?.response?.data?.message || e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetch();
    return () => { mounted = false; };
  }, []);

  const columns = [
    { key: '_idx', label: 'Sr. No', render: (row, idx) => idx + 1 },
    { key: 'hoardingName', label: 'Name', render: (row) => row.hoardingName || '-' },
    { key: 'hoardingCode', label: 'Code', render: (row) => row.hoardingCode || '-' },
    { key: 'type', label: 'Type', render: (row) => row.type || '-' },
    { key: 'city', label: 'City', render: (row) => (row.location?.city?.name || row.location?.city || '-') },
    { key: 'state', label: 'State', render: (row) => (row.location?.state?.name || row.location?.state || '-') },
    { key: 'pricePerDay', label: 'Price/Day', render: (row) => row.pricePerDay != null ? row.pricePerDay : '-' },
    { key: 'status', label: 'Status', render: (row) => row.status || '-' },
    {
      key: 'actions', label: 'Action', render: (row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => navigate(`/hoarding/${row._id || row.id}`)}>View</button>
          <Link className="btn" to={`/hoarding/edit/${row._id || row.id}`}>Edit</Link>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Hoardings</h2>
        <div>
          <Link className="btn primary" to="/hoarding/create">+ New Hoarding</Link>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

      <CommonTable
        columns={columns}
        data={data}
        initialPageSize={10}
        pageSizes={[5,10,20,50]}
      />

      {loading && <div style={{ marginTop: 12 }}>Loading...</div>}
    </div>
  );
}
