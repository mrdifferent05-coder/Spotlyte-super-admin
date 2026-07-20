'use client';

// /audit — the immutable system-events log (Section 8.16).
import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { AUDIT_LOG } from '@/lib/gql';
import { downloadCSV } from '@/lib/csv';
import { Icon, SecHead, It, Toolbar, Chips } from '@/components/ui';

const TYPE_COLOR = {
  approval: 'green',
  venue: 'blue',
  payout: 'blue',
  dispute: 'red',
  account: 'red',
  feature: 'amber',
  promo: 'amber',
  review: 'amber',
  config: 'amber',
  docs: 'amber',
  invoice: 'gray',
  auth: 'gray',
  export: 'gray',
};
const TYPE_ICON = {
  approval: 'check',
  venue: 'venues',
  payout: 'wallet',
  dispute: 'shield',
  account: 'owners',
  feature: 'crown',
  promo: 'percent',
  review: 'reviews',
  invoice: 'invoices',
  auth: 'shield',
  export: 'download',
  config: 'settings',
  docs: 'doc',
};
const PAGE = 30;

export default function AuditPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const { data, loading } = useQuery(AUDIT_LOG, { variables: { type: filter, q, limit, offset: 0 } });
  const d = data?.getAdminAuditLog;
  const rows = d?.entries || [];

  return (
    <div className="page">
      <SecHead
        eyebrow="AUDIT LOG · IMMUTABLE"
        title={
          <>
            Every <It>action</It>, logged.
          </>
        }
      >
        <button
          className="btn"
          onClick={() =>
            downloadCSV(
              'spotlyte-audit-log',
              rows.map((a) => ({
                id: a.logId,
                actor: a.actor,
                action: a.action,
                target: a.target,
                type: a.type,
                ref: a.ref || '',
                ip: a.ip || '',
                time: a.time,
              }))
            )
          }
        >
          <Icon name="download" size={16} />
          Export log
        </button>
      </SecHead>

      <Toolbar q={q} setQ={setQ} placeholder="Search actor, action, target…">
        <Chips
          options={['all', 'approval', 'payout', 'dispute', 'account', 'config'].map((t) => ({
            value: t,
            label: t === 'all' ? 'All events' : t[0].toUpperCase() + t.slice(1),
          }))}
          value={filter}
          onChange={setFilter}
        />
      </Toolbar>

      <div className="card card-pad">
        <div className="col" style={{ gap: 0 }}>
          {rows.map((a, i) => (
            <div
              key={a.logId}
              className="row gap12"
              style={{ padding: '14px 6px', borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : 'none', alignItems: 'flex-start' }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  background: 'var(--wash)',
                  border: '1px solid var(--line)',
                  color: 'var(--muted)',
                }}
              >
                <Icon name={TYPE_ICON[a.type] || 'audit'} size={16} />
              </div>
              <div className="fill">
                <div style={{ fontSize: 13.5 }}>
                  <b style={{ fontWeight: 600 }}>{a.actor}</b> <span className="muted">{a.action}</span> <span style={{ fontWeight: 500 }}>{a.target}</span>
                </div>
                <div className="row gap8" style={{ marginTop: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>
                    {a.time}
                  </span>
                  {a.ref && a.ref !== '—' && (
                    <span className="ref" style={{ fontSize: 11 }}>
                      {a.ref}
                    </span>
                  )}
                  {a.ip && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>
                      · IP {a.ip}
                    </span>
                  )}
                </div>
              </div>
              <span className={'badge ' + (TYPE_COLOR[a.type] || 'gray')} style={{ fontSize: 10.5 }}>
                {a.type}
              </span>
            </div>
          ))}
          {!rows.length && !loading && (
            <div className="muted" style={{ padding: 24, textAlign: 'center', fontSize: 13.5 }}>
              No events match this filter.
            </div>
          )}
        </div>
        {d && rows.length < d.total && (
          <div style={{ textAlign: 'center', paddingTop: 16, borderTop: '1px solid var(--line-soft)', marginTop: 4 }}>
            <button className="btn btn-sm" onClick={() => setLimit((l) => l + PAGE)}>
              Load more · {d.total - rows.length} older
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
