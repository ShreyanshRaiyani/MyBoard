import { Search, Bell, MessageCircle, Settings, Menu, User, LogOut } from 'lucide-react';
import defaultProfile from '../assets/images/profile.jpg';
import { useNavigate, useLocation } from 'react-router-dom';
import { logoutUser, clearLocalUser } from '../utils/authHelper';
import { useState, useRef, useEffect } from 'react';

const Header = ({ onMenuToggle, title = 'Dashboard' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const routeToTitle = (path) => {
    if (!path) return '';
    const map = {
      '/dashboard': 'Dashboard',
      '/hoarding/profile': 'Hoarding Owner Profile',
      '/hoarding/manage': 'Hoarding CURD Pages',
      '/hoarding/list': 'Hoarding List',
      '/banner-requests': 'Banner Requests',
      '/hoarding/earnings': 'Earning Dashboard',
      '/hoarding/reviews': 'Rating & Reviews',
      '/hoarding/feedback': 'Feedback',

      '/banner/profile': 'Banner User Profile',
      '/banner/list': 'Banner List',
      '/booking': 'Hoarding Booking',
      '/ads/status': 'Advertisement Status',
      '/payments': 'Payment History',

      '/worker/profile': 'Worker Profile',
      '/worker/banners': 'Banner Work',
      '/worker/earnings': 'Total Earnings',
      '/worker/reviews': 'Rating & Reviews',
      '/worker/feedback': 'Feedback',

      '/projects': 'Projects',
      '/clients': 'Clients',
      '/master': 'Master',
    };

    if (map[path]) return map[path];

    // check startsWith patterns
    if (path.startsWith('/hoarding')) return 'Hoarding';
    if (path.startsWith('/banner')) return 'Banner';
    if (path.startsWith('/worker')) return 'Worker';

    // fallback: prettify last segment
    const seg = path.split('/').filter(Boolean).pop() || '';
    if (!seg) return 'Dashboard';
    return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const derivedTitle = routeToTitle(location?.pathname || '');

  const handleLogout = async () => {
    await logoutUser();
    // ensure local state cleared and redirect
    try { clearLocalUser(); } catch(e){}
    navigate('/login');
  };

  const name = localStorage.getItem('firstName') || 'John';
  const lastname = localStorage.getItem('lastName') || 'User';
  const email = localStorage.getItem('email') || '';

  useEffect(() => {
    const onDown = (e) => {
      if (!profileOpen) return;
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [profileOpen]);

  const toggleProfile = () => setProfileOpen((s) => !s);

  const handleProfileKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleProfile();
    } else if (e.key === 'Escape') {
      setProfileOpen(false);
    }
  };

  const displayTitle = derivedTitle || title || 'Dashboard';

  return (
    <div className="header">

      <div className="header-left flex align-center">
        <button className="icon-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <Menu size={20} />
        </button>

        <div className="brand-title">
          <h3>{displayTitle}</h3>
        </div>
      </div>


      <div className="header-right flex align-center">
        <div className="search">
          <Search size={16} />
          <input type="text" placeholder="Search here..." />
        </div>
        <button className="icon-btn me-2">
          <Bell size={18} />
          <span className="badge">3</span>
        </button>

        {/* <button className="icon-btn1">
          <MessageCircle size={18} />
          <span className="badge">2</span>
        </button> */}

        {/* <button className="icon-btn">
          <Settings size={18} />
        </button> */}

        <div className="profile" ref={profileRef}>
          <button
            type="button"
            className="profile-button flex align-center"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={toggleProfile}
            onKeyDown={handleProfileKey}
          >
            <img src={localStorage.getItem('profilepic') || defaultProfile} alt="profile" className="avatar" />
            <div className="profile-info">
              <div className="name">{name}{lastname}</div>
              {/* <div className="email">{email}</div> */}
            </div>
          </button>

          {profileOpen && (
            <div className="profile-menu" role="menu" aria-label="User menu">
              <button type="button" className="menu-item" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/profile'); }}>
                <User size={16} />
                <span className="menu-label">Profile</span>
              </button>
              <button type="button" className="menu-item" role="menuitem" onClick={handleLogout}>
                <LogOut size={16} />
                <span className="menu-label">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Header;
