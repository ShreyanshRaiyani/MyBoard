import { NavLink } from 'react-router-dom';
import { Home, Users, Layers, Settings, Plus, FileText, List, DollarSign, Star, MessageSquare } from 'lucide-react';
import logo from '../assets/images/logo.svg';

function Sidebar({ collapsed = false, userType: propUserType = '' }) {
  const baseClass = 'sidebar' + (collapsed ? ' collapsed' : '');

  const linkClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

  // resolve userType: prop overrides localStorage
  const stored = typeof window !== 'undefined' ? (localStorage.getItem('userType') || '') : '';
  const userType = (propUserType || stored || '').toString();

  // define pages per user type
  const pages = [];

  // Dashboard always available
  pages.push({ to: '/dashboard', label: 'Dashboard', icon: <Home size={18} /> });

  if (/hoardingowner/i.test(userType)) {
    pages.push({ to: '/hoarding/profile', label: 'Hoarding Owner Profile', icon: <Users size={18} /> });
    pages.push({ to: '/hoarding/HoardingIndex', label: 'Hoarding', icon: <FileText size={18} /> });
    pages.push({ to: '/hoarding/list', label: 'Hoarding List', icon: <List size={18} /> });
    pages.push({ to: '/banner-requests', label: 'Banner Requests', icon: <MessageSquare size={18} /> });
    pages.push({ to: '/hoarding/earnings', label: 'Earning Dashboard', icon: <DollarSign size={18} /> });
    pages.push({ to: '/hoarding/reviews', label: 'Rating & Reviews', icon: <Star size={18} /> });
    pages.push({ to: '/hoarding/feedback', label: 'Feedback', icon: <MessageSquare size={18} /> });
  } else if (/banneruser/i.test(userType)) {
    pages.push({ to: '/banner/profile', label: 'Banner User Profile', icon: <Users size={18} /> });
    pages.push({ to: '/banner/list', label: 'Banner List', icon: <List size={18} /> });
    pages.push({ to: '/booking', label: 'Hoarding Booking', icon: <FileText size={18} /> });
    pages.push({ to: '/ads/status', label: 'Advertisement Status', icon: <MessageSquare size={18} /> });
    pages.push({ to: '/payments', label: 'Payment History', icon: <DollarSign size={18} /> });
    pages.push({ to: '/reviews', label: 'Rating & Reviews', icon: <Star size={18} /> });
    pages.push({ to: '/feedback', label: 'Feedback', icon: <MessageSquare size={18} /> });
  } else if (/worker/i.test(userType)) {
    pages.push({ to: '/worker/profile', label: 'Worker Profile', icon: <Users size={18} /> });
    pages.push({ to: '/worker/banners', label: 'Banner Work', icon: <List size={18} /> });
    pages.push({ to: '/worker/earnings', label: 'Total Earnings', icon: <DollarSign size={18} /> });
    pages.push({ to: '/worker/reviews', label: 'Rating & Reviews', icon: <Star size={18} /> });
    pages.push({ to: '/worker/feedback', label: 'Feedback', icon: <MessageSquare size={18} /> });
  } else {
    // fallback: show some general links
    pages.push({ to: '/projects', label: 'Projects', icon: <Layers size={18} /> });
    pages.push({ to: '/clients', label: 'Clients', icon: <Users size={18} /> });
    pages.push({ to: '/master', label: 'Master', icon: <Settings size={18} /> });
  }

  return (
    <aside className={baseClass}>
      <div className="sidebar-top">
        <div className="brand">
          <div className="logo"><img src={logo} alt="logo" /></div>
          <div className="brand-name">MyBoard</div>
        </div>

        {/* <button className="new-project">
          <Plus size={14} />
          <span className="label">New Project</span>
        </button> */}
      </div>

      <nav className="nav">
        <ul>
          {pages.map((p) => (
            <li key={p.to}>
              <NavLink to={p.to} className={linkClass} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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