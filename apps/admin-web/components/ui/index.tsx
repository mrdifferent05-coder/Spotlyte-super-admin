'use client';

// components/ui — shared primitives (Section 7), ported 1:1 from the approved
// spotlyte admin design. Every list/detail page composes from these.
import React, { useId, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { avColor, initials as initialsOf, fmtINR } from '@/lib/format';

export { Icon };

// ── Sparkline (area) ──────────────────────────────────
export function Sparkline({ data, w = 200, h = 46, color = 'var(--brand)', fill = true, sw = 1.8 }:
  { data?: number[] | null; w?: number; h?: number; color?: string; fill?: boolean; sw?: number }) {
  const id = useId().replace(/[:]/g, '');
  if (!data || data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - 4 - ((v - min) / rng) * (h - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} height={h} preserveAspectRatio="none" style={{ color }}>
      {fill && (
        <defs>
          <linearGradient id={id} x1={0} y1={0} x2={0} y2={1}>
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={area} fill={`url(#${id})`} stroke="none" />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Avatar ────────────────────────────────────────────
export function Avatar({ name, color, init, size = 'md', sq = false }:
  { name?: string; color?: string; init?: string; size?: 'md' | 'lg'; sq?: boolean }) {
  const cls = 'avatar' + (size === 'lg' ? ' lg' : '') + (sq ? ' sq' : '');
  return (
    <div className={cls} style={{ background: color || avColor(name || '?') }}>
      {init || initialsOf(name || '?')}
    </div>
  );
}

// ── Badge (status → tone map, Section 5.4) ────────────
export const STATUS_MAP: Record<string, [string, string]> = {
  verified: ['green', 'Verified'], live: ['green', 'Live'], active: ['green', 'Active'], settled: ['green', 'Settled'],
  paid: ['green', 'Paid'], confirmed: ['green', 'Confirmed'], completed: ['green', 'Completed'], visible: ['green', 'Visible'], resolved: ['green', 'Resolved'],
  review: ['amber', 'In review'], pending: ['amber', 'Pending'], docs: ['amber', 'Docs needed'], processing: ['amber', 'Processing'],
  due: ['amber', 'Due'], investigating: ['amber', 'Investigating'], scheduled: ['blue', 'Scheduled'], 'no-show': ['gray', 'No-show'],
  queued: ['blue', 'Queued'],
  rejected: ['red', 'Rejected'], suspended: ['red', 'Suspended'], banned: ['red', 'Banned'], flagged: ['red', 'Flagged'],
  failed: ['red', 'Failed'], overdue: ['red', 'Overdue'], open: ['red', 'Open'],
  cancelled: ['gray', 'Cancelled'], paused: ['gray', 'Paused'], expired: ['gray', 'Expired'], ended: ['gray', 'Ended'],
  hidden: ['gray', 'Hidden'], refunded: ['gray', 'Refunded'], deleted: ['gray', 'Deleted'],
};

export function Badge({ status, label, tone, children, dot = true, style }:
  { status?: string; label?: string; tone?: string; children?: React.ReactNode; dot?: boolean; style?: React.CSSProperties }) {
  const m = (status && STATUS_MAP[status]) || [tone || 'gray', label || status || ''];
  return (
    <span className={'badge ' + m[0]} style={style}>
      {dot && <span className="dot" />}
      {children || label || m[1]}
    </span>
  );
}

export function Urgency({ level }: { level: string }) {
  const map: Record<string, string> = { high: 'red', medium: 'amber', low: 'gray' };
  return (
    <span className={'badge ' + (map[level] || 'gray')}>
      <span className="dot" />
      {level ? level[0].toUpperCase() + level.slice(1) : '—'}
    </span>
  );
}

// ── Delta ─────────────────────────────────────────────
export function Delta({ v, suffix = '%' }: { v?: number | null; suffix?: string }) {
  if (v == null) return null;
  const up = v >= 0;
  return (
    <span className={'delta ' + (up ? 'up' : 'down')}>
      <Icon name={up ? 'arrowUpRight' : 'arrowDownRight'} size={13} />
      {Math.abs(v)}{suffix}
    </span>
  );
}

// ── StatCard ──────────────────────────────────────────
export function StatCard({ label, value, unit, delta, meta, spark, color = 'var(--brand)' }:
  { label: string; value: React.ReactNode; unit?: string | null; delta?: number | null; meta?: React.ReactNode; spark?: number[] | null; color?: string }) {
  return (
    <div className="card card-pad stat">
      <div className="row between"><span className="lbl">{label}</span></div>
      <div className="val">
        {value}
        {unit && <small>{unit}</small>}
        {delta != null && <Delta v={delta} />}
      </div>
      {meta && <div className="meta">{meta}</div>}
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <Sparkline data={spark} color={color} h={40} />
        </div>
      )}
    </div>
  );
}

// ── MiniStat (clickable small KPI card) ───────────────
export function MiniStat({ label, value, sub, icon, onClick }:
  { label: string; value: React.ReactNode; sub?: string; icon: string; onClick?: () => void }) {
  return (
    <div className="card card-pad" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="row between">
        <span className="lbl" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
        <Icon name={icon} size={17} style={{ color: 'var(--muted-2)' }} />
      </div>
      <div className="row between" style={{ marginTop: 10, alignItems: 'flex-end' }}>
        <span className="num" style={{ fontSize: 28 }}>{value}</span>
        <span className="muted" style={{ fontSize: 12, textAlign: 'right', maxWidth: 130 }}>{sub}</span>
      </div>
    </div>
  );
}

// ── Small stat (detail pages) ─────────────────────────
export function Stat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="card card-pad">
      <div className="eyebrow">{label}</div>
      <div className="num" style={{ fontSize: 24, marginTop: 8, color }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── Seg toggle ────────────────────────────────────────
export function Seg({ options, value, onChange, light = false, style }:
  { options: (string | { value: string; label: string })[]; value: string; onChange: (v: string) => void; light?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={'seg' + (light ? ' seg-light' : '')} style={style}>
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lab = typeof o === 'string' ? o : o.label;
        return (
          <button key={val} type="button" className={value === val ? 'on' : ''} onClick={() => onChange(val)}>
            {lab}
          </button>
        );
      })}
    </div>
  );
}

// ── Tabs (underline with count pills) ─────────────────
export type Tab = { value: string; label: string; count?: number | null };
export function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} type="button" className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count != null && <span className="cnt">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Chips (filter pills) ──────────────────────────────
export function Chips({ options, value, onChange }:
  { options: (string | { value: string; label: string })[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lab = typeof o === 'string' ? o : o.label;
        return (
          <button key={val} type="button" className={'chip' + (value === val ? ' on' : '')} onClick={() => onChange(val)}>
            {lab}
          </button>
        );
      })}
    </div>
  );
}

