'use client';

// Shell.tsx — sidebar + topbar + ⌘K command palette + settings menu.
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Icon, Avatar, Badge, Seg } from '@/components/ui';
import { NAV_COUNTS, GLOBAL_SEARCH, ADMIN_ME, LOGOUT } from '@/lib/gql';

const NAV = [
  {
    group: 'MARKETPLACE',
    items: [
      { route: '/overview', label: 'Overview', icon: 'overview' },
      { route: '/owners', label: 'Owners', icon: 'owners', countKey: 'pendingOwners', tone: 'warn' },
      { route: '/venues', label: 'Venues', icon: 'venues', countKey: 'pendingVenues', tone: 'warn' },
      { route: '/bookings', label: 'Bookings', icon: 'bookings' },
      { route: '/users', label: 'Users', icon: 'users' },
      { route: '/reviews', label: 'Reviews', icon: 'reviews', countKey: 'flaggedReviews', tone: 'alert' },
    ],
  },
  {
    group: 'MONEY',
    items: [
      { route: '/payouts', label: 'Payouts', icon: 'payouts', countKey: 'queuedPayouts' },
      { route: '/invoices', label: 'Invoices', icon: 'invoices', countKey: 'overdueInvoices', tone: 'alert' },
    ],
  },
  {
    group: 'GROWTH',
    items: [
      { route: '/promos', label: 'Promo codes', icon: 'promo' },
      { route: '/advertising', label: 'Advertising', icon: 'advertising' },
    ],
  },
  {
    group: 'TRUST & SAFETY',
    items: [
      { route: '/disputes', label: 'Disputes', icon: 'disputes', countKey: 'openDisputes', tone: 'alert' },
      { route: '/audit', label: 'Audit Log', icon: 'audit' },
    ],
  },
];

const TITLES = {
  overview: ['Overview', 'PLATFORM COMMAND CENTER'],
  owners: ['Owners', 'ONBOARDING & APPROVALS'],
  venues: ['Venues', 'APPROVALS & FEATURING'],
  bookings: ['Bookings', 'ALL TRANSACTIONS'],
  users: ['Users', 'CUSTOMER BASE'],
  reviews: ['Reviews', 'MODERATION QUEUE'],
  payouts: ['Payouts', 'OWNER SETTLEMENTS'],
  invoices: ['Invoices', 'PLATFORM BILLING'],
  promos: ['Promo codes', 'CAMPAIGNS'],
  advertising: ['Advertising', 'FEATURED PLACEMENTS'],
  disputes: ['Disputes', 'RESOLUTION CENTER'],
  audit: ['Audit Log', 'SYSTEM EVENTS'],
};

const KIND_ROUTE = {
  owner: (id) => `/owners/${id}`,
  venue: (id) => `/venues/${id}`,
  booking: (id) => `/bookings/${id}`,
  user: (id) => `/users/${id}`,
};
const KIND_ICON = { owner: 'owners', venue: 'venues', booking: 'bookings', user: 'users' };
const KIND_LABEL = { owner: 'Owners', venue: 'Venues', booking: 'Bookings', user: 'Users' };

