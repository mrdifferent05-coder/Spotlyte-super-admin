'use client';

// /disputes — resolution center list (Section 8.15).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { DISPUTE_PAGE } from '@/lib/gql';
import { Icon, Avatar, Badge, Urgency, StatCard, SecHead, It, Tabs, Toolbar, useSort, Th, Modal, fmtINR } from '@/components/ui';

export default function DisputesPage() {
  const router = useRouter();
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [policy, setPolicy] = useState(false);
  const { data } = useQuery(DISPUTE_PAGE, { variables: { tab, q } });
  const d = data?.getAdminDisputePage;
  const counts = d?.counts || {};
  const stats = d?.stats || {};
  const rows = (d?.disputes || []).map((x) => ({ ...x, id: x.disputeId, customer: x.customerName, venue: x.venueName }));
  const [sorted, sort, toggle] = useSort(rows);

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow={`DISPUTES · ${counts.open ?? '—'} OPEN`}
        title={
          <>
            Where it <It>broke</It>.
          </>
        }
      >
        <button className="btn" onClick={() => setPolicy(true)}>
          <Icon name="settings" size={16} />
          Resolution policy
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Open disputes" value={counts.open ?? '—'} meta={`${stats.investigating ?? 0} investigating`} color="var(--danger)" />
        <StatCard label="Amount at risk" value={fmtINR(stats.atRisk)} meta="Held in escrow" color="var(--warn)" />
        <StatCard
          label="Avg resolution"
          value={stats.avgResolutionDays ?? '—'}
          unit="d"
          delta={stats.avgResolutionDelta}
          meta="Faster than last month"
          color="var(--brand)"
        />
        <StatCard label="Resolved · 30D" value={stats.resolved30 ?? '—'} meta={`${stats.customerFavourPct ?? 0}% in customer favour`} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'open', label: 'Open', count: counts.open },
          { value: 'investigating', label: 'Investigating', count: counts.investigating },
          { value: 'resolved', label: 'Resolved', count: counts.resolved },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />

      <Toolbar q={q} setQ={setQ} placeholder="Search ref, customer, venue, reason…" />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th k="id" sort={sort} toggle={toggle}>
                Ref
              </Th>
              <Th k="urgency" sort={sort} toggle={toggle}>
                Urgency
              </Th>
              <Th k="customer" sort={sort} toggle={toggle}>
                Customer
              </Th>
              <Th k="venue" sort={sort} toggle={toggle}>
                Slot · Venue
              </Th>
              <Th k="reason" sort={sort} toggle={toggle}>
                Reason
              </Th>
              <Th k="amount" sort={sort} toggle={toggle} num>
                Amount
              </Th>
              <Th k="status" sort={sort} toggle={toggle}>
                Status
              </Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((x) => (
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
                    <span className="nm">{x.customer}</span>
                  </div>
                </td>
                <td>
                  <div className="strong">{x.slotLabel}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {x.venue}
                  </div>
                </td>
                <td>{x.reason}</td>
                <td className="num-col strong">{fmtINR(x.amount, { full: true })}</td>
                <td>
                  <Badge status={x.status} />
                </td>
                <td className="num-col">
                  {x.status !== 'resolved' ? (
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/disputes/${x.disputeId}`);
                      }}
                    >
                      Resolve
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
                  No disputes in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {policy && (
        <Modal
          title="Resolution policy"
          sub="How spotlyte adjudicates disputed bookings"
          onClose={() => setPolicy(false)}
          width={540}
          foot={
            <button className="btn" onClick={() => setPolicy(false)}>
              Close
            </button>
          }
        >
          <div className="col gap12" style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            <p>
              <b>1 · Escrow first.</b> The disputed amount is held from the owner's next settlement the moment a dispute opens. Money never leaves while a case is live.
            </p>
            <p>
              <b>2 · Both sides heard.</b> Customer and owner each get 48 hours to attach evidence. Support may request more via the case thread.
            </p>
            <p>
              <b>3 · Outcomes.</b> Full refund · Partial refund (50%) · Wallet credit · Claim rejected. Refunds return to the original payment source within 5–7 working
              days.
            </p>
            <p>
              <b>4 · Repeat offenders.</b> Three upheld disputes on one venue in 90 days triggers an automatic listing review; chargeback-heavy customers are flagged for
              fraud review.
            </p>
            <p>
              <b>5 · Finality.</b> Resolutions are final and logged immutably in the audit trail. Escalations beyond this flow go to legal@spotlyte.in.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
