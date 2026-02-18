import React from 'react';
import './Header.css';
import { Search, Bell, MessageCircle, Settings, Menu } from 'lucide-react';

const Header = ({ onMenuToggle, title = 'Dashboard' }) => {
  return (
    <header className="header-container">
      <div className="header-left">
        <button className="menu-toggle-btn" onClick={onMenuToggle}>
          <Menu size={24} />
        </button>
        <div className="page-title">
          <h1>{title}</h1>
        </div>
      </div>

      <div className="header-center">
        <div className="search-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search here..."
            className="search-input"
          />
        </div>
      </div>

      <div className="header-right">
        <button className="header-icon-btn notification">
          <Bell size={22} />
          <span className="badge">1</span>
        </button>

        <button className="header-icon-btn messages">
          <MessageCircle size={22} />
          <span className="badge">12</span>
        </button>

        <div className="user-info">
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces"
            alt="User"
            className="user-avatar"
          />
          <div className="user-details">
            <span className="user-name">Johndoe</span>
            <span className="user-role">Admin User</span>
          </div>
        </div>

        <button className="header-icon-btn settings">
          <Settings size={22} />
        </button>
      </div>
    </header>
  );
};

export default Header;