// ── Toolbar (search 260px + chips + right actions) ────
export function Toolbar({ q, setQ, placeholder, children, right }:
  { q: string; setQ: (v: string) => void; placeholder?: string; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="row between wrap gap12" style={{ marginBottom: 16 }}>
      <div className="row gap10 wrap">
        <div className="searchbox" style={{ width: 260, height: 38 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder || 'Search…'} />
        </div>
        {children}
      </div>
      {right}
    </div>
  );
}

// ── Sortable table hook + Th ──────────────────────────
export function useSort<T extends Record<string, any>>(rows: T[], initial: [string, 'asc' | 'desc'] | null = null) {
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(initial);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const [key, dir] = sort;
    return [...rows].sort((a, b) => {
      let x = a[key], y = b[key];
      if (typeof x === 'string') { x = x.toLowerCase(); y = (y || '').toLowerCase(); }
      if (x == null) x = -Infinity;
      if (y == null) y = -Infinity;
      if (x < y) return dir === 'asc' ? -1 : 1;
      if (x > y) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sort]);
  const toggle = (key: string) =>
    setSort((s) => (s && s[0] === key ? [key, s[1] === 'asc' ? 'desc' : 'asc'] : [key, 'desc']));
  return [sorted, sort, toggle] as const;
}

export function Th({ k, sort, toggle, children, num, style }:
  { k?: string; sort?: [string, string] | null; toggle?: (k: string) => void; children?: React.ReactNode; num?: boolean; style?: React.CSSProperties }) {
  if (!toggle || !k) return <th className={num ? 'num-col' : ''} style={style}>{children}</th>;
  const on = sort && sort[0] === k;
  return (
    <th className={(num ? 'num-col ' : '') + 'sortable'} onClick={() => toggle(k)} style={style}>
      {children}
      <span className="arr">{on ? (sort![1] === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

// ── SecHead (page-level display header) ───────────────
export function SecHead({ eyebrow, title, children }:
  { eyebrow?: React.ReactNode; title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="sec-head">
      <div className="l">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <div className="display-h">{title}</div>}
      </div>
      {children && <div className="row gap8 wrap">{children}</div>}
    </div>
  );
}

// One italic-serif word inside a display title.
export function It({ children }: { children: React.ReactNode }) {
  return <span className="serif-it">{children}</span>;
}

// ── Panel (card with EYEBROW + display title) ─────────
export function Panel({ eyebrow, title, action, children, pad = true, style }:
  { eyebrow?: React.ReactNode; title?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; pad?: boolean; style?: React.CSSProperties }) {
  return (
    <div className="card" style={style}>
      {(title || action) && (
        <div className="row between" style={{ padding: '20px 24px 0' }}>
          <div>
            {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
            {title && <div className="display-h" style={{ fontSize: 21 }}>{title}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={pad ? { padding: '16px 24px 22px' } : undefined}>{children}</div>
    </div>
  );
}

// ── Stars ─────────────────────────────────────────────
export function Stars({ n }: { n: number }) {
  return <span className="stars">{'★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)}</span>;
}

// ── KV list ───────────────────────────────────────────
export function KV({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <dt>{it[0]}</dt>
          <dd>{it[1]}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Mono({ children, size = 12 }: { children: React.ReactNode; size?: number }) {
  return <span className="mono" style={{ fontSize: size }}>{children}</span>;
}

// ── Bar (thin progress) ───────────────────────────────
export function Bar({ pct, color, width }: { pct: number; color?: string; width?: number | string }) {
  return (
    <div className="bar" style={{ width }}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────
export function Modal({ title, sub, children, foot, onClose, width }:
  { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; foot?: React.ReactNode; onClose: () => void; width?: number }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" style={width ? { width } : undefined}>
        <div className="modal-head">
          <div className="row between">
            <div>
              <div className="display-h" style={{ fontSize: 20 }}>{title}</div>
              {sub && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{sub}</div>}
            </div>
            <button className="icon-btn btn btn-ghost" onClick={onClose} style={{ width: 32, height: 32 }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </>
  );
}

// ── Reason radio list ─────────────────────────────────
export function ReasonList({ options, value, onChange }:
  { options: (string | { title: string; sub?: string; right?: React.ReactNode })[]; value: number; onChange: (i: number) => void }) {
  return (
    <>
      {options.map((r, i) => {
        const isStr = typeof r === 'string';
        return (
          <div key={i} className={'reason' + (value === i ? ' on' : '')} onClick={() => onChange(i)}>
            <span className="rd" />
            {isStr ? (
              r
            ) : (
              <>
                <div className="fill">
                  <div style={{ fontWeight: 500 }}>{r.title}</div>
                  {r.sub && <div className="muted" style={{ fontSize: 12 }}>{r.sub}</div>}
                </div>
                {r.right}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── Request-docs modal (checkbox list + note) ─────────
export function RequestDocsModal({ title, sub, options, onClose, onSend }:
  { title?: string; sub?: string; options: string[]; onClose: () => void; onSend: (picked: string[], note: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const toggle = (d: string) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  return (
    <Modal
      title={title || 'Request documents'}
      sub={sub}
      onClose={onClose}
      width={520}
      foot={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!picked.length && !note} onClick={() => onSend(picked, note)}>
            <Icon name="mail" size={16} />
            {'Send request' + (picked.length ? ' · ' + picked.length : '')}
          </button>
        </>
      }
    >
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
        Select the documents to request. The recipient is emailed a secure upload link and the status moves to “Docs needed”.
      </p>
      <div style={{ marginBottom: 14 }}>
        {options.map((d, i) => (
          <div key={i} className={'checkrow' + (picked.includes(d) ? ' on' : '')} onClick={() => toggle(d)}>
            <span className="cb">{picked.includes(d) && <Icon name="check" size={13} />}</span>
            {d}
          </div>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Message / specific instructions</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Lease deed must be the latest renewal, clearly showing both signatures…" />
      </div>
    </Modal>
  );
}

// ── ActivityLog (icon-tile timeline rows) ─────────────
const ACT_COLOR: Record<string, string> = { approval: 'green', venue: 'blue', payout: 'blue', dispute: 'red', account: 'red', feature: 'amber', docs: 'amber', promo: 'amber', review: 'amber', config: 'amber', invoice: 'gray', auth: 'gray', export: 'gray' };
const ACT_ICON: Record<string, string> = { approval: 'check', venue: 'venues', payout: 'wallet', dispute: 'shield', account: 'owners', feature: 'crown', docs: 'doc', promo: 'percent', review: 'reviews', invoice: 'invoices', auth: 'shield', export: 'download', config: 'settings' };

export function ActivityLog({ items, dense }: { items: any[]; dense?: boolean }) {
  if (!items?.length) return <div className="muted" style={{ fontSize: 13, padding: '8px 0' }}>No internal activity yet.</div>;
  return (
    <div className="col" style={{ gap: 0 }}>
      {items.map((a, i) => (
        <div key={a.logId || i} className="row gap12" style={{ padding: (dense ? '11px' : '13px') + ' 4px', borderBottom: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none', alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'var(--wash)', border: '1px solid var(--line)', color: 'var(--muted)' }}>
            <Icon name={ACT_ICON[a.type] || 'audit'} size={15} />
          </div>
          <div className="fill">
            <div style={{ fontSize: 13 }}>
              <b style={{ fontWeight: 600 }}>{a.actor}</b> <span className="muted">{a.action}</span>{' '}
              <span style={{ fontWeight: 500 }}>{a.target}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 3 }}>{a.time}</div>
          </div>
          <span className={'badge ' + (ACT_COLOR[a.type] || 'gray')} style={{ fontSize: 10 }}>{a.type}</span>
        </div>
      ))}
    </div>
  );
}

// ── Pipeline (KYC stepper) ────────────────────────────
export function Pipeline({ current, steps = ['Submitted', 'Documents', 'Verification', 'Approved'] }:
  { current: number; steps?: string[] }) {
  return (
    <div className="pipe">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={'step ' + (i < current ? 'done' : i === current ? 'curr' : '')}>
            <div className="dotnum">{i < current ? <Icon name="check" size={14} /> : i + 1}</div>
            <span className="lab">{s}</span>
          </div>
          {i < steps.length - 1 && <div className={'line ' + (i < current ? 'done' : '')} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Vertical step timeline (bookings / payouts / disputes) ──
export function StepTimeline({ steps }: { steps: { title: string; sub?: string; state: string }[] }) {
  return (
    <div className="col" style={{ gap: 0 }}>
      {steps.map((t, i) => (
        <div key={i} className="row gap12" style={{ paddingBottom: i < steps.length - 1 ? 18 : 0, position: 'relative', alignItems: 'stretch' }}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 26, height: 26, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0,
              background: t.state === 'done' ? 'var(--brand)' : t.state === 'cancel' || t.state === 'refund' ? 'var(--danger)' : 'var(--paper)',
              border: t.state === 'curr' ? '2px solid var(--ink)' : '1.5px solid var(--line)',
              color: ['done', 'cancel', 'refund'].includes(t.state) ? '#fff' : 'var(--muted)',
            }}>
              <Icon name={t.state === 'cancel' ? 'x' : t.state === 'refund' ? 'wallet' : t.state === 'curr' ? 'clock' : t.state === 'done' ? 'check' : 'clock'} size={13} />
            </div>
            {i < steps.length - 1 && <div style={{ width: 1.5, flex: 1, minHeight: 22, background: 'var(--line)', marginTop: 2 }} />}
          </div>
          <div style={{ paddingTop: 2 }}>
            <div className="strong" style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{t.title}</div>
            {t.sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── HeadBar / Back (detail pages) ─────────────────────
export function HeadBar({ avatar, title, badges, sub, actions }:
  { avatar?: React.ReactNode; title: React.ReactNode; badges?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="row between wrap gap16" style={{ marginBottom: 24 }}>
      <div className="row gap16">
        {avatar}
        <div>
          <div className="row gap10 wrap" style={{ alignItems: 'center' }}>
            <h2 className="display-h" style={{ fontSize: 26 }}>{title}</h2>
            {badges}
          </div>
          {sub && <div className="muted" style={{ fontSize: 13, marginTop: 5 }}>{sub}</div>}
        </div>
      </div>
      {actions && <div className="row gap8 wrap">{actions}</div>}
    </div>
  );
}

export function Back({ href, label, onClick }: { href?: string; label: string; onClick?: () => void }) {
  return (
    <a className="backlink" href={href} onClick={onClick}>
      <Icon name="chevronLeft" size={15} />
      {label}
    </a>
  );
}

// ── EmptyState ────────────────────────────────────────
export function EmptyState({ icon = 'shield', title, sub, tone = 'ok' }:
  { icon?: string; title: string; sub?: string; tone?: 'ok' | 'muted' }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, display: 'grid', placeItems: 'center',
        background: tone === 'ok' ? 'var(--ok-soft)' : 'var(--wash)',
        color: tone === 'ok' ? 'var(--ok)' : 'var(--muted)', margin: '0 auto 14px',
      }}>
        <Icon name={icon} size={24} />
      </div>
      <div className="display-h" style={{ fontSize: 18 }}>{title}</div>
      {sub && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Venue thumb (gradient placeholder from seed token) ─
export function VenueThumb({ name, color, size = 42, radius = 'var(--r-sm)' }:
  { name?: string; color?: string; size?: number; radius?: string }) {
  const c = color || avColor(name || '?');
  return (
    <div className="thumb" style={{
      width: size, height: size, borderRadius: radius,
      background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 55%, #000))`,
    }} />
  );
}

export { fmtINR, avColor };
