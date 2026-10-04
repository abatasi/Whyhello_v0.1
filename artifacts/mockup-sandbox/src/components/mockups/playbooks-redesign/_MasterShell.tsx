import { useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import {
  Bell, Briefcase, Building2, ChevronDown, ClipboardList, Clock,
  Factory, Flame, Gauge, House, Layers3, List, LogOut, Menu, MessageSquare,
  Monitor, Moon, Search, Settings, ShieldCheck, Sun, Upload, Users,
  X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import './_sidebar-navigation.css';
import './_master-shell.css';

const DEMO_USER = {
  firstName: 'Morgan',
  lastName: 'Lee',
  email: 'morgan.lee@example.invalid',
};
const DARK_LOGO = '/__mockup/images/whyhello-logo-dark-full.png';
const LIGHT_LOGO = '/__mockup/images/whyhello-logo-light-full.png';

type LocalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function Link({ href, className, children, onClick, ...props }: LocalLinkProps) {
  return (
    <a
      {...props}
      href={href}
      className={className}
      onClick={event => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}

function nextTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' | 'system' {
  if (theme === 'system') return 'light';
  if (theme === 'light') return 'dark';
  return 'system';
}

function themeLabel(theme: 'light' | 'dark' | 'system') {
  if (theme === 'light') return 'Light';
  if (theme === 'dark') return 'Dark';
  return 'System';
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function CreditTracker({ wartime }: { wartime: boolean }) {
  const tier = 'Demo';
  const usageText = '1,420 / 4,000';
  const colorClass = wartime ? 'text-[#7C3E2A] dark:text-[#E0BBA8]' : 'text-[#6F5BAF] dark:text-primary';
  return (
    <div
      title="Illustrative demo credit allowance"
      className={cn('flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold select-none', colorClass)}
    >
      <Zap className="h-3 w-3 flex-shrink-0" />
      <span>{usageText}</span>
      <span className="hidden sm:inline text-muted-foreground/80 font-normal">· {tier}</span>
    </div>
  );
}

function GlobalSearch({ wartime }: { wartime: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('whyhello-recent-global-searches') ?? '[]');
      if (Array.isArray(stored)) setRecentSearches(stored.filter((item): item is string => typeof item === 'string').slice(0, 5));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (event.key === 'Escape') setOpen(false);
    };
    const outside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', shortcut);
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('keydown', shortcut);
      document.removeEventListener('mousedown', outside);
    };
  }, []);

  const rememberSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem('whyhello-recent-global-searches', JSON.stringify(next));
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full origin-center transition-transform duration-200 hover:scale-[1.015] focus-within:scale-[1.015]"
    >
      <div className={cn(
        'flex h-7 w-full items-center gap-2 rounded-[7px] border px-2.5 transition-colors',
        wartime
          ? 'border-[#DDB99E] bg-[#EDD4C6] text-[#5C2E22] dark:border-[#5a2c1d] dark:bg-[#3d1c12] dark:text-[#edd4c6]'
          : 'border-border bg-secondary/50 focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20',
      )}>
        <Search className={cn('h-3.5 w-3.5 flex-shrink-0', wartime ? 'text-[#A0624A] dark:text-[#E0BBA8]' : 'text-muted-foreground')} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search contacts & companies"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && query.trim()) rememberSearch(query);
          }}
          className={cn(
            'min-w-0 flex-1 cursor-pointer bg-transparent text-[11px] font-medium outline-none',
            wartime ? 'placeholder:text-[#A0624A]/70 text-[#5C2E22] dark:placeholder:text-[#e8c9b8]/70 dark:text-[#edd4c6]' : 'text-foreground placeholder:text-muted-foreground',
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className={cn('transition-colors flex-shrink-0', wartime ? 'text-[#A0624A] hover:text-[#5C2E22]' : 'text-muted-foreground hover:text-foreground')}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className={cn(
          'ml-auto flex-shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none',
          wartime ? 'border-[#C99478]/60 bg-[#F4E2D8]/70 text-[#7C3E2A]' : 'border-border bg-background/70 text-muted-foreground',
        )}>Ctrl K</kbd>
      </div>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-full min-w-[22rem] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {query.trim().length >= 2 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No local demo results for “{query.trim()}”.
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto py-2">
              <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent searches</div>
              {recentSearches.length ? recentSearches.map(recent => (
                <button
                  key={recent}
                  type="button"
                  onClick={() => { setQuery(recent); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary/50"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{recent}</span>
                </button>
              )) : <p className="px-3 py-2 text-xs text-muted-foreground">No recent searches yet.</p>}
              <div className="mx-3 my-2 border-t border-border/70" />
              <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent visits</div>
              <p className="px-3 py-2 text-xs text-muted-foreground">No recent contact visits.</p>
              <p className="px-3 py-2 text-xs text-muted-foreground">No recent company visits.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HQPill({ wartime }: { wartime: boolean }) {
  const isActive = false;
  const ModeIcon = wartime ? Flame : ShieldCheck;
  const modeLabel = wartime ? 'Wartime' : 'Peacetime';
  return (
    <Link href="/hq">
      <span
        title="HQ — messaging, scoring & calibration"
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[10px] font-semibold transition-all select-none cursor-pointer',
          wartime
            ? isActive
              ? 'bg-[#7C3E2A] text-[#F4E2D8] border-[#7C3E2A]'
              : 'bg-[#E8C4B0] text-[#7C3E2A] border-[#DDB99E] hover:bg-[#E0BBA8] hover:text-[#5C2E22]'
            : isActive
              ? 'bg-foreground text-background border-foreground'
              : 'bg-secondary text-foreground border-border hover:bg-secondary/80',
        )}
      >
        <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
        <span>HQ</span>
        <span className={cn('h-3.5 w-px', wartime ? 'bg-[#DDB99E]' : 'bg-border')} />
        <ModeIcon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{modeLabel}</span>
      </span>
    </Link>
  );
}

function LogoMenu({
  wartime, sidebar = false, expanded = false, theme, setTheme, onNotice,
}: {
  wartime: boolean;
  sidebar?: boolean;
  expanded?: boolean;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  onNotice: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifExpanded, setNotifExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const darkTheme = theme === 'dark' || theme === 'system';
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setNotifExpanded(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); setNotifExpanded(false); }
    };
    if (open) {
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', escape);
    }
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div
      ref={ref}
      className={cn('relative flex items-center flex-shrink-0', sidebar ? 'sidebar-logo-menu' : 'self-stretch -ml-6 xl:-ml-8')}
    >
      <button
        type="button"
        onClick={() => { setOpen(current => !current); setNotifExpanded(false); }}
        className={cn(sidebar ? 'sidebar-logo-trigger' : 'h-full pl-6 xl:pl-8 pr-4 flex items-center cursor-pointer', wartime ? 'bg-transparent' : 'bg-background')}
        aria-label="Open app menu"
        aria-expanded={open}
      >
        <div className={cn('sidebar-logo-crop', expanded && 'sidebar-logo-crop-expanded')}>
          <img src={darkTheme ? DARK_LOGO : LIGHT_LOGO} alt="Whyhello" />
        </div>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+1px)] w-72 rounded-b-xl rounded-r-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2 bg-muted/30 border-b border-border/60">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recents</span>
          </div>
          <p className="px-4 py-3 text-xs text-muted-foreground">No recent contacts or companies.</p>
          <div className="border-t border-border/60" />
          <div className="py-1">
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors"
              onClick={() => setNotifExpanded(current => !current)}
              aria-expanded={notifExpanded}
            >
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span>Notifications</span>
              <ChevronDown className={cn('ml-auto h-3.5 w-3.5 flex-shrink-0 transition-transform', notifExpanded && 'rotate-180')} />
            </button>
            {notifExpanded && (
              <div className="border-t border-border/40 bg-muted/20">
                <p className="px-4 py-3 text-xs text-muted-foreground">No exports in this demo workspace.</p>
              </div>
            )}
            <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span>Settings</span>
            </Link>
            <div className="px-4 py-2.5 flex items-center justify-between hover:bg-secondary/40 transition-colors">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {theme === 'system' ? <Monitor className="h-4 w-4 flex-shrink-0" /> : darkTheme ? <Moon className="h-4 w-4 flex-shrink-0" /> : <Sun className="h-4 w-4 flex-shrink-0" />}
                <span>Theme</span>
              </div>
              <button
                type="button"
                data-testid="button-theme-menu"
                onClick={event => { event.stopPropagation(); setTheme(nextTheme(theme)); }}
                className="flex items-center justify-center p-1 rounded-md bg-secondary/80 text-foreground border border-border/50 hover:bg-secondary transition-colors"
                aria-label={`Theme: ${themeLabel(theme)}. Change theme`}
              >
                <span className="text-[10px] font-semibold px-1 uppercase">{themeLabel(theme)}</span>
              </button>
            </div>
          </div>
          <div className="border-t border-border/60" />
          <div className="py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onNotice(`Demo account only · ${DEMO_USER.email}`); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-colors text-left"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const directoryItems = [
  { label: 'People', href: '/directory/people', icon: Users },
  { label: 'Companies', href: '/directory/companies', icon: Building2 },
];

const moreItems = [
  { label: 'Lists', href: '/lists', icon: List },
  { label: 'Industries', href: '/industries', icon: Factory },
  { label: 'Roles', href: '/roles', icon: Briefcase },
  { label: 'Import', href: '/import', icon: Upload },
];

function MasterSidebar({
  theme, setTheme, onNotice,
}: {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  onNotice: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const location = '/playbooks';
  const darkTheme = theme === 'dark' || theme === 'system';
  const displayName = `${DEMO_USER.firstName} ${DEMO_USER.lastName}`;
  const isRouteActive = (href: string) => href === '/' ? false : location.startsWith(href);
  const navItems = [
    { label: 'Home', href: '/', icon: House },
    { label: 'Directory', href: '/directory', icon: Users },
    { label: 'Message Center', href: '/messages', icon: MessageSquare },
    { label: 'Playbooks', href: '/playbooks', icon: ClipboardList },
    { label: 'Multi-threading', href: '/multithreading', icon: Layers3 },
  ];
  const handleBlur = () => {
    window.setTimeout(() => {
      if (!document.querySelector('.master-sidebar:focus-within')) setExpanded(false);
    }, 0);
  };
  return (
    <aside
      className={cn('master-sidebar hidden md:flex', expanded && 'is-expanded')}
      aria-label="Whyhello primary navigation"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setDirectoryOpen(false); }}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={handleBlur}
      onClickCapture={event => {
        if ((event.target as Element).closest('a[href]')) {
          setExpanded(false);
          setDirectoryOpen(false);
        }
      }}
    >
      <div className="master-sidebar-inner">
        <div className="master-brand-row">
          <LogoMenu wartime={false} sidebar expanded={expanded} theme={theme} setTheme={setTheme} onNotice={onNotice} />
        </div>
        <nav className="master-route-nav" aria-label="Primary">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isRouteActive(href);
            if (href === '/directory') {
              return (
                <div
                  key={href}
                  className="master-directory-group"
                  onMouseEnter={() => setDirectoryOpen(true)}
                  onMouseLeave={() => setDirectoryOpen(false)}
                  onFocusCapture={() => setDirectoryOpen(true)}
                  onBlurCapture={event => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDirectoryOpen(false);
                  }}
                >
                  <Link
                    href="/directory/people"
                    className={cn('master-route', active && 'is-active')}
                    aria-label="Directory"
                    aria-expanded={expanded && directoryOpen}
                    aria-controls="directory-submenu"
                    title={!expanded ? label : undefined}
                  >
                    <Icon size={18} strokeWidth={active ? 2.3 : 1.85} />
                    <span>{label}</span>
                    {expanded && <i className="master-directory-caret"><ChevronDown size={15} aria-hidden="true" /></i>}
                  </Link>
                  {expanded && directoryOpen && (
                    <div id="directory-submenu" className="master-directory-submenu">
                      {directoryItems.map(({ label: childLabel, href: childHref, icon: ChildIcon }) => (
                        <Link
                          key={childHref}
                          href={childHref}
                          className={cn('master-route master-directory-child', location === childHref && 'is-active')}
                          aria-current={location === childHref ? 'page' : undefined}
                        >
                          <ChildIcon size={16} strokeWidth={1.85} />
                          <span>{childLabel}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn('master-route', active && 'is-active')}
                aria-label={label}
                title={!expanded ? label : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.85} />
                <span>{label}</span>
                {active && expanded && <i className="master-active-dot" />}
              </Link>
            );
          })}
          <>
            <div className="master-more-header" aria-hidden={!expanded}>More</div>
            {moreItems.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className={cn('master-route master-subroute', isRouteActive(href) && 'is-active')} aria-label={label} title={!expanded ? label : undefined}>
                <Icon size={18} strokeWidth={1.85} />
                <span>{label}</span>
              </Link>
            ))}
          </>
        </nav>
        <div className="master-sidebar-bottom">
          <button
            type="button"
            onClick={() => setTheme(nextTheme(theme))}
            data-testid="button-theme-desktop"
            className="master-route"
            title={!expanded ? `Theme: ${themeLabel(theme)}` : undefined}
            aria-label={`Theme: ${themeLabel(theme)}. Change theme`}
          >
            {theme === 'system' ? <Monitor size={18} /> : darkTheme ? <Moon size={18} /> : <Sun size={18} />}
            <span>{themeLabel(theme)} Theme</span>
          </button>
          <Link href="/settings" className="master-route" aria-label="Settings" title={!expanded ? 'Settings' : undefined}>
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          <div className="master-user-row">
            <Link href="/profile" className="master-route master-user-route" aria-label={`${displayName} profile`} title={!expanded ? displayName : undefined}>
              <i className="master-user-avatar master-user-initials">{initials(displayName)}</i>
              <span>{displayName}</span>
            </Link>
            {expanded && (
              <button
                type="button"
                className="master-logout-button"
                data-testid="button-sidebar-signout"
                aria-label="Sign out"
                onClick={() => onNotice(`Demo account only · ${DEMO_USER.email}`)}
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Navbar({ theme, setTheme, onNotice }: {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  onNotice: (message: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(true);
  const darkTheme = theme === 'dark' || theme === 'system';
  const location = '/playbooks';
  const displayName = `${DEMO_USER.firstName} ${DEMO_USER.lastName}`;
  const navItems = [
    { label: 'Home', href: '/', icon: House },
    { label: 'Directory', href: '/directory', icon: Users },
    { label: 'Message Center', href: '/messages', icon: Bell },
    { label: 'Playbooks', href: '/playbooks', icon: List },
    { label: 'Multi-threading', href: '/multithreading', icon: Zap },
  ];
  const allMobileItems = [...navItems, ...moreItems];
  const closeMobile = () => {
    setMobileOpen(false);
    setMobileDirectoryOpen(false);
  };
  return (
    <>
      <MasterSidebar theme={theme} setTheme={setTheme} onNotice={onNotice} />
      <header
        className={cn(
          'master-navbar sticky top-0 z-40 w-full md:ml-[42px] md:w-[calc(100%-42px)] border-b transition-colors duration-300',
          'border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        )}
      >
        <div className="hidden h-11 w-full grid-cols-[minmax(0,1fr)_minmax(360px,560px)_minmax(0,1fr)] items-center gap-[18px] px-[18px] pl-[18px] md:grid">
          <div />
          <GlobalSearch wartime={false} />
          <div className="flex min-w-0 items-center justify-end gap-3">
            <CreditTracker wartime={false} />
            <HQPill wartime={false} />
          </div>
        </div>
        <div className="md:hidden flex items-center px-4 h-14 gap-2">
          <div className="overflow-hidden flex-shrink-0" style={{ width: 36, height: 24 }}>
            <img src={darkTheme ? DARK_LOGO : LIGHT_LOGO} alt="Whyhello" className="h-6 w-auto max-w-none" />
          </div>
          <div className="flex-1" />
          <HQPill wartime={false} />
          <button
            type="button"
            onClick={() => setMobileOpen(value => !value)}
            className="p-2 -mr-1 rounded-lg transition-colors flex-shrink-0 text-foreground hover:bg-secondary/40"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t overflow-y-auto max-h-[calc(100svh-3.5rem)] border-border bg-background">
            <nav className="px-3 pt-3 pb-1 flex flex-col gap-0.5">
              {allMobileItems.map(({ label, href, icon: Icon }) => {
                const isActive = href === '/' ? false : location.startsWith(href);
                const itemClassName = cn(
                  'flex w-full items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors text-left',
                  isActive ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground',
                );
                if (href === '/directory') {
                  return (
                    <div key={href}>
                      <button type="button" onClick={() => setMobileDirectoryOpen(open => !open)} className={itemClassName} aria-expanded={mobileDirectoryOpen}>
                        <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                        <span className="flex-1">Directory</span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', mobileDirectoryOpen && 'rotate-180')} />
                      </button>
                      {mobileDirectoryOpen && (
                        <div className="ml-6 flex flex-col gap-0.5 border-l border-border pl-3 py-1">
                          {directoryItems.map(({ label: childLabel, href: childHref, icon: ChildIcon }) => (
                            <Link key={childHref} href={childHref} onClick={closeMobile} aria-current={location === childHref ? 'page' : undefined} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/30 hover:text-foreground">
                              <ChildIcon className="h-4 w-4" />
                              {childLabel}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <Link key={href} href={href} onClick={closeMobile} className={itemClassName}>
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-70" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="h-px mx-4 my-2 bg-border/60" />
            <Link href="/profile" onClick={closeMobile} className="flex items-center gap-3 mx-3 px-3 py-3 my-1 rounded-xl transition-colors hover:bg-secondary/30">
              <div className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm border flex-shrink-0 bg-primary/10 text-primary border-primary/20">{initials(displayName)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{DEMO_USER.email}</p>
              </div>
              <CreditTracker wartime={false} />
            </Link>
            <div className="h-px mx-4 my-2 bg-border/60" />
            <div className="px-3">
              <button type="button" onClick={() => setTheme(nextTheme(theme))} data-testid="button-theme-mobile" aria-label={`Theme: ${themeLabel(theme)}. Change theme`} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors text-muted-foreground hover:bg-secondary/30 hover:text-foreground">
                {theme === 'system' ? <Monitor className="h-4 w-4 flex-shrink-0" /> : darkTheme ? <Moon className="h-4 w-4 flex-shrink-0" /> : <Sun className="h-4 w-4 flex-shrink-0" />}
                <span className="flex-1">Theme</span>
                <span className="text-xs font-semibold uppercase tracking-wide">{themeLabel(theme)}</span>
              </button>
            </div>
            <div className="h-px mx-4 my-2 bg-border/60" />
            <div className="px-3 pb-4">
              <button type="button" onClick={() => { closeMobile(); onNotice(`Demo account only · ${DEMO_USER.email}`); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors text-muted-foreground hover:bg-secondary/30 hover:text-foreground">
                <LogOut className="h-4 w-4 flex-shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
      
    </>
  );
}

export function MasterAppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const darkTheme = theme === 'dark' || theme === 'system';
  return (
    <div className={cn('playbooks-integrated-shell', darkTheme && 'dark')}>
      <Navbar theme={theme} setTheme={setTheme} onNotice={setNotice} />
      <div className="master-page-offset">{children}</div>
      {notice && <div className="master-shell-notice" role="status">{notice}</div>}
    </div>
  );
}