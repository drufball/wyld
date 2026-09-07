import { NavLink } from 'react-router-dom';

const destinations = [
  { to: '/', label: 'Today', mobileLabel: 'TODAY' },
  { to: '/quests', label: 'Quests', mobileLabel: 'QUEST' },
  { to: '/roadmap', label: 'Roadmap', mobileLabel: 'MAP' },
  { to: '/demos', label: 'Demos', mobileLabel: 'DEMOS' },
  { to: '/workshop', label: 'Species', mobileLabel: 'SPECS' },
  { to: '/rumble', label: 'Rumble', mobileLabel: 'RMBL' },
  { to: '/debug', label: 'Debug', mobileLabel: 'DEBUG' },
  { to: '/memory', label: 'Memory', mobileLabel: 'MEM' },
] as const;

export function Nav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] font-display md:static"
      aria-label="Main navigation"
    >
      <div className="mx-auto w-full max-w-[760px] md:border md:border-bevel-dark md:p-2">
        <div
          className="hidden px-3 py-2 text-[10px] text-muted-foreground md:block"
          aria-hidden="true"
        >
          EXPANSION PAK
        </div>
        <ul className="grid list-none grid-cols-8 p-0 md:flex md:flex-wrap">
          {destinations.map(({ to, label, mobileLabel }) => (
            <li className="min-w-0" key={to}>
              <NavLink
                aria-label={label}
                className={({ isActive }) =>
                  `flex min-h-[52px] min-w-11 items-center justify-center border-t-2 px-1 text-center text-[8px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-3 md:text-[10px] ${isActive ? 'border-accent text-accent' : 'border-transparent'}`
                }
                end={to === '/'}
                to={to}
              >
                <span className="pak-nav__label--mobile md:hidden" aria-hidden="true">
                  {mobileLabel}
                </span>
                <span className="pak-nav__label--desktop hidden md:inline" aria-hidden="true">
                  {label.toUpperCase()}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
