import { NavLink } from 'react-router-dom';
import logo from '../assets/images/logo.svg';
import { Plus, List, Settings, FileText,Home, BarChart2, Star, MessageSquare, ShoppingCart, Award } from 'lucide-react';
// navigation data should be provided by the parent via `navPages` prop

function Sidebar({ collapsed = false, userType: propUserType = '', navPages }) {
  const baseClass = 'sidebar' + (collapsed ? ' collapsed' : '');
  const linkClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

  // resolve userType: prop overrides localStorage
  const stored = typeof window !== 'undefined' ? (localStorage.getItem('userType') || '') : '';
  const userType = (propUserType || stored || '').toString();

  // use navPages passed from parent; otherwise build a role-specific list here
  const pages = navPages ?? (function buildRolePages(type) {
    const t = (type || '').toLowerCase();

    if (/hoardingowner/.test(t)) {
      return [
        { to: '/hoarding-owner/profile', label: 'Hoarding Owner Profile', icon: <Plus size={18} /> },
        { to: '/hoarding', label: 'Hoarding List', icon: <List size={18} /> },
        { to: '/banner-requests', label: 'Banner Requests', icon: <FileText size={18} /> },
        { to: '/earning', label: 'Earning Dashboard', icon: <BarChart2 size={18} /> },
        { to: '/ratings', label: 'Rating & Reviews', icon: <Star size={18} /> },
        { to: '/feedback', label: 'Feedback', icon: <MessageSquare size={18} /> },
      ];
    }

    if (/banneruser/.test(t)) {
      return [
        { to: '/banner-user/profile', label: 'Banner User Profile', icon: <User size={18} /> },
        { to: '/banners', label: 'Banner List', icon: <List size={18} /> },
        { to: '/hoarding-booking', label: 'Hoarding Booking', icon: <ShoppingCart size={18} /> },
        { to: '/advert-status', label: 'Advertisment Status Tracking', icon: <Award size={18} /> },
        { to: '/payment-history', label: 'Payment History', icon: <FileText size={18} /> },
        { to: '/ratings', label: 'Rating & Reviews', icon: <Star size={18} /> },
        { to: '/feedback', label: 'Feedback', icon: <MessageSquare size={18} /> },
      ];
    }

    if (/worker/.test(t)) {
      return [
        { to: '/worker/profile', label: 'Worker Profile', icon: <User size={18} /> },
        { to: '/banner-work', label: 'Banner Work', icon: <FileText size={18} /> },
        { to: '/earnings', label: 'Total Earnings', icon: <BarChart2 size={18} /> },
        { to: '/ratings', label: 'Rating & Reviews', icon: <Star size={18} /> },
        { to: '/feedback', label: 'Feedback', icon: <MessageSquare size={18} /> },
      ];
    }

    // default (SuperAdmin / fallback)
    return [
      { to: '/dashboard', label: 'Dashboard' ,icon: <Home size={18} />},
      { to: '/master', label: 'Master' ,icon: <Settings size={18} />},
    ];
  })(userType);

  return (
    <aside className={baseClass}>
      <div className="sidebar-top">
        <div className="brand">
          <div className="logo"><img src={logo} alt="logo" /></div>
          <div className="brand-name">MyBoard</div>
        </div>
      </div>

      <nav className="nav">
        <ul>
          {pages.map((p) => (
            <li key={p.to}>
              <NavLink
                to={p.to}
                className={linkClass}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {p.icon}
                <span className="label">{p.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;