import { NavLink } from 'react-router-dom';

const destinations = [
  { to: '/', label: 'Today' },
  { to: '/worlds', label: 'Worlds' },
  { to: '/demos', label: 'Demos' },
  { to: '/rumble', label: 'Rumble' },
  { to: '/debug', label: 'Debug' },
  { to: '/memory', label: 'Memory' },
] as const;

export function Nav() {
  return (
    <nav className="pak-nav" aria-label="Main navigation">
      <div className="pak-nav__brand" aria-hidden="true">
        EXPANSION PAK
      </div>
      <ul className="pak-nav__list">
        {destinations.map(({ to, label }) => (
          <li key={to}>
            <NavLink
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              end={to === '/'}
              to={to}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
