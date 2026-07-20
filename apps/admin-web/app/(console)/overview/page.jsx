'use client';

// /overview — Platform command center (Section 8.1).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { OVERVIEW } from '@/lib/gql';
import { downloadCSV } from '@/lib/csv';
import { Icon, Sparkline, StatCard, MiniStat, Panel, It, Badge, Urgency, Avatar, Seg, Bar, VenueThumb, fmtINR } from '@/components/ui';

const TONE_COLOR = { brand: 'var(--brand)', info: 'var(--info)', danger: 'var(--danger)', warn: 'var(--warn)' };

export default function OverviewPage() {
  const router = useRouter();
  const [range, setRange] = useState('30D');
  const { data } = useQuery(OVERVIEW, { variables: { range } });
  const d = data?.getAdminOverviewStat;
  if (!d)
    return (
      <div className="page page-wide">
        <div className="muted" style={{ padding: 40 }}>
          Loading command center…
        </div>
      </div>
    );

  const exportCSV = () =>
    downloadCSV(`spotlyte-overview-${range}`, [
      ...d.heroKpis.map((k) => ({ section: 'KPI', label: k.label, value: k.value + (k.unit || ''), meta: k.meta })),
      ...d.sportMix.map((s) => ({ section: 'Sport mix', label: s.sport, value: `${s.percent}%`, meta: fmtINR(s.revenue) })),
      ...d.topVenues.map((v) => ({ section: 'Top venue', label: v.venueName, value: fmtINR(v.revenue30d), meta: `${v.occupancy}% occ · ${v.avgRating}★` })),
    ]);

  return (
    <div className="page page-wide">
      {/* hero KPIs */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {d.heroKpis.map((k) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
            unit={k.unit}
            delta={k.deltaPercent}
            meta={k.meta}
            spark={k.spark}
            color={TONE_COLOR[k.tone] || 'var(--brand)'}
          />
        ))}
      </div>

      {/* mini stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 'var(--gap)' }}>
        {d.miniKpis.map((k) => (
          <MiniStat key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon} onClick={() => router.push(k.route)} />
        ))}
      </div>

      {/* section header */}
      <div className="sec-head" style={{ marginTop: 36 }}>
        <div className="l">
          <div className="eyebrow" style={{ marginBottom: 7 }}>
            {d.dateLine}
          </div>
          <div className="display-h" style={{ fontSize: 30 }}>
            Everything that needs <It>you</It> today.
          </div>
        </div>
        <div className="row gap8">
          <Seg options={['Today', 'Week', '30D']} value={range} onChange={setRange} light />
          <button className="btn" onClick={exportCSV}>
            <Icon name="download" size={16} />
            Export
          </button>
        </div>
      </div>

      {/* approvals + sport mix */}
      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' }}>
        <Panel
          eyebrow={`APPROVALS · ${d.approvalQueue.length} WAITING`}
          title="Clear the gate."
          pad={false}
          action={
            <button className="btn btn-sm" onClick={() => router.push('/owners')}>
              Open queue
              <Icon name="arrowRight" size={15} />
            </button>
          }
        >
          <div style={{ padding: '4px 10px 10px' }}>
            {d.approvalQueue.length === 0 && (
              <div className="muted" style={{ padding: 16, fontSize: 13 }}>
                Queue clear — nothing waiting on you.
              </div>
            )}
            {d.approvalQueue.map((q, i) => (
              <div
                key={i}
                className="row gap12"
                style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer' }}
                onClick={() => router.push(q.kind === 'Venue' ? `/venues/${q.refId}` : `/owners/${q.refId}`)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wash)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <Avatar color={q.color} init={q.initials} />
                <div className="fill">
                  <div className="row gap8">
                    <b style={{ fontSize: 14, fontWeight: 600 }}>{q.name}</b>
                    <span className="badge gray" style={{ height: 20, fontSize: 10.5 }}>
                      {q.kind}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {q.who} · {q.meta}
                  </div>
                </div>
                <Badge status={q.status} />
                <span className="muted mono" style={{ fontSize: 11, width: 64, textAlign: 'right' }}>
                  {q.submittedAgo || '—'}
                </span>
                <Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel eyebrow="SPORT MIX · ALL VENUES" title="What people playing.">
          <div className="col gap16" style={{ marginTop: 4 }}>
            {d.sportMix.map((s) => (
              <div key={s.sport}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <div className="row gap8">
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.colorVar }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.sport}</span>
                  </div>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {fmtINR(s.revenue)} · {s.percent}%
                  </span>
                </div>
                <div className="bar">
                  <i style={{ width: s.percent + '%', background: s.colorVar }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* open disputes */}
      <div style={{ marginTop: 36 }}>
        <Panel
          eyebrow={`DISPUTES · ${d.openDisputes.length} OPEN`}
          title="Settle these before money leaves."
          pad={false}
          action={
            <button className="btn btn-sm" onClick={() => router.push('/disputes')}>
              Open queue
              <Icon name="arrowRight" size={15} />
            </button>
          }
        >
          <div style={{ padding: '8px 10px 6px', overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Ref', 'Urgency', 'Customer', 'Slot · Venue', 'Reason', 'Amount', 'Opened', ''].map((h, i) => (
                    <th key={i} className={h === 'Amount' ? 'num-col' : ''}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.openDisputes.map((x) => (
                  <tr key={x.disputeId} className="clickable" onClick={() => router.push(`/disputes/${x.disputeId}`)}>
                    <td>
                      <span className="ref">#{x.disputeId}</span>
                    </td>
                    <td>
                      <Urgency level={x.urgency} />
                    </td>
                    <td>
                      <div className="who">
                        <Avatar color={x.color} init={x.avatarInitials} />
                        <span className="nm">{x.customerName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="strong">{x.slotLabel}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {x.venueName}
                      </div>
                    </td>
                    <td>{x.reason}</td>
                    <td className="num-col strong">{fmtINR(x.amount, { full: true })}</td>
                    <td className="muted">{x.openedLabel}</td>
                    <td className="num-col">
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/disputes/${x.disputeId}`);
                        }}
                      >
                        Resolve
                        <Icon name="arrowRight" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* top venues */}
      <div style={{ marginTop: 36 }}>
        <Panel
          eyebrow="TOP VENUES · BY GMV"
          title="Compare the floors."
          pad={false}
          action={
            <button className="btn btn-sm" onClick={() => router.push('/venues')}>
              All venues
              <Icon name="arrowRight" size={15} />
            </button>
          }
        >
          <div style={{ padding: '8px 10px 6px', overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Venue', 'Owner', 'GMV · 30D', 'Trend', 'Bookings', 'Occupancy', 'Rating', ''].map((h, i) => (
                    <th key={i} className={['GMV · 30D', 'Bookings'].includes(h) ? 'num-col' : ''}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.topVenues.map((v) => (
                  <tr key={v.venueId} className="clickable" onClick={() => router.push(`/venues/${v.venueId}`)}>
                    <td>
                      <div className="who">
                        <VenueThumb name={v.venueName} color={v.color} />
                        <div>
                          <div className="nm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {v.venueName}
                            {v.featured && <Icon name="crown" size={14} style={{ color: 'var(--warn)' }} />}
                          </div>
                          <div className="sub">{v.address}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{v.ownerName}</td>
                    <td className="num-col strong">{fmtINR(v.revenue30d)}</td>
                    <td style={{ width: 110 }}>
                      <Sparkline data={v.spark} h={30} color={v.revenue30d > 200000 ? 'var(--brand)' : 'var(--warn)'} />
                    </td>
                    <td className="num-col">{v.bookings30d}</td>
                    <td>
                      <div className="row gap8">
                        <Bar pct={v.occupancy} color={v.occupancy > 70 ? 'var(--brand)' : 'var(--warn)'} width={60} />
                        <span className="muted" style={{ fontSize: 12 }}>
                          {v.occupancy}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="row gap6">
                        <Icon name="star" size={13} style={{ color: 'var(--warn)', fill: 'var(--warn)' }} />
                        <span className="strong">{v.avgRating}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          · {v.reviewCount}
                        </span>
                      </span>
                    </td>
                    <td className="num-col">
                      <Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
