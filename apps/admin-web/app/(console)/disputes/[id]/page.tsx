'use client';

// /disputes/[id] — escrow resolution detail (Section 8.15).
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { DISPUTE_DETAIL, MARK_INVESTIGATING, ADD_DISPUTE_MESSAGE, RESOLVE_DISPUTE, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon, Avatar, Badge, Urgency, Panel, KV, Modal, StepTimeline, ReasonList, HeadBar, Back, avColor, fmtINR,
} from '@/components/ui';

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [resolution, setResolution] = useState(0);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const { data, refetch } = useQuery(DISPUTE_DETAIL, { variables: { disputeId: id } });
  const opts = { ...REFRESH_NAV, onCompleted: () => refetch() };
  const [investigate] = useMutation(MARK_INVESTIGATING, opts);
  const [addMessage] = useMutation(ADD_DISPUTE_MESSAGE, opts);
  const [resolve] = useMutation(RESOLVE_DISPUTE, opts);

  const d = data?.getAdminDisputeDetailV2;
  if (!d) return <div className="page"><div className="muted" style={{ padding: 40 }}>Loading dispute…</div></div>;
  const x = d.dispute;
  const cd = d.caseDetails || {};
  const amount = d.escrowAmount || x.amount;

  const RESOLUTIONS = [
    { key: 'FULL_REFUND', title: 'Full refund to customer', sub: `${fmtINR(amount, { full: true })} → customer` },
    { key: 'PARTIAL_50', title: 'Partial refund (50%)', sub: `${fmtINR(Math.round(amount / 2), { full: true })} → customer` },
    { key: 'WALLET_CREDIT', title: 'Credit to wallet', sub: `${fmtINR(amount, { full: true })} spotlyte credit` },
    { key: 'REJECT_CLAIM', title: 'Reject claim', sub: 'No refund · favour owner' },
  ];

  return (
    <div className="page">
      <Back label="All disputes" onClick={() => router.push('/disputes')} />
      <HeadBar
        avatar={
          <div style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="shield" size={22} />
          </div>
        }
        title={`#${x.disputeId}`}
        badges={<><Badge status={x.status} /><Urgency level={x.urgency} /></>}
        sub={
          <>
            <a className="lk" onClick={() => cd.customer?.userId && router.push(`/users/${cd.customer.userId}`)}>{x.customerName}</a>
            {' '}vs <a className="lk" onClick={() => x.venueId && router.push(`/venues/${x.venueId}`)}>{x.venueName}</a>
            {' '}· booking{' '}
            <a className="lk mono" style={{ fontSize: 12 }} onClick={() => x.bookingId && router.push(`/bookings/${x.bookingId}`)}>#{x.bookingId}</a>
          </>
        }
        actions={
          x.status !== 'resolved' && (
            <>
              <button
                className="btn"
                onClick={async () => {
                  const r = await investigate({ variables: { disputeId: x.disputeId } });
                  toast(r.data?.adminMarkDisputeInvestigating?.message || 'Marked investigating');
                }}
              >
                <Icon name="eye" size={16} />Investigate
              </button>
              <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="check" size={16} />Resolve</button>
            </>
          )
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <div className="col gap16">
          <Panel eyebrow="TIMELINE" title="Where it stands.">
            <StepTimeline steps={d.timeline} />
          </Panel>

          <Panel eyebrow="CONVERSATION" title="Both sides.">
            <div className="col gap16">
              {d.thread.map((t: any, i: number) => (
                <div key={i} className="row gap12" style={{ alignItems: 'flex-start' }}>
                  <Avatar
                    name={t.senderName}
                    color={t.senderRole === 'admin' ? 'var(--ink)' : t.senderRole === 'owner' ? 'var(--warn)' : avColor(t.senderName)}
                  />
                  <div className="fill" style={{ background: t.senderRole === 'admin' ? 'var(--brand-tint)' : 'var(--wash)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px' }}>
                    <div className="row between">
                      <b style={{ fontSize: 13 }}>{t.senderName}</b>
                      <span className="muted mono" style={{ fontSize: 11 }}>{t.timeLabel}</span>
                    </div>
                    <p style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                      {t.senderRole === 'admin' ? t.message : `“${t.message}”`}
                    </p>
                  </div>
                </div>
              ))}
              {x.status !== 'resolved' && (
                <div className="row gap10" style={{ marginTop: 4 }}>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Reply as spotlyte Support…"
                    style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', padding: '10px 16px', fontFamily: 'var(--sans)', fontSize: 13.5, background: 'var(--paper)', color: 'var(--ink)', outline: 'none' }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && message.trim()) {
                        const r = await addMessage({ variables: { disputeId: x.disputeId, message: message.trim() } });
                        setMessage('');
                        toast(r.data?.adminAddDisputeMessage?.message || 'Message sent');
                      }
                    }}
                  />
                  <button
                    className="btn btn-dark"
                    disabled={!message.trim()}
                    onClick={async () => {
                      const r = await addMessage({ variables: { disputeId: x.disputeId, message: message.trim() } });
                      setMessage('');
                      toast(r.data?.adminAddDisputeMessage?.message || 'Message sent');
                    }}
                  >
                    <Icon name="arrowRight" size={16} />Send
                  </button>
                </div>
              )}
            </div>
          </Panel>

          {x.status === 'resolved' && d.resolution && (
            <div className="card card-pad" style={{ background: 'var(--brand-tint)', borderColor: 'color-mix(in oklab, var(--brand) 22%, transparent)' }}>
              <div className="row gap10">
                <Icon name="check" size={20} style={{ color: 'var(--brand)' }} />
                <div>
                  <b>Resolved</b>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{d.resolution.label}{d.resolution.note ? ` · ${d.resolution.note}` : ''}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col gap16">
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 8 }}>AMOUNT IN ESCROW</div>
            {d.escrowHeld ? (
              <>
                <div className="num" style={{ fontSize: 30, color: 'var(--warn)' }}>{fmtINR(amount, { full: true })}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Held until resolution</div>
              </>
            ) : (
              <>
                <div className="num" style={{ fontSize: 30, color: 'var(--muted-2)' }}>₹0</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Escrow released · {d.resolution?.label || 'resolved'}</div>
              </>
            )}
          </div>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>CASE DETAILS</div>
            <KV items={[
              ['Customer', <a key="c" className="lk" onClick={() => cd.customer?.userId && router.push(`/users/${cd.customer.userId}`)}>{cd.customer?.name}</a>],
              ['Owner', <a key="o" className="lk" onClick={() => cd.owner?.ownerId && router.push(`/owners/${cd.owner.ownerId}`)}>{cd.owner?.name}</a>],
              ['Venue', <a key="v" className="lk" onClick={() => cd.venue?.venueId && router.push(`/venues/${cd.venue.venueId}`)}>{cd.venue?.name}</a>],
              ['Slot', cd.slot],
              ['Reason', cd.reason],
              ['Opened', cd.opened],
            ]} />
          </div>
        </div>
      </div>

      {modal && (
        <Modal
          title="Resolve dispute"
          sub={`#${x.disputeId} · ${fmtINR(amount, { full: true })} in escrow`}
          onClose={() => setModal(false)}
          foot={
            <>
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const r = await resolve({ variables: { disputeId: x.disputeId, resolution: RESOLUTIONS[resolution].key, note } });
                  setModal(false);
                  toast(r.data?.adminResolveDisputeV2?.message || `Dispute resolved · ${RESOLUTIONS[resolution].title}`);
                }}
              >
                Confirm resolution
              </button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
            Choose an outcome. Funds release from escrow immediately and both parties are notified.
          </p>
          <ReasonList
            options={RESOLUTIONS.map((r) => ({ title: r.title, sub: r.sub }))}
            value={resolution}
            onChange={setResolution}
          />
          <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
            <label>Resolution note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rationale for the audit log…" style={{ minHeight: 60 }} />
          </div>
        </Modal>
      )}
    </div>
  );
}
