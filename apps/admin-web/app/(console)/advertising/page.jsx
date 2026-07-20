'use client';

// /advertising — paid featured placements (Section 8.14).
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { AD_LIST, CREATE_PLACEMENT, APPROVE_PLACEMENT, VENUE_PAGE, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import { Icon, Badge, StatCard, SecHead, It, Tabs, Modal, ReasonList, Bar, fmtINR } from '@/components/ui';

const SLOT_INFO = {
  'Home spotlight': { sub: 'Top of home feed · max reach', rate: 25000 },
  'Search top': { sub: 'Pinned above search results', rate: 12000 },
  'City banner': { sub: 'Banner across a city page', rate: 15000 },
};

export default function AdvertisingPage() {
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const { data, refetch } = useQuery(AD_LIST, { variables: { tab } });
  const [approvePlacement] = useMutation(APPROVE_PLACEMENT, { ...REFRESH_NAV, onCompleted: () => refetch() });
  const d = data?.getAdminAdList;
  const counts = d?.counts || {};
  const stats = d?.stats || {};

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow="ADVERTISING · FEATURED PLACEMENTS"
        title={
          <>
            Paid <It>spotlight</It>.
          </>
        }
      >
        <button className="btn btn-dark" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} />
          New placement
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Active campaigns" value={stats.active ?? '—'} meta={`${stats.review ?? 0} in review`} />
        <StatCard label="Ad revenue · 30D" value={fmtINR(stats.revenue30)} delta={stats.revenueDelta} meta="Spotlight + search slots" color="var(--brand)" />
        <StatCard label="Avg CTR" value={stats.avgCtr ?? '—'} unit="%" meta={stats.bestSlot || 'Home spotlight best'} />
        <StatCard
          label="Slot fill rate"
          value={stats.fillRate ?? '—'}
          unit="%"
          meta={`${stats.openSlots ?? 0} slots open in ${stats.openCity || 'Pune'}`}
          color="var(--info)"
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'review', label: 'In review', count: counts.review },
          { value: 'scheduled', label: 'Scheduled', count: counts.scheduled },
        ]}
      />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              {['Campaign', 'Slot', 'City', 'Flight', 'Budget', 'Spent', 'Clicks', 'Status', ''].map((h, i) => (
                <th key={i} className={['Budget', 'Spent', 'Clicks'].includes(h) ? 'num-col' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(d?.ads || []).map((a) => (
              <tr key={a.adId}>
                <td>
                  <div className="strong">{a.venue}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {a.owner}
                  </div>
                </td>
                <td>
                  <span className="badge blue" style={{ fontSize: 11 }}>
                    <Icon name="megaphone" size={12} />
                    {a.slot}
                  </span>
                </td>
                <td className="muted">{a.city}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {a.start.slice(5)} → {a.end.slice(5)}
                </td>
                <td className="num-col strong">{fmtINR(a.budget)}</td>
                <td className="num-col">
                  <span className="muted">{fmtINR(a.spent)}</span>
                </td>
                <td className="num-col">{a.clicks || '—'}</td>
                <td>
                  <Badge status={a.status} />
                </td>
                <td className="num-col">
                  {a.status === 'review' ? (
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={async () => {
                        const r = await approvePlacement({ variables: { adId: a.adId } });
                        toast(r.data?.adminApprovePlacement?.message || `Placement approved · ${a.venue}`);
                      }}
                    >
                      Approve
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-ghost" onClick={() => setViewing(a)}>
                      <Icon name="eye" size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!(d?.ads || []).length && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  No placements in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <PlacementModal
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false);
            refetch();
          }}
        />
      )}

      {viewing && (
        <Modal
          title={viewing.venue}
          sub={`${viewing.slot} · ${viewing.city} · ${viewing.start} → ${viewing.end}`}
          onClose={() => setViewing(null)}
          width={460}
          foot={
            <button className="btn" onClick={() => setViewing(null)}>
              Close
            </button>
          }
        >
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div className="card card-pad" style={{ padding: 16 }}>
              <div className="eyebrow">IMPRESSIONS</div>
              <div className="num" style={{ fontSize: 20, marginTop: 6 }}>
                {(viewing.impressions || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="card card-pad" style={{ padding: 16 }}>
              <div className="eyebrow">CLICKS</div>
              <div className="num" style={{ fontSize: 20, marginTop: 6 }}>
                {(viewing.clicks || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="card card-pad" style={{ padding: 16 }}>
              <div className="eyebrow">CTR</div>
              <div className="num" style={{ fontSize: 20, marginTop: 6 }}>
                {viewing.impressions ? ((viewing.clicks / viewing.impressions) * 100).toFixed(1) : '0'}%
              </div>
            </div>
          </div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            SPEND PACING
          </div>
          <Bar pct={(viewing.spent / Math.max(1, viewing.budget)) * 100} color="var(--info)" />
          <div className="row between muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            <span>{fmtINR(viewing.spent, { full: true })} spent</span>
            <span>of {fmtINR(viewing.budget, { full: true })} budget</span>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PlacementModal({ onClose, onDone }) {
  const toast = useToast();
  const { data } = useQuery(VENUE_PAGE, { variables: { tab: 'live' } });
  const venues = data?.getAdminVenuePage?.venues || [];
  const [venueId, setVenueId] = useState('');
  const [slotIdx, setSlotIdx] = useState(0);
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [budget, setBudget] = useState(25000);
  const [createPlacement, { loading }] = useMutation(CREATE_PLACEMENT, REFRESH_NAV);

  const slots = Object.entries(SLOT_INFO);
  const slotName = slots[slotIdx][0];
  const venue = venues.find((v) => v.venueId === venueId);

  return (
    <Modal
      title="New placement"
      sub="Book a featured advertising slot"
      onClose={onClose}
      width={560}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={loading || !venueId}
            onClick={async () => {
              const { data: res } = await createPlacement({ variables: { input: { venueId, slot: slotName, start, end, budget } } });
              const r = res?.adminCreatePlacement;
              toast(r?.message || 'Placement created · sent for review');
              if (r?.success) onDone();
            }}
          >
            <Icon name="megaphone" size={16} />
            Create placement
          </button>
        </>
      }
    >
      <div className="field">
        <label>Venue</label>
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          <option value="">Select a live venue…</option>
          {venues.map((v) => (
            <option key={v.venueId} value={v.venueId}>
              {v.venueName} — {v.city}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Placement slot</label>
        <ReasonList
          options={slots.map(([name, info]) => ({
            title: name,
            sub: info.sub,
            right: (
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                ₹{info.rate.toLocaleString('en-IN')}/mo
              </span>
            ),
          }))}
          value={slotIdx}
          onChange={(i) => {
            setSlotIdx(i);
            setBudget(slots[i][1].rate);
          }}
        />
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label>Start date</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>End date</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Budget (₹)</label>
        <input type="number" value={budget} onChange={(e) => setBudget(+e.target.value)} />
      </div>
      <div className="row between" style={{ marginTop: 16, padding: '12px 14px', background: 'var(--info-soft)', borderRadius: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {slotName} · {venue?.city || 'pick a venue'}
        </span>
        <span className="num" style={{ fontSize: 18, color: 'var(--info)' }}>
          {fmtINR(budget)}
        </span>
      </div>
    </Modal>
  );
}
