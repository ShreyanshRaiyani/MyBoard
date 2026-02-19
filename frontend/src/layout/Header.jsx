import { Search, Bell, MessageCircle, Settings, Menu, User } from 'lucide-react';
import avatarImg from '../assets/images/logo.svg';

const Header = ({ onMenuToggle, title = "Dashboard" }) => {
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

      <div className="header-center">
        <div className="search">
          <Search size={16} />
          <input type="text" placeholder="Search here..." />
        </div>
      </div>

      <div className="header-right flex align-center">
        <button className="icon-btn">
          <Bell size={18} />
          <span className="badge">3</span>
        </button>

        <button className="icon-btn">
          <MessageCircle size={18} />
          <span className="badge">2</span>
        </button>

        <button className="icon-btn">
          <Settings size={18} />
        </button>

        <div className="profile flex align-center">
          <img src={avatarImg} alt="profile" className="avatar" />
          <div className="profile-info">
            <div className="name">Johndoe</div>
            <div className="role">Super Admin</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Header;