export function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = useRef(null);
  const { data: countsData } = useQuery(NAV_COUNTS, { pollInterval: 45000 });
  const { data: meData } = useQuery(ADMIN_ME);
  const counts = countsData?.getAdminNavCounts || {};
  const me = meData?.getAdminMe;

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const section = pathname.split('/')[1] || 'overview';
  const title = TITLES[section] || TITLES.overview;

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <aside className="aside">
        <div className="brand-row">
          <div className="brand-lock">
            <span className="brand-word">spotlyte.</span>
            <span className="brand-tag">admin</span>
          </div>
          <button className="collapse-btn" title="Notifications">
            <Icon name="bell" size={16} />
          </button>
        </div>
        <nav className="nav">
          {NAV.map((g) => (
            <React.Fragment key={g.group}>
              <div className="nav-group-label">{g.group}</div>
              {g.items.map((it) => {
                const active = pathname === it.route || pathname.startsWith(it.route + '/');
                const count = it.countKey ? counts[it.countKey] : null;
                return (
                  <a key={it.route} className={'nav-item' + (active ? ' active' : '')} onClick={() => router.push(it.route)}>
                    <Icon name={it.icon} size={18} />
                    <span className="fill">{it.label}</span>
                    {count ? <span className={'nav-count' + (it.tone === 'alert' ? ' alert' : it.tone === 'warn' ? ' warn' : '')}>{count}</span> : null}
                  </a>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
        <div className="aside-foot">
          {menuOpen && <UserMenu onClose={() => setMenuOpen(false)} />}
          <button className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
            <Avatar name={me?.name || 'Priya Menon'} color="var(--ink)" />
            <div className="meta fill">
              <b>{me?.name || 'Priya Menon'}</b>
              <span>{me?.role === 'super' ? 'Super Admin' : me?.role || 'Super Admin'}</span>
            </div>
            <Icon name="settings" size={16} style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      </aside>

      <main className="main" ref={mainRef}>
        <header className="topbar">
          <div className="tb-titles">
            <h1>{title[0]}</h1>
            <div className="sub">{title[1]}</div>
          </div>
          <div className="searchbox" style={{ cursor: 'text' }} onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={17} />
            <input placeholder="Search owners, venues, bookings…" readOnly />
            <kbd>⌘K</kbd>
          </div>
          <button className="btn icon-btn" title="Notifications">
            <Icon name="bell" size={18} />
          </button>
        </header>
        {children}
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

// ── settings pop-over: theme · density · logout ───────
function UserMenu({ onClose }) {
  const router = useRouter();
  const [logout] = useMutation(LOGOUT);
  const [theme, setTheme] = useState(() => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light'));
  const [density, setDensity] = useState(() => (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-density') || 'regular' : 'regular'));

  const applyTheme = (t) => {
    setTheme(t);
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('sp-theme', t);
  };
  const applyDensity = (d) => {
    setDensity(d);
    if (d === 'regular') document.documentElement.removeAttribute('data-density');
    else document.documentElement.setAttribute('data-density', d);
    localStorage.setItem('sp-density', d);
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest('.user-menu, .user-chip')) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  return (
    <div className="user-menu">
      <div className="um-label">Theme</div>
      <div style={{ padding: '2px 4px 8px' }}>
        <Seg
          light
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={theme}
          onChange={applyTheme}
          style={{ width: '100%' }}
        />
      </div>
      <div className="um-label">Density</div>
      <div style={{ padding: '2px 4px 8px' }}>
        <Seg
          light
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'regular', label: 'Regular' },
            { value: 'comfy', label: 'Comfy' },
          ]}
          value={density}
          onChange={applyDensity}
          style={{ width: '100%' }}
        />
      </div>
      <button
        className="um-item"
        onClick={async () => {
          await logout();
          router.push('/login');
        }}
      >
        <Icon name="x" size={15} />
        Logout
      </button>
    </div>
  );
}

// ── ⌘K command palette → adminGlobalSearch ────────────
function CommandPalette({ onClose }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [search, { data, loading }] = useLazyQuery(GLOBAL_SEARCH, { fetchPolicy: 'network-only' });
  const inputRef = useRef(null);
  const hits = data?.adminGlobalSearch || [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => search({ variables: { q } }), 180);
    return () => clearTimeout(t);
  }, [q, search]);

  const go = (hit) => {
    const to = KIND_ROUTE[hit.kind]?.(hit.id);
    if (to) router.push(to);
    onClose();
  };

  const grouped = ['owner', 'venue', 'booking', 'user'].map((k) => ({ kind: k, items: hits.filter((h) => h.kind === k) })).filter((g) => g.items.length);
  const flat = grouped.flatMap((g) => g.items);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette">
        <div className="pal-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            placeholder="Search owners, venues, bookings, users…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(flat.length - 1, s + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === 'Enter' && flat[sel]) go(flat[sel]);
            }}
          />

          <kbd
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--muted)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              padding: '1px 5px',
              background: 'var(--wash)',
            }}
          >
            ESC
          </kbd>
        </div>
        <div className="pal-list">
          {!q.trim() && <div className="pal-empty">Type to search across the marketplace.</div>}
          {q.trim() && !loading && !hits.length && <div className="pal-empty">No matches for “{q}”.</div>}
          {grouped.map((g) => (
            <React.Fragment key={g.kind}>
              <div className="pal-kind">{KIND_LABEL[g.kind]}</div>
              {g.items.map((h) => {
                const idx = flat.indexOf(h);
                return (
                  <div key={h.kind + h.id} className={'pal-item' + (idx === sel ? ' sel' : '')} onClick={() => go(h)} onMouseEnter={() => setSel(idx)}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--wash)',
                        border: '1px solid var(--line)',
                        color: 'var(--muted)',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={KIND_ICON[h.kind]} size={15} />
                    </div>
                    <div className="fill">
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{h.title}</div>
                      {h.sub && (
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          {h.sub}
                        </div>
                      )}
                    </div>
                    {h.badge && <Badge status={h.badge} />}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
