import { Search, Bell, MessageCircle, Settings, Menu, User, LogOut } from 'lucide-react';
import defaultProfile from '../assets/images/logo.svg';
import { useNavigate } from 'react-router-dom';
import { logoutUser, clearLocalUser } from '../utils/authHelper';

const Header = ({ onMenuToggle, title = "Dashboard" }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    // ensure local state cleared and redirect
    try { clearLocalUser(); } catch(e){}
    navigate('/login');
  };

  const name = localStorage.getItem('firstName') || 'John';
  const lastname = localStorage.getItem('lastName') || 'User';

  return (
    <div className="header">

      <div className="header-left flex align-center">
        <button className="icon-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <Menu size={20} />
        </button>

        <div className="brand-title">
          <h3>{title}</h3>
        </div>
      </div>


      <div className="header-right flex align-center">
        <div className="search">
          <Search size={16} />
          <input type="text" placeholder="Search here..." />
        </div>
        <button className="icon-btn">
          <Bell size={18} />
          <span className="badge">3</span>
        </button>

        <button className="icon-btn1">
          <MessageCircle size={18} />
          <span className="badge">2</span>
        </button>

        {/* <button className="icon-btn">
          <Settings size={18} />
        </button> */}

        <div className="profile flex align-center">
          <img src={localStorage.getItem('profilepic') || defaultProfile} alt="profile" className="avatar" />
          <div className="profile-info">
            <div className="name">{name}</div>
            <div className="role">{lastname}</div>
          </div>
        </div>

        <button className="icon-btn" onClick={handleLogout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>

    </div>
  );
};

export default Header;
