import { NavLink } from 'react-router-dom';
import { Home, Users, Layers, Settings, Plus } from 'lucide-react';
import logo from '../assets/images/logo.svg';

function Sidebar({ collapsed = false }) {
  const baseClass = "sidebar" + (collapsed ? ' collapsed' : '');

  const linkClass = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '');

  return (
    <aside className={baseClass}>
      <div className="sidebar-top">
        <div className="brand">
          <div className="logo"><img src={logo} alt="logo" /></div>
          <div className="brand-name">MyBoard</div>
        </div>

        <button className="new-project">
          <Plus size={14} />
          <span className="label">New Project</span>
        </button>
      </div>

      <nav className="nav">
        <ul>
          <li>
            <NavLink to="/dashboard" className={linkClass}>
              <Home size={18} />
              <span className="label">Dashboard</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/projects" className={linkClass}>
              <Layers size={18} />
              <span className="label">Projects</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/clients" className={linkClass}>
              <Users size={18} />
              <span className="label">Clients</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/master" className={linkClass}>
              <Settings size={18} />
              <span className="label">Master</span>
            </NavLink>
          </li>
        </ul>
      </nav>

    </aside>
  );
}

export default Sidebar;