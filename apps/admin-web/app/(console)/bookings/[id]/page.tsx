'use client';

// /bookings/[id] — booking detail + refund flow (Section 8.7).
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { BOOKING_DETAIL, ISSUE_REFUND, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon, Avatar, Badge, Panel, KV, Modal, Mono, StepTimeline, ReasonList, HeadBar, Back, fmtINR,
} from '@/components/ui';

const REFUND_REASONS = [
  'Venue cancelled the slot', 'Facility unavailable / unsafe', 'Customer cancelled in policy window',
  'Double booking', 'Weather / force majeure', 'Goodwill gesture', 'Other (specify)',
];

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [refReason, setRefReason] = useState(0);
  const [refPct, setRefPct] = useState(100);
  const [note, setNote] = useState('');

  const { data, refetch } = useQuery(BOOKING_DETAIL, { variables: { bookingId: id } });
  const [issueRefund] = useMutation(ISSUE_REFUND, { ...REFRESH_NAV, onCompleted: () => refetch() });

  const d = data?.getAdminBookingDetail;
  if (!d) return <div className="page"><div className="muted" style={{ padding: 40 }}>Loading booking…</div></div>;
  const b = d.booking;
  const br = d.breakdown || {};
  const refundAmt = Math.round((b.amount * refPct) / 100);
  const refundable = ['confirmed', 'completed', 'no-show'].includes(b.status);

  return (
    <div className="page">
      <Back label="All bookings" onClick={() => router.push('/bookings')} />
      <HeadBar
        avatar={<Avatar color={b.color} init={b.initials} size="lg" />}
        title={`#${b.bookingId}`}
        badges={<Badge status={b.status} />}
        sub={
          <>
            <a className="lk" onClick={() => b.customerId && router.push(`/users/${b.customerId}`)}>{b.customerName}</a>
            {' '}· <a className="lk" onClick={() => b.venueId && router.push(`/venues/${b.venueId}`)}>{b.venueName}</a>
            {' '}· {b.courtName}
          </>
        }
        actions={
          <>
            {refundable && (
              <button className="btn" style={{ color: 'var(--danger)', borderColor: 'color-mix(in oklab, var(--danger) 35%, var(--line))' }} onClick={() => setModal(true)}>
                <Icon name="wallet" size={16} />Issue refund
              </button>
            )}
            <button className="btn" onClick={() => { toast('Receipt downloaded'); }}>
              <Icon name="download" size={16} />Download receipt
            </button>
          </>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
        <div className="col gap16">
          <Panel eyebrow="TIMELINE" title="What happened.">
            <StepTimeline steps={d.timeline} />
          </Panel>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>PAYMENT BREAKDOWN</div>
            <div className="col gap10">
              <div className="row between"><span className="muted">Slot total</span><span className="strong" style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmtINR(br.amount, { full: true })}</span></div>
              <div className="row between"><span className="muted">Platform fee ({br.feePct}%)</span><span style={{ color: 'var(--danger)' }}>−{fmtINR(br.fee, { full: true })}</span></div>
              {d.refund && (
                <div className="row between"><span className="muted">Refunded ({d.refund.pct}%)</span><span style={{ color: 'var(--danger)' }}>−{fmtINR(d.refund.amount, { full: true })}</span></div>
              )}
              <hr className="hr" style={{ margin: '4px 0' }} />
              <div className="row between">
                <span style={{ fontWeight: 600 }}>Owner earns</span>
                <span className="num" style={{ fontSize: 18 }}>{fmtINR(br.ownerEarns, { full: true })}</span>
              </div>
            </div>
          </div>
          {d.refund && (
            <div className="card card-pad" style={{ background: 'var(--danger-soft)', borderColor: 'color-mix(in oklab, var(--danger) 22%, transparent)' }}>
              <div className="row gap10">
                <Icon name="wallet" size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <div>
                  <b style={{ fontSize: 13 }}>Refund issued · {fmtINR(d.refund.amount, { full: true })} ({d.refund.pct}%)</b>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{d.refund.reason}{d.refund.note ? ` — ${d.refund.note}` : ''}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col gap16">
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>BOOKING DETAILS</div>
            <KV items={[
              ['Customer', <a key="c" className="lk" onClick={() => b.customerId && router.push(`/users/${b.customerId}`)}>{b.customerName}</a>],
              ['Venue', <a key="v" className="lk" onClick={() => b.venueId && router.push(`/venues/${b.venueId}`)}>{b.venueName}</a>],
              ['Court', b.courtName],
              ['Sport', b.sport],
              ['Date', b.date],
              ['Time', `${b.timeRange} · ${b.duration}`],
              ['City', b.city],
            ]} />
          </div>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>PAYMENT</div>
            <KV items={[
              ['Method', d.method],
              ['Status', <Badge key="s" status={d.paid ? 'paid' : 'failed'} />],
              ['Txn ref', <Mono key="t">{d.txnRef}</Mono>],
            ]} />
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          title="Issue refund"
          sub={`#${b.bookingId} · ${b.customerName}`}
          onClose={() => setModal(false)}
          width={480}
          foot={
            <>
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={refundAmt <= 0}
                onClick={async () => {
                  const r = await issueRefund({
                    variables: { bookingId: b.bookingId, percent: refPct, reason: REFUND_REASONS[refReason], note },
                  });
                  setModal(false);
                  toast(r.data?.adminIssueRefund?.message || `Refund of ${fmtINR(refundAmt, { full: true })} (${refPct}%) issued`);
                }}
              >
                <Icon name="wallet" size={16} />Refund {fmtINR(refundAmt, { full: true })}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Refund reason</label>
            <ReasonList options={REFUND_REASONS} value={refReason} onChange={setRefReason} />
          </div>
          <div className="field">
            <label>Refund amount</label>
            <div className="row gap8" style={{ marginBottom: 12 }}>
              {[25, 50, 75, 100].map((p) => (
                <button key={p} className={'chip' + (refPct === p ? ' on' : '')} onClick={() => setRefPct(p)} style={{ flex: 1, justifyContent: 'center' }}>
                  {p}%
                </button>
              ))}
            </div>
            <input type="range" className="refund-range" min={0} max={100} step={5} value={refPct} onChange={(e) => setRefPct(+e.target.value)} />
            <div className="row between" style={{ marginTop: 12, padding: '12px 14px', background: 'var(--danger-soft)', borderRadius: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{refPct}% of {fmtINR(b.amount, { full: true })}</span>
              <span className="num" style={{ fontSize: 19, color: 'var(--danger)' }}>{fmtINR(refundAmt, { full: true })}</span>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Internal note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context for the audit log…" style={{ minHeight: 60 }} />
          </div>
        </Modal>
      )}
    </div>
  );
}
