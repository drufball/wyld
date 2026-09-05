import { NavLink } from 'react-router-dom';

const destinations = [
  { to: '/', label: 'Today', mobileLabel: 'TODAY' },
  { to: '/quests', label: 'Quests', mobileLabel: 'QUEST' },
  { to: '/demos', label: 'Demos', mobileLabel: 'DEMOS' },
  { to: '/rumble', label: 'Rumble', mobileLabel: 'RMBL' },
  { to: '/debug', label: 'Debug', mobileLabel: 'DEBUG' },
  { to: '/memory', label: 'Memory', mobileLabel: 'MEM' },
] as const;

export function Nav() {
  return (
    <nav className="pak-nav" aria-label="Main navigation">
      <div className="pak-nav__brand" aria-hidden="true">
        EXPANSION PAK
      </div>
      <ul className="pak-nav__list">
        {destinations.map(({ to, label, mobileLabel }) => (
          <li key={to}>
            <NavLink
              aria-label={label}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              end={to === '/'}
              to={to}
            >
              <span className="pak-nav__label pak-nav__label--mobile" aria-hidden="true">
                {mobileLabel}
              </span>
              <span className="pak-nav__label pak-nav__label--desktop" aria-hidden="true">
                {label.toUpperCase()}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
