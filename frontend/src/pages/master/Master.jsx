import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CommonTable from '../../components/CommonTable';
import CommonModel from '../../components/CommonModel';
import axiosInstance from '../../utils/axiosInstance';
import { Eye, Edit, MoreVertical, Trash2, Plus } from 'lucide-react';



const Master = () => {
  const [tab, setTab] = useState('country');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', countryId: '', stateId: '', cityId: '' });
  const [relatedOptions, setRelatedOptions] = useState([]);
  const [countriesList, setCountriesList] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);

  const apiConfig = {
    country: { path: 'country/', key: 'countries' },
    state: { path: '/state/', key: 'states' },
    city: { path: '/city/', key: 'cities' },
    area: { path: '/area/', key: 'areas' },
  };

  useEffect(() => {
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Fetch data from backend when tab changes
  useEffect(() => {
    if (!tab) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const config = apiConfig[tab];
        const response = await axiosInstance.get(config.path);
        const responseData = response.data?.[config.key] ?? [];
        setData(Array.isArray(responseData) ? responseData : []);
        // fetch related master lists for lookup (used to display related names)
        if (tab !== 'country') {
          try {
            const [cResp, sResp, ciResp] = await Promise.all([
              axiosInstance.get(apiConfig.country.path),
              axiosInstance.get(apiConfig.state.path),
              axiosInstance.get(apiConfig.city.path),
            ]);
            const countries = cResp.data?.[apiConfig.country.key] ?? [];
            const states = sResp.data?.[apiConfig.state.key] ?? [];
            const cities = ciResp.data?.[apiConfig.city.key] ?? [];
            setCountriesList(Array.isArray(countries) ? countries : []);
            setStatesList(Array.isArray(states) ? states : []);
            setCitiesList(Array.isArray(cities) ? cities : []);
          } catch (e) {
            // non-fatal: lookup lists are optional
            setCountriesList([]);
            setStatesList([]);
            setCitiesList([]);
          }
        } else {
          // clear lookup lists for country tab
          setCountriesList([]);
          setStatesList([]);
          setCitiesList([]);
        }
      } catch (error) {
        console.error(`Error fetching ${tab} data:`, error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tab]);

  // Define columns for CommonTable
  const columns = [
    { key: 'srNo', label: 'Sr. No.', render: (row) => (row._rowIndex ?? 0) + 1 },
    { key: 'name', label: 'Name' },
    {
      key: 'related',
      label: 'Related',
      render: (row) => {
        // choose relation according to current table
        let related = null;
        if (tab === 'state') related = row.country;
        else if (tab === 'city') related = row.state;
        else if (tab === 'area') related = row.city;
        else related = null;

        if (!related) return '-';
        if (typeof related === 'object') return related.name || '-';

        // related is an id string — try to lookup from fetched lists
        const id = related;
        let list = [];
        if (tab === 'state') list = countriesList;
        else if (tab === 'city') list = statesList;
        else if (tab === 'area') list = citiesList;
        const found = list.find(x => (x._id || x.id) === id);
        return found ? found.name : '-';
      }
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <div className="action-cell" ref={menuRef} style={{ position: 'relative' }}>
          {/* <button
            aria-haspopup="menu"
            className="icon-btn"
            onClick={() => setOpenMenu(openMenu === row._id ? null : row._id)}
          >
            <MoreVertical size={16} />
          </button>
          {openMenu === row._id && (
            <div className="action-menu" role="menu"> */}
          {/* <Link
                className="action-item"
                to={`/master/${tab}/view/${row._id}`}
                role="menuitem"
              >
                <Eye size={14} /> <span>View</span>
              </Link> */}
          {/* <Link
                className="action-item"
                to={`/master/${tab}/edit/${row._id}`}
                role="menuitem"
              >
                <Edit size={14} /> 
                 <span>Edit</span>
              </Link> */}

          <button style={{ border: "none", backgroundColor: "#ffffff" , color: "#1F9FDB"}} className="action-item" role="menuitem" onClick={() => openEdit(row)}>
            <Edit size={16} />
          </button>

          {/* <button className="action-item" role="menuitem" onClick={() => handleDelete(row._id)}>
                <Trash2 size={14}/> <span>Delete</span>
              </button> */}
          {/* </div>
          )} */}
        </div>
      )
    }
  ];

  // const handleDelete = async (id) => {
  //   if (!confirm(`Are you sure you want to delete this ${tab}?`)) return;
  //   try {
  //     const config = apiConfig[tab];
  //     await axiosInstance.delete(`${config.path}${id}`);
  //     setData(data.filter(item => item._id !== id));
  //     setOpenMenu(null);
  //   } catch (error) {
  //     console.error(`Error deleting ${tab}:`, error);
  //     alert('Failed to delete. Please try again.');
  //   }
  // };

  const relatedMap = { state: 'country', city: 'state', area: 'city' };

  async function openEdit(row) {
    setOpenMenu(null);
    setEditingItem(row);
    // populate form
    const name = row.name || '';
    // Fetch master lists for cascading selects
    try {
      const [cResp, sResp, ciResp] = await Promise.all([
        axiosInstance.get(apiConfig.country.path),
        axiosInstance.get(apiConfig.state.path),
        axiosInstance.get(apiConfig.city.path),
      ]);
      const countries = cResp.data?.[apiConfig.country.key] ?? [];
      const states = sResp.data?.[apiConfig.state.key] ?? [];
      const cities = ciResp.data?.[apiConfig.city.key] ?? [];
      setCountriesList(Array.isArray(countries) ? countries : []);
      setStatesList(Array.isArray(states) ? states : []);
      setCitiesList(Array.isArray(cities) ? cities : []);

      const getId = v => (v && typeof v === 'object' ? (v._id || v.id) : v || '');
      let countryId = '';
      let stateId = '';
      let cityId = '';

      if (tab === 'state') {
        countryId = getId(row.country);
      } else if (tab === 'city') {
        stateId = getId(row.state);
        // derive country from state object or list
        const stateObj = row.state && typeof row.state === 'object' ? row.state : states.find(s => (s._id || s.id) === stateId);
        countryId = getId(stateObj?.country);
      } else if (tab === 'area') {
        cityId = getId(row.city);
        const cityObj = row.city && typeof row.city === 'object' ? row.city : cities.find(c => (c._id || c.id) === cityId);
        stateId = getId(cityObj?.state);
        const stateObj2 = cityObj?.state && typeof cityObj.state === 'object' ? cityObj.state : states.find(s => (s._id || s.id) === stateId);
        countryId = getId(stateObj2?.country);
      }

      setEditForm({ name, countryId, stateId, cityId });
    } catch (e) {
      console.error('Failed to fetch related lists for edit', e);
      setCountriesList([]);
      setStatesList([]);
      setCitiesList([]);
      setEditForm({ name, countryId: '', stateId: '', cityId: '' });
    }
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingItem) return;
    const cfg = apiConfig[tab];
    const payload = { name: editForm.name };
    // set relationship ids according to tab
    if (tab === 'state') payload.country = editForm.countryId || '';
    if (tab === 'city') payload.state = editForm.stateId || '';
    if (tab === 'area') payload.city = editForm.cityId || '';
    try {
      const resp = await axiosInstance.put(`${cfg.path}${editingItem._id}`, payload);
      const updated = resp.data?.[cfg.key]?.[0] ?? resp.data ?? resp.data?.data ?? null;
      // try to update local list: replace by _id
      setData(prev => prev.map(it => (it._id === editingItem._id ? (updated || { ...it, ...payload }) : it)));
      setEditOpen(false);
      setEditingItem(null);
    } catch (e) {
      console.error('Failed to save edit', e);
      alert('Save failed');
    }
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingItem(null);
  }

  return (
    
      <div className="master-page">
        <div className="page-header">
          <h2>Master</h2>
          <div className="page-actions">
            {tab ? (
              <Link to={`/master/${tab}/create`} className="btn primary"><Plus size={14} />Add {tab.slice(0, 1).toUpperCase() + tab.slice(1)}</Link>
            ) : (
              <span className="muted">Select a tab to manage</span>
            )}
          </div>
        </div>

        <div className="master-tabs" role="tablist" aria-label="Master types">
          {['country', 'state', 'city', 'area'].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={"tab" + (tab === t ? ' active' : '')}
              onClick={() => setTab(t)}
            >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        <div className="master-table">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p>Loading {tab} data...</p>
            </div>
          ) : (
            <CommonTable
              columns={columns}
              data={Array.isArray(data) ? data.map((item, index) => ({ ...item, _rowIndex: index })) : []}
              initialPageSize={10}
              pageSizes={[10, 20, 50, 100]}
            />
          )}
        </div>
        {/* Edit modal */}
        <CommonModel
          open={editOpen}
          title={`Edit ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
          onClose={closeEdit}
          onPrimary={saveEdit}
          primaryLabel="Save"
          secondaryLabel="Cancel"
          onSecondary={closeEdit}
          size="md"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ fontWeight: 600 }}>Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />

            {/* Cascading selects for relationships */}
            {tab === 'state' && (
              <>
                <label style={{ fontWeight: 600 }}>Country</label>
                <select value={editForm.countryId || ''} onChange={(e) => setEditForm(f => ({ ...f, countryId: e.target.value }))}>
                  <option value="">-- choose country --</option>
                  {countriesList.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                </select>
              </>
            )}

            {tab === 'city' && (
              <>
                <label style={{ fontWeight: 600 }}>Country</label>
                <select value={editForm.countryId || ''} onChange={(e) => setEditForm(f => ({ ...f, countryId: e.target.value, stateId: '' }))}>
                  <option value="">-- choose country --</option>
                  {countriesList.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                </select>

                <label style={{ fontWeight: 600 }}>State</label>
                <select value={editForm.stateId || ''} onChange={(e) => setEditForm(f => ({ ...f, stateId: e.target.value }))}>
                  <option value="">-- choose state --</option>
                  {statesList.filter(s => ((s.country && (s.country._id || s.country) === editForm.countryId) || (s.country === editForm.countryId))).map(s => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
                </select>
              </>
            )}

            {tab === 'area' && (
              <>
                <label style={{ fontWeight: 600 }}>Country</label>
                <select value={editForm.countryId || ''} onChange={(e) => setEditForm(f => ({ ...f, countryId: e.target.value, stateId: '', cityId: '' }))}>
                  <option value="">-- choose country --</option>
                  {countriesList.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                </select>

                <label style={{ fontWeight: 600 }}>State</label>
                <select value={editForm.stateId || ''} onChange={(e) => setEditForm(f => ({ ...f, stateId: e.target.value, cityId: '' }))}>
                  <option value="">-- choose state --</option>
                  {statesList.filter(s => ((s.country && (s.country._id || s.country) === editForm.countryId) || (s.country === editForm.countryId))).map(s => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
                </select>

                <label style={{ fontWeight: 600 }}>City</label>
                <select value={editForm.cityId || ''} onChange={(e) => setEditForm(f => ({ ...f, cityId: e.target.value }))}>
                  <option value="">-- choose city --</option>
                  {citiesList.filter(c => ((c.state && (c.state._id || c.state) === editForm.stateId) || (c.state === editForm.stateId))).map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                </select>
              </>
            )}
          </div>
        </CommonModel>
      </div>
    
  );
};

export default Master;
