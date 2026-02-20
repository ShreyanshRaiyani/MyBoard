import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

function MainLayout({ navPages }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const handleMenuToggle = () => setCollapsed(c => {
    const next = !c;
    try { localStorage.setItem('sidebarCollapsed', next ? 'true' : 'false'); } catch (e) { }
    return next;
  });

  // keep localStorage in sync if external code changes it
  useEffect(() => {
    try { localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false'); } catch (e) { }
  }, [collapsed]);

  return (
    <div className="admin-wrapper">
      <Sidebar collapsed={collapsed} navPages={navPages} />

      <div className="main-section">
        <Header onMenuToggle={handleMenuToggle} />
        <div className="content">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default MainLayout;