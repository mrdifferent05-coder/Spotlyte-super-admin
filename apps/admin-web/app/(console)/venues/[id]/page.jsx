'use client';

// /venues/[id] — tabbed venue detail: Overview · Availability · Bookings ·
// Disputes · Payouts · Activity (Section 8.5).
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { VENUE_DETAIL, APPROVE_VENUE, REJECT_VENUE, FEATURE_VENUE, UNFEATURE_VENUE, PAUSE_VENUE, RESUME_VENUE, REREVIEW_VENUE, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon,
  Avatar,
  Badge,
  Urgency,
  Panel,
  KV,
  Modal,
  Mono,
  Sparkline,
  Tabs,
  ActivityLog,
  ReasonList,
  Stat,
  HeadBar,
  Back,
  EmptyState,
  fmtINR,
  avColor,
} from '@/components/ui';

const REJECT_REASONS = ['Photos insufficient / low quality', 'Pricing outside policy', 'Location unverifiable', 'Duplicate listing', 'Other (specify)'];
const AMENITY_ICON = {
  Floodlights: 'bolt',
  Parking: 'mapPin',
  'Changing rooms': 'users',
  'Drinking water': 'wallet',
  Washrooms: 'building',
  'Seating / gallery': 'venues',
  'Equipment rental': 'bookings',
  'First aid': 'shield',
  CCTV: 'eye',
  Cafeteria: 'star',
};
const FEATURE_SLOTS = [
  { title: 'Home spotlight', sub: 'Top of home feed · max reach', rate: 25000 },
  { title: 'Search top', sub: 'Pinned above search results', rate: 12000 },
  { title: 'City banner', sub: 'Banner across a city page', rate: 15000 },
];

