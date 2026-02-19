import { Home, Users, Layers, Settings, Plus } from 'lucide-react';
import logo from '../assets/images/logo.svg';

function Sidebar({ collapsed = false }) {
  return (
    <aside className={"sidebar" + (collapsed ? ' collapsed' : '')}>
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
          <li className="nav-item active">
            <Home size={18} />
            <span className="label">Dashboard</span>
          </li>

          <li className="nav-item">
            <Layers size={18} />
            <span className="label">Projects</span>
          </li>

          <li className="nav-item">
            <Users size={18} />
            <span className="label">Clients</span>
          </li>

          <li className="nav-item">
            <Settings size={18} />
            <span className="label">Settings</span>
          </li>
        </ul>
      </nav>

    </aside>
  );
}

export default Sidebar;