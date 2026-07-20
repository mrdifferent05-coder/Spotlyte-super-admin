'use client';

// /venues — list with Table | Grid views (Section 8.4).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { VENUE_PAGE } from '@/lib/gql';
import { downloadCSV } from '@/lib/csv';
import { Icon, Badge, StatCard, SecHead, It, Tabs, Toolbar, Seg, useSort, Th, VenueThumb, avColor, fmtINR } from '@/components/ui';

export default function VenuesPage() {
  const router = useRouter();
  const [tab, setTab] = useState('live');
  const [q, setQ] = useState('');
  const [view, setView] = useState('Table');
  const { data } = useQuery(VENUE_PAGE, { variables: { tab, q } });
  const d = data?.getAdminVenuePage;
  const counts = d?.counts || {};
  const stats = d?.stats || {};
  const rows = (d?.venues || []).map((v) => ({
    ...v,
    name: v.venueName,
    owner: v.ownerName,
    status: v.venueStatus,
    courts: v.courtCount,
    revenue: v.revenue30d,
    rating: v.avgRating,
  }));
  const [sorted, sort, toggle] = useSort(rows);

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow={`VENUES · ${counts.live ?? '—'} LIVE`}
        title={
          <>
            Every <It>pitch</It> on the platform.
          </>
        }
      >
        <Seg options={['Table', 'Grid']} value={view} onChange={setView} light />
        <button
          className="btn"
          onClick={() =>
            downloadCSV(
              'spotlyte-venues',
              rows.map((v) => ({
                id: v.venueId,
                venue: v.name,
                owner: v.owner,
                city: v.city,
                status: v.status,
                courts: v.courts,
                gmv30d: v.revenue,
                occupancy: v.occupancy,
                rating: v.rating,
              }))
            )
          }
        >
          <Icon name="download" size={16} />
          Export
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Live venues" value={stats.live ?? '—'} meta={`${stats.courtsTotal ?? '—'} courts total`} />
        <StatCard label="Pending approval" value={stats.pending ?? '—'} meta={`Oldest: ${stats.oldestAgo ?? '—'}`} color="var(--warn)" />
        <StatCard label="Featured" value={stats.featured ?? '—'} meta="Spotlight + search slots" color="var(--info)" />
        <StatCard label="Avg occupancy" value={stats.avgOccupancy ?? '—'} unit="%" delta={stats.occDelta} meta="Peak 6–9 PM weekdays" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'live', label: 'Live', count: counts.live },
          { value: 'pending', label: 'Pending', count: counts.pending },
          { value: 'featured', label: 'Featured', count: counts.featured },
          { value: 'paused', label: 'Paused', count: counts.paused },
        ]}
      />

      <Toolbar q={q} setQ={setQ} placeholder="Search venues, owners, sport…" />

      {view === 'Grid' ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {sorted.map((v) => {
            const c = v.color || avColor(v.name);
            return (
              <div key={v.venueId} className="card" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => router.push(`/venues/${v.venueId}`)}>
                <div
                  style={{
                    height: 120,
                    background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 60%, #000))`,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 12,
                  }}
                >
                  {v.featured && (
                    <span className="badge lime-chip" style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Icon name="crown" size={13} />
                      Featured
                    </span>
                  )}
                  <span className="badge solid-dark">{v.sport}</span>
                </div>
                <div className="card-pad">
                  <div className="row between">
                    <b style={{ fontSize: 15 }}>{v.name}</b>
                    <Badge status={v.status} />
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                    {v.owner} · {v.city}
                  </div>
                  <div className="row between" style={{ marginTop: 14 }}>
                    <div>
                      <div className="eyebrow">GMV 30D</div>
                      <div className="num" style={{ fontSize: 18, marginTop: 3 }}>
                        {fmtINR(v.revenue)}
                      </div>
                    </div>
                    <div className="right">
                      <div className="eyebrow">Occ.</div>
                      <div className="num" style={{ fontSize: 18, marginTop: 3 }}>
                        {v.occupancy}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <Th k="name" sort={sort} toggle={toggle}>
                  Venue
                </Th>
                <Th k="owner" sort={sort} toggle={toggle}>
                  Owner
                </Th>
                <Th k="status" sort={sort} toggle={toggle}>
                  Status
                </Th>
                <Th k="courts" sort={sort} toggle={toggle} num>
                  Courts
                </Th>
                <Th k="revenue" sort={sort} toggle={toggle} num>
                  GMV
                </Th>
                <Th k="occupancy" sort={sort} toggle={toggle} num>
                  Occupancy
                </Th>
                <Th k="rating" sort={sort} toggle={toggle} num>
                  Rating
                </Th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <tr key={v.venueId} className="clickable" onClick={() => router.push(`/venues/${v.venueId}`)}>
                  <td>
                    <div className="who">
                      <VenueThumb name={v.name} color={v.color} />
                      <div>
                        <div className="nm" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {v.name}
                          {v.featured && <Icon name="crown" size={13} style={{ color: 'var(--warn)' }} />}
                        </div>
                        <div className="sub">
                          {v.sport} · {v.city}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{v.owner}</td>
                  <td>
                    <Badge status={v.status} />
                  </td>
                  <td className="num-col strong">{v.courts || '—'}</td>
                  <td className="num-col strong">{fmtINR(v.revenue)}</td>
                  <td className="num-col">{v.occupancy ? v.occupancy + '%' : <span className="dash">—</span>}</td>
                  <td className="num-col">
                    {v.rating ? (
                      <span className="row gap6" style={{ justifyContent: 'flex-end' }}>
                        <Icon name="star" size={13} style={{ color: 'var(--warn)', fill: 'var(--warn)' }} />
                        {v.rating}
                      </span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td className="num-col">
                    {['pending', 'review'].includes(v.status) ? (
                      <button
                        className="btn btn-sm btn-dark"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/venues/${v.venueId}`);
                        }}
                      >
                        Review
                      </button>
                    ) : (
                      <Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} />
                    )}
                  </td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                    No venues in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