export default function VenueDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState(0);
  const [note, setNote] = useState('');
  const [featSlot, setFeatSlot] = useState(0);
  const [featMonths, setFeatMonths] = useState(1);

  const { data, refetch } = useQuery(VENUE_DETAIL, { variables: { venueId: id } });
  const opts = { ...REFRESH_NAV, onCompleted: () => refetch() };
  const [approve] = useMutation(APPROVE_VENUE, opts);
  const [reject] = useMutation(REJECT_VENUE, opts);
  const [feature] = useMutation(FEATURE_VENUE, opts);
  const [unfeature] = useMutation(UNFEATURE_VENUE, opts);
  const [pause] = useMutation(PAUSE_VENUE, opts);
  const [resume] = useMutation(RESUME_VENUE, opts);
  const [reReview] = useMutation(REREVIEW_VENUE, opts);

  const d = data?.getAdminVenueDetail;
  if (!d)
    return (
      <div className="page">
        <div className="muted" style={{ padding: 40 }}>
          Loading venue…
        </div>
      </div>
    );
  const v = d.venue;
  const status = v.venueStatus;
  const pending = ['pending', 'review'].includes(status);
  const c = v.color || avColor(v.venueName);
  const ps = d.payoutSummary || {};

  const subTabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'availability', label: 'Availability' },
    { value: 'bookings', label: 'Bookings', count: d.bookings.length },
    { value: 'disputes', label: 'Disputes', count: d.disputes.length },
    { value: 'payouts', label: 'Payouts', count: d.payouts.length },
    { value: 'activity', label: 'Activity' },
  ];

  const run = async (fn, vars, fallback, key) => {
    const r = await fn({ variables: vars });
    toast(r.data?.[key]?.message || fallback);
  };

  return (
    <div className="page">
      <Back label="All venues" onClick={() => router.push('/venues')} />
      <HeadBar
        avatar={<div className="thumb lg" style={{ background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 55%, #000))`, width: 56, height: 56 }} />}
        title={v.venueName}
        badges={
          <>
            <Badge status={status} />
            {v.featured && (
              <span className="badge lime-chip">
                <Icon name="crown" size={13} />
                Featured
              </span>
            )}
            <span className="badge gray" style={{ fontSize: 11 }}>
              {v.venueId}
            </span>
          </>
        }
        sub={
          <>
            {v.sport} ·{' '}
            <a className="lk" onClick={() => d.ownerId && router.push(`/owners/${d.ownerId}`)}>
              {v.ownerName}
            </a>{' '}
            · {v.address} · {v.courtCount} courts
          </>
        }
        actions={
          pending ? (
            <>
              <button className="btn btn-danger" onClick={() => setModal('reject')}>
                <Icon name="x" size={16} />
                Reject
              </button>
              <button className="btn btn-primary" onClick={() => run(approve, { venueId: v.venueId }, 'Venue approved · live on marketplace', 'adminApproveVenueV2')}>
                <Icon name="check" size={16} />
                Approve venue
              </button>
            </>
          ) : status === 'live' ? (
            <>
              {v.featured ? (
                <button className="btn btn-dark" onClick={() => run(unfeature, { venueId: v.venueId }, 'Removed from featured', 'adminUnfeatureVenue')}>
                  <Icon name="crown" size={16} />
                  Unfeature
                </button>
              ) : (
                <button className="btn" onClick={() => setModal('feature')}>
                  <Icon name="crown" size={16} />
                  Feature venue
                </button>
              )}
              <button className="btn" onClick={() => run(pause, { venueId: v.venueId }, 'Venue paused', 'adminPauseVenue')}>
                <Icon name="pause" size={16} />
                Pause listing
              </button>
            </>
          ) : status === 'paused' ? (
            <button className="btn btn-primary" onClick={() => run(resume, { venueId: v.venueId }, 'Venue live', 'adminResumeVenue')}>
              <Icon name="play" size={16} />
              Resume
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => run(reReview, { venueId: v.venueId }, 'Back in review queue', 'adminReReviewVenue')}>
              <Icon name="refresh" size={16} />
              Re-review
            </button>
          )
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <Stat label="GMV · 30D" value={fmtINR(v.revenue30d)} />
        <Stat label="BOOKINGS · 30D" value={v.bookings30d || '—'} />
        <Stat label="OCCUPANCY" value={(v.occupancy || 0) + '%'} />
        <Stat label="RATING" value={v.avgRating || '—'} sub={`${v.reviewCount} reviews`} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={subTabs} />

      {tab === 'overview' && <OverviewTab d={d} v={v} c={c} router={router} setTab={setTab} />}
      {tab === 'availability' && <AvailabilityTab d={d} />}
      {tab === 'bookings' && <BookingsTab d={d} router={router} />}
      {tab === 'disputes' && <DisputesTab d={d} router={router} />}
      {tab === 'payouts' && <PayoutsTab d={d} ps={ps} router={router} />}
      {tab === 'activity' && (
        <Panel eyebrow={`INTERNAL ACTIVITY · ${v.venueId}`} title="Everything we did here.">
          <ActivityLog items={d.activity} />
        </Panel>
      )}

      {modal === 'reject' && (
        <Modal
          title="Reject venue listing"
          sub={`${v.venueName} · ${v.venueId}`}
          onClose={() => setModal(null)}
          foot={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  const r = await reject({ variables: { venueId: v.venueId, reason: REJECT_REASONS[reason], note } });
                  setModal(null);
                  toast(r.data?.adminRejectVenue?.message || 'Listing rejected · owner notified');
                }}
              >
                Reject & notify
              </button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
            The owner is notified and can resubmit after fixes.
          </p>
          <ReasonList options={REJECT_REASONS} value={reason} onChange={setReason} />
          <div className="field" style={{ marginTop: 8 }}>
            <label>Note to owner</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to change…" />
          </div>
        </Modal>
      )}

      {modal === 'feature' && (
        <Modal
          title="Feature this venue"
          sub={`${v.venueName} · ${v.city}`}
          onClose={() => setModal(null)}
          width={520}
          foot={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const slot = FEATURE_SLOTS[featSlot].title;
                  const r = await feature({ variables: { venueId: v.venueId, slot, months: featMonths } });
                  setModal(null);
                  toast(r.data?.adminFeatureVenue?.message || `${v.venueName} featured · ${slot}`);
                }}
              >
                <Icon name="crown" size={16} />
                Feature · {fmtINR(FEATURE_SLOTS[featSlot].rate * featMonths)}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Placement slot</label>
            <ReasonList
              options={FEATURE_SLOTS.map((s) => ({
                title: s.title,
                sub: s.sub,
                right: (
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    ₹{s.rate.toLocaleString('en-IN')}/mo
                  </span>
                ),
              }))}
              value={featSlot}
              onChange={setFeatSlot}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Duration</label>
            <div className="row gap8">
              {[1, 2, 3].map((m) => (
                <button key={m} className={'chip' + (featMonths === m ? ' on' : '')} onClick={() => setFeatMonths(m)} style={{ flex: 1, justifyContent: 'center' }}>
                  {m} month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="row between" style={{ marginTop: 16, padding: '12px 14px', background: 'var(--lime)', borderRadius: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#0E0E0C' }}>
              {FEATURE_SLOTS[featSlot].title} · {featMonths} mo
            </span>
            <span className="num" style={{ fontSize: 18, color: '#0E0E0C' }}>
              {fmtINR(FEATURE_SLOTS[featSlot].rate * featMonths)}
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Overview tab (3 columns) ──────────────────────────
function OverviewTab({ d, v, c, router, setTab }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr', alignItems: 'start' }}>
      <div className="col gap16">
        <Panel eyebrow={`PHOTOS · ${d.photos.length}`} title="How it shows up.">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {d.photos.map((_p, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  background: `linear-gradient(${135 + i * 25}deg, ${c}, color-mix(in oklab, ${c} 50%, #000))`,
                  position: 'relative',
                }}
              >
                {i === 0 && (
                  <span className="badge solid-dark" style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 10 }}>
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          eyebrow="RECENT BOOKINGS"
          title="Live activity."
          pad={false}
          action={
            <button className="btn btn-sm" onClick={() => setTab('bookings')}>
              View all
              <Icon name="arrowRight" size={14} />
            </button>
          }
        >
          <div style={{ padding: '4px 10px 10px' }}>
            {d.recentBookings.length ? (
              d.recentBookings.map((b) => (
                <div
                  key={b.bookingId}
                  className="row gap12"
                  style={{ padding: '11px 14px', borderRadius: 11, cursor: 'pointer' }}
                  onClick={() => router.push(`/bookings/${b.bookingId}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wash)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <Avatar color={b.color} init={b.initials} />
                  <div className="fill">
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{b.customerName}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {b.courtName} · {b.date} · {b.timeRange}
                    </div>
                  </div>
                  <Badge status={b.status} />
                  <span className="num" style={{ fontSize: 14, width: 62, textAlign: 'right' }}>
                    {fmtINR(b.amount, { full: true })}
                  </span>
                </div>
              ))
            ) : (
              <div className="muted" style={{ padding: 16, fontSize: 13 }}>
                No bookings yet.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="col gap16">
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            GAMES OFFERED
          </div>
          <div className="chips">
            {d.games.map((g) => (
              <span key={g} className="badge brand-chip" style={{ height: 28 }}>
                <Icon name="venues" size={13} />
                {g}
              </span>
            ))}
          </div>
        </div>
        <Panel eyebrow={`COURTS · ${d.courts.length}`} title="What can be booked." pad={false}>
          <div style={{ padding: '4px 8px 8px' }}>
            {d.courts.map((ct, i) => (
              <div key={i} className="row gap12" style={{ padding: '11px 14px', borderBottom: i < d.courts.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--wash)',
                    border: '1px solid var(--line)',
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="venues" size={16} />
                </div>
                <div className="fill">
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
                    {ct.courtName} · {ct.sport}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>
                    {ct.surface} · {ct.size}
                  </div>
                </div>
                <span className="badge green" style={{ fontSize: 10.5 }}>
                  <span className="dot" />
                  Active
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            AMENITIES
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {d.amenities.map((a) => (
              <div key={a} className="row gap8" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--brand-tint)',
                    color: 'var(--brand)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={AMENITY_ICON[a] || 'check'} size={14} />
                </div>
                {a}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col gap16">
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            LISTING DETAILS
          </div>
          <KV
            items={[
              [
                'Owner',
                <a key="o" className="lk" onClick={() => d.listing?.owner?.ownerId && router.push(`/owners/${d.listing.owner.ownerId}`)}>
                  {d.listing?.owner?.name}
                </a>,
              ],
              ['Sport', d.listing?.sport],
              ['Courts', d.listing?.courts],
              ['City', d.listing?.city],
              ['Address', d.listing?.address],
              ['Listing ID', <Mono key="l">{d.listing?.listingId}</Mono>],
            ]}
          />
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            PRICING · PER HOUR
          </div>
          <KV
            items={[
              ['Weekday off-peak', `₹${Number(d.pricing?.offPeak || 0).toLocaleString('en-IN')}`],
              ['Weekday peak', `₹${Number(d.pricing?.peak || 0).toLocaleString('en-IN')}`],
              ['Weekend', `₹${Number(d.pricing?.weekend || 0).toLocaleString('en-IN')}`],
              ['Platform fee', `${d.pricing?.feePct ?? 18}%`],
            ]}
          />
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            GMV TREND
          </div>
          <Sparkline data={d.spark} h={56} color="var(--brand)" />
        </div>
      </div>
    </div>
  );
}

// ── Availability tab ──────────────────────────────────
function AvailabilityTab({ d }) {
  const legend = (
    <div className="row gap12" style={{ fontSize: 11.5 }}>
      {[
        ['Booked', 'var(--brand)'],
        ['Open', 'var(--paper)'],
        ['Blocked', 'var(--line)'],
      ].map((l, i) => (
        <span key={i} className="row gap6" style={{ color: 'var(--muted)' }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: l[1], border: '1px solid var(--line)' }} />
          {l[0]}
        </span>
      ))}
    </div>
  );
  const times = d.courts[0]?.slots?.map((s) => s.time) || [];
  return (
    <Panel eyebrow={`SLOT AVAILABILITY · ${d.payoutSummary?.todayEyebrow || 'TODAY'}`} title="Courts & slots." action={legend} pad={false}>
      <div style={{ overflowX: 'auto', padding: '6px 0 4px' }}>
        <table className="tbl" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 24 }}>Court</th>
              {times.map((t) => (
                <th key={t} className="num-col" style={{ textAlign: 'center' }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.courts.map((ct, ci) => (
              <tr key={ci}>
                <td style={{ paddingLeft: 24 }}>
                  <div className="strong">{ct.courtName}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {ct.sport}
                  </div>
                </td>
                {ct.slots.map((s, si) => {
                  const sty =
                    s.state === 'booked'
                      ? { background: 'var(--brand)', color: '#fff' }
                      : s.state === 'blocked'
                        ? { background: 'var(--line)', color: 'var(--muted)' }
                        : { background: 'var(--paper)', color: 'var(--muted-2)', border: '1px dashed var(--line)' };
                  return (
                    <td key={si} style={{ textAlign: 'center', padding: '6px 5px' }}>
                      <div style={{ height: 34, borderRadius: 7, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 600, ...sty }}>
                        {s.state === 'booked' ? 'Booked' : s.state === 'blocked' ? 'Blocked' : 'Open'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Bookings tab ──────────────────────────────────────
function BookingsTab({ d, router }) {
  return (
    <Panel eyebrow={`ALL BOOKINGS · ${d.bookings.length}`} title="Every slot here." pad={false}>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              {['Booking', 'Customer', 'Court', 'Date · Time', 'Payment', 'Amount', 'Status'].map((h, i) => (
                <th key={i} className={h === 'Amount' ? 'num-col' : ''} style={i === 0 ? { paddingLeft: 24 } : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.bookings.length ? (
              d.bookings.map((b) => (
                <tr key={b.bookingId} className="clickable" onClick={() => router.push(`/bookings/${b.bookingId}`)}>
                  <td style={{ paddingLeft: 24 }}>
                    <span className="ref">#{b.bookingId}</span>
                  </td>
                  <td>
                    <div className="who">
                      <Avatar color={b.color} init={b.initials} />
                      <span className="nm">{b.customerName}</span>
                    </div>
                  </td>
                  <td className="muted">{b.courtName}</td>
                  <td>
                    <div className="strong">{b.date}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {b.timeRange} · {b.duration}
                    </div>
                  </td>
                  <td>
                    <span className="badge gray" style={{ fontSize: 11 }}>
                      {b.method}
                    </span>
                  </td>
                  <td className="num-col strong">{fmtINR(b.amount, { full: true })}</td>
                  <td>
                    <Badge status={b.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  No bookings yet for this venue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Disputes tab ──────────────────────────────────────
function DisputesTab({ d, router }) {
  if (!d.disputes.length) {
    return <EmptyState icon="shield" title="No disputes." sub="This venue has a clean record — no customer disputes raised." />;
  }
  return (
    <Panel eyebrow={`DISPUTES · ${d.disputes.length}`} title="Where it broke." pad={false}>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              {['Ref', 'Urgency', 'Customer', 'Slot', 'Reason', 'Amount', 'Status'].map((h, i) => (
                <th key={i} className={h === 'Amount' ? 'num-col' : ''} style={i === 0 ? { paddingLeft: 24 } : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.disputes.map((x) => (
              <tr key={x.disputeId} className="clickable" onClick={() => router.push(`/disputes/${x.disputeId}`)}>
                <td style={{ paddingLeft: 24 }}>
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
                <td className="muted" style={{ fontSize: 12 }}>
                  {x.slotLabel}
                </td>
                <td>{x.reason}</td>
                <td className="num-col strong">{fmtINR(x.amount, { full: true })}</td>
                <td>
                  <Badge status={x.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Payouts tab ───────────────────────────────────────
function PayoutsTab({ d, ps, router }) {
  return (
    <div className="col gap16">
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Stat label="RECEIVED · LIFETIME" value={fmtINR(ps.receivedTotal)} sub={`${ps.receivedCount ?? 0} settlements`} />
        <div className="card card-pad" style={{ background: 'var(--info-soft)', borderColor: 'color-mix(in oklab, var(--info) 22%, transparent)' }}>
          <div className="eyebrow" style={{ color: 'var(--info)' }}>
            UPCOMING PAYOUT
          </div>
          <div className="num" style={{ fontSize: 24, marginTop: 8, color: 'var(--info)' }}>
            {fmtINR(ps.upcomingAmount)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
            {ps.upcomingLabel}
          </div>
        </div>
        <Stat label="PLATFORM FEE" value={`${ps.feePct ?? 18}%`} sub={`${ps.tierName ?? 'Standard'} tier`} />
      </div>
      <Panel eyebrow="PAYOUT HISTORY" title="Money received." pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                {['Payout', 'Period', 'Gross', 'Fee', 'Net', 'Status', ''].map((h, i) => (
                  <th key={i} className={['Gross', 'Fee', 'Net'].includes(h) ? 'num-col' : ''} style={i === 0 ? { paddingLeft: 24 } : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.payouts.length ? (
                d.payouts.map((p) => (
                  <tr key={p.payoutId} className="clickable" onClick={() => router.push(`/payouts/${p.payoutId}`)}>
                    <td style={{ paddingLeft: 24 }}>
                      <span className="ref">#{p.payoutId}</span>
                    </td>
                    <td className="muted">{p.period}</td>
                    <td className="num-col muted">{fmtINR(p.gross)}</td>
                    <td className="num-col" style={{ color: 'var(--danger)' }}>
                      −{fmtINR(p.fee)}
                    </td>
                    <td className="num-col strong">{fmtINR(p.amount)}</td>
                    <td>
                      <Badge status={p.status} />
                    </td>
                    <td className="num-col">
                      <Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                    No payouts yet for this venue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
