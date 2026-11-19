import {
  Bell,
  CircleUserRound,
  LayoutGrid,
  MessageSquare,
  Settings,
  ArrowLeftRight,
  Star,
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { icon: LayoutGrid, label: 'Dashboard', href: '/' },
  { icon: CircleUserRound, label: 'My Profile', href: '/profile' },
  { icon: Zap, label: 'Skill Matching', href: '/matches' },
  { icon: ArrowLeftRight, label: 'Swap Requests', href: '/swaps' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: Star, label: 'Ratings & Reviews', href: '/ratings' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const items = user?.role === 'ADMIN' ? [...navItems, { icon: ShieldCheck, label: 'Admin Panel', href: '/admin' }] : navItems;

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar modern-sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-mobile-drawer-header">
          <div className="sidebar-mobile-brand">
            <span className="sidebar-mobile-logo">
              <ArrowLeftRight size={17} strokeWidth={2.4} />
            </span>
            <span className="sidebar-mobile-title">
              Skill<span className="sidebar-mobile-accent">Swap</span>
            </span>
          </div>
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {items.map(({ icon: Icon, label, href }) => (
            <NavLink
              key={label}
              className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
              to={href}
              onClick={onClose}
            >
              <Icon size={17} strokeWidth={2} />
              <span className="side-link-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-pro-widget">
          <div className="pro-widget-glow" />
          <div className="pro-widget-header">
            <div className="pro-widget-icon">
              <Sparkles size={16} />
            </div>
            <span className="pro-widget-badge">COMMUNITY</span>
          </div>
          <h4 className="pro-widget-title">Explore Skill Matches</h4>
          <p className="pro-widget-desc">Discover top mentors and exchange skills with verified peers.</p>
          <Link to="/matches" className="pro-widget-btn" onClick={onClose}>
            <span>Find Matches</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
    </>
  );
}
