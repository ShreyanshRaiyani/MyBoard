import React, { useState, useRef, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../../layout/MainLayout';
import { Eye, Edit, MoreVertical } from 'lucide-react';

const mock = {
  country: [
    { id: 1, name: 'India', iso: 'IN' },
    { id: 2, name: 'United States', iso: 'US' },
  ],
  state: [
    { id: 1, name: 'Gujarat', country: 'India' },
    { id: 2, name: 'California', country: 'United States' },
  ],
  city: [
    { id: 1, name: 'Ahmedabad', state: 'Gujarat' },
    { id: 2, name: 'San Francisco', state: 'California' },
  ],
  area: [
    { id: 1, name: 'Satellite', city: 'Ahmedabad' },
    { id: 2, name: 'Mission District', city: 'San Francisco' },
  ],
};

const Master = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(type || '');
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (type && ['country','state','city','area'].includes(type)) setTab(type);
    else setTab('');
  }, [type]);

  const items = mock[tab] || [];

  return (
    <MainLayout>
      <div className="master-page">
        <div className="page-header">
          <h2>Master</h2>
          <div className="page-actions">
            {tab ? (
              <Link to={`/master/${tab}/create`} className="btn primary">Add {tab.slice(0,1).toUpperCase()+tab.slice(1)}</Link>
            ) : (
              <span className="muted">Select a tab to manage</span>
            )}
          </div>
        </div>

        <div className="master-tabs" role="tablist" aria-label="Master types">
          {['country','state','city','area'].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={"tab" + (tab === t ? ' active' : '')}
              onClick={() => navigate(`/master/${t}`)}
            >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        <div className="master-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Related</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tab ? items.map((it, i) => (
                <tr key={it.id}>
                  <td>{i+1}</td>
                  <td>{it.name}</td>
                  <td>{it.country || it.state || it.city || '-'}</td>
                  <td>
                    <div className="action-cell" ref={menuRef}>
                      <button aria-haspopup="menu" className="icon-btn" onClick={() => setOpenMenu(openMenu===it.id? null : it.id)}>
                        <MoreVertical size={16} />
                      </button>
                      {openMenu === it.id && (
                        <div className="action-menu" role="menu">
                          <Link className="action-item" to={`/master/${tab}/view/${it.id}`} role="menuitem"><Eye size={14}/> <span>View</span></Link>
                          <Link className="action-item" to={`/master/${tab}/edit/${it.id}`} role="menuitem"><Edit size={14}/> <span>Edit</span></Link>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="muted">Please choose Country, State, City or Area from the tabs above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Master;
