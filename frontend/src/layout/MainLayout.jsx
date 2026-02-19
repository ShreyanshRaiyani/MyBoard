import { useState } from 'react';
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuToggle = () => setCollapsed(c => !c);

  return (
    <div className="admin-wrapper">
      <Sidebar collapsed={collapsed} />

      <div className="main-section">
        <Header onMenuToggle={handleMenuToggle} />
        <div className="content">
          {children}
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default MainLayout;