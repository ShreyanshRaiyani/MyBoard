import React, { useState } from 'react';
import './Sidebar.css';
import logo2 from '../../../assets/logo.svg';
import {
  Home,
  Briefcase,
  Users,
  Grid,
  Calendar,
  MessageSquare,
  LayoutGrid,
  BarChart3,
  Zap,
  Puzzle,
  Type,
  Table,
  FileText,
  Plus,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

const Sidebar = ({ onCollapse }) => {
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [openSubmenu, setOpenSubmenu] = useState('Dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { 
      icon: Home, 
      label: 'Dashboard', 
      subItems: ['Dashboard Light', 'Dashboard Dark'] 
    },
    { icon: Briefcase, label: 'Project' },
    { icon: Users, label: 'Contact' },
    { icon: Grid, label: 'Kanban' },
    { icon: Calendar, label: 'Calendar' },
    { icon: MessageSquare, label: 'Messages' },
    { icon: LayoutGrid, label: 'Apps', hasSubmenu: true },
    { icon: BarChart3, label: 'Charts', hasSubmenu: true },
    { icon: Zap, label: 'Bootstrap' },
    { icon: Puzzle, label: 'Plugins' },
    { icon: Type, label: 'Widget' },
    { icon: BarChart3, label: 'Forms' },
    { icon: Table, label: 'Table' },
    { icon: FileText, label: 'Pages' },
  ];

  const handleMenuClick = (label) => {
    setActiveMenu(label);
    if (isCollapsed) {
      setIsCollapsed(false);
      if (onCollapse) {
        onCollapse(false);
      }
    }
    if (openSubmenu === label) {
      setOpenSubmenu(null);
    } else {
      setOpenSubmenu(label);
    }
  };

  const toggleSidebar = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (newCollapsedState) {
      setOpenSubmenu(null);
    }
    if (onCollapse) {
      onCollapse(newCollapsedState);
    }
  };

  const handleLogoClick = () => {
    if (!isCollapsed) {
      return;
    }
    setIsCollapsed(false);
    if (onCollapse) {
      onCollapse(false);
    }
  };

  return (
    <aside className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-section" onClick={handleLogoClick} role="button" tabIndex={0}>
          <div className="logo-icon">
            <img src={logo2} alt="Logo" className="logo-image" />
          </div>
          {!isCollapsed && <span className="logo-text">MyBoard</span>}
        </div>
        {!isCollapsed && (
          <button className="collapse-toggle" onClick={toggleSidebar} title="Collapse">
            <ChevronLeft size={25} />
          </button>
        )}
      </div>

      <div className="sidebar-content">
        {!isCollapsed && (
          <button className="new-project-btn btn-primary">
            <Plus size={18} strokeWidth={2.5} />
            <span>New Project</span>
          </button>
        )}

        <nav className="sidebar-nav">
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = activeMenu === item.label;
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isSubmenuOpen = openSubmenu === item.label && hasSubItems;

            return (
              <div key={index} className="menu-item-wrapper">
                <button
                  className={`menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleMenuClick(item.label)}
                  title={isCollapsed ? item.label : ''}
                >
                  <IconComponent size={20} className="menu-icon" />
                  {!isCollapsed && (
                    <>
                      <span className="menu-label">{item.label}</span>
                      {(item.hasSubmenu || hasSubItems) && (
                        <ChevronRight
                          size={16}
                          className={`submenu-arrow ${isSubmenuOpen ? 'rotate' : ''}`}
                        />
                      )}
                    </>
                  )}
                </button>

                {hasSubItems && isSubmenuOpen && !isCollapsed && (
                  <div className="submenu">
                    {item.subItems.map((subItem, subIndex) => (
                      <button key={subIndex} className="submenu-item">
                        {subItem}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {!isCollapsed && (
        <div className="sidebar-footer">
          <p className="footer-text">MyBoard Admin Dashboard ©</p>
          <p className="footer-subtext">2025 All Rights Reserved</p>
          <p className="footer-credit">Made with love by Designcode</p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
