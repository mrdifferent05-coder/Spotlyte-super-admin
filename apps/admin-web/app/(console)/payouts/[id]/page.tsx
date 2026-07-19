'use client';

// /payouts/[id] — settlement detail with UTR release flow (Section 8.11).
// Money math: fee = round(gross × tier%) · tds = round((gross − fee) × 1%) · net = gross − fee − tds.
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { PAYOUT_DETAIL, APPROVE_PAYOUT, HOLD_PAYOUT, RELEASE_PAYOUT, RETRY_PAYOUT, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon, Avatar, Badge, Panel, Modal, Mono, StepTimeline, Stat, HeadBar, Back, fmtINR,
} from '@/components/ui';

export default function PayoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [relModal, setRelModal] = useState(false);
  const [utrInput, setUtrInput] = useState('');

  const { data, refetch } = useQuery(PAYOUT_DETAIL, { variables: { payoutId: id } });
  const opts = { ...REFRESH_NAV, onCompleted: () => refetch() };
  const [approve] = useMutation(APPROVE_PAYOUT, opts);
  const [hold] = useMutation(HOLD_PAYOUT, opts);
  const [release] = useMutation(RELEASE_PAYOUT, opts);
  const [retry] = useMutation(RETRY_PAYOUT, opts);

  const d = data?.getAdminPayoutDetail;
  const breakdown = useMemo(() => {
    if (!d) return [];
    // Bucket member transactions into slot categories for the ledger.
    const cats: Record<string, { name: string; price: string; color: string; qty: number; gross: number; fee: number }> = {};
    const add = (key: string, name: string, price: string, color: string, b: any) => {
      cats[key] = cats[key] || { name, price, color, qty: 0, gross: 0, fee: 0 };
      cats[key].qty += 1;
      cats[key].gross += b.amount;
      cats[key].fee += b.fee;
    };
    for (const b of d.transactions) {
      const h = parseInt((b.timeRange || '12').slice(0, 2), 10);
      if (h < 8) add('early', 'Early morning', '₹750/hr', '#9C9A92', b);
      else if (h >= 18) add('peak', 'Weekday peak (6–9 PM)', '₹1,400/hr', '#C77B26', b);
      else if (b.amount >= 1800) add('weekend', 'Weekend peak', '₹1,800/hr', '#E11D48', b);
      else add('off', 'Weekday off-peak', '₹900/hr', '#0075FF', b);
    }
    return Object.values(cats);
  }, [d]);

  if (!d) return <div className="page page-wide"><div className="muted" style={{ padding: 40 }}>Loading payout…</div></div>;
  const p = d.payout;

  return (
    <div className="page page-wide">
      <Back label="All payouts" onClick={() => router.push('/payouts')} />
      <HeadBar
        avatar={<Avatar color={p.color} init={p.initials} size="lg" />}
        title={`#${p.payoutId}`}
        badges={<Badge status={p.status} />}
        sub={`${p.biz} · ${p.period} · ${p.txns} transactions`}
        actions={
          p.status === 'queued' ? (
            <>
              <button className="btn" onClick={async () => { const r = await hold({ variables: { payoutId: p.payoutId } }); toast(r.data?.adminHoldPayout?.message || 'Payout put on hold'); }}>
                <Icon name="pause" size={16} />Put on hold
              </button>
              <button className="btn btn-primary" onClick={async () => { const r = await approve({ variables: { payoutId: p.payoutId } }); toast(r.data?.adminApprovePayout?.message || 'Approved · now processing'); }}>
                <Icon name="check" size={16} />Approve
              </button>
            </>
          ) : p.status === 'processing' ? (
            <button className="btn btn-primary" onClick={() => { setUtrInput(''); setRelModal(true); }}>
              <Icon name="bolt" size={16} />Release · enter UTR
            </button>
          ) : p.status === 'failed' ? (
            <button className="btn btn-dark" onClick={async () => { const r = await retry({ variables: { payoutId: p.payoutId } }); toast(r.data?.adminRetryPayout?.message || 'Retrying transfer'); }}>
              <Icon name="refresh" size={16} />Retry transfer
            </button>
          ) : (
            <button className="btn" onClick={() => toast('Payout advice downloaded')}>
              <Icon name="download" size={16} />Download advice
            </button>
          )
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <Stat label="GROSS" value={fmtINR(p.gross)} sub={`${p.txns} transactions`} />
        <Stat label="PLATFORM FEE" value={`−${fmtINR(p.fee)}`} sub={`${Math.round((p.fee / p.gross) * 100) || 18}% commission`} color="var(--danger)" />
        <Stat label="TDS WITHHELD" value={`−${fmtINR(p.tds)}`} sub="1% statutory" color="var(--warn)" />
        <Stat label="NET PAYABLE" value={fmtINR(p.amount)} sub="To owner" color="var(--ok)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' }}>
        <div className="col gap16">
          <Panel eyebrow="SETTLEMENT BREAKDOWN" title="How it adds up." pad={false}>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {['Slot type', 'Rate', 'Slots', 'Gross', `Fee`].map((h, i) => (
                      <th key={i} className={['Slots', 'Gross', 'Fee'].includes(h) ? 'num-col' : ''} style={i === 0 ? { paddingLeft: 24 } : undefined}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((c: any, i: number) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: 24 }}>
                        <span className="row gap8">
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                          <span className="strong">{c.name}</span>
                        </span>
                      </td>
                      <td className="muted">{c.price}</td>
                      <td className="num-col">{c.qty}</td>
                      <td className="num-col strong">{fmtINR(c.gross, { full: true })}</td>
                      <td className="num-col" style={{ color: 'var(--danger)' }}>−{fmtINR(c.fee, { full: true })}</td>
                    </tr>
                  ))}
                  {!breakdown.length && (
                    <tr><td colSpan={5} className="muted" style={{ padding: 20, textAlign: 'center' }}>No linked transactions on this run.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '14px 24px 18px', borderTop: '1px solid var(--line)' }}>
              {([
                ['Gross sales', fmtINR(p.gross, { full: true }), ''],
                [`Platform fee`, `−${fmtINR(p.fee, { full: true })}`, 'var(--danger)'],
                ['Net after fee', fmtINR(p.gross - p.fee, { full: true }), ''],
                ['TDS withheld (1%)', `−${fmtINR(p.tds, { full: true })}`, 'var(--warn)'],
              ] as [string, string, string][]).map((r, i) => (
                <div key={i} className="row between" style={{ padding: '5px 0', fontSize: 13.5 }}>
                  <span className="muted">{r[0]}</span>
                  <span style={{ color: r[2] || 'var(--ink)', fontWeight: 500 }}>{r[1]}</span>
                </div>
              ))}
              <div className="row between" style={{ padding: '12px 0 0', marginTop: 6, borderTop: '1px solid var(--line)' }}>
                <span style={{ fontWeight: 600 }}>Net payable</span>
                <span className="num" style={{ fontSize: 20, color: 'var(--ok)' }}>{fmtINR(p.amount, { full: true })}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="col gap16">
          <div className="card card-pad" style={{ cursor: p.ownerId ? 'pointer' : 'default' }} onClick={() => p.ownerId && router.push(`/owners/${p.ownerId}`)}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>OWNER</div>
            <div className="row gap12">
              <Avatar color={p.color} init={p.initials} size="lg" />
              <div className="fill">
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{p.biz}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{p.owner} · T+3 days</div>
              </div>
              <Icon name="chevronRight" size={18} style={{ color: 'var(--muted-2)' }} />
            </div>
          </div>

          <Panel eyebrow="SETTLEMENT TIMELINE" title="Where it stands.">
            <StepTimeline steps={d.timeline} />
          </Panel>

          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>SETTLEMENT ACCOUNT</div>
            <div className="doc" style={{ background: 'var(--wash-2)' }}>
              <div className="ico" style={{ height: 40, background: 'var(--info-soft)', color: 'var(--info)', border: 0 }}>
                <Icon name="building" size={18} />
              </div>
              <div className="fill">
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.bank}</div>
                <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>{p.ifsc} · {p.biz}</div>
              </div>
              <span className="badge green" style={{ fontSize: 10.5 }}><Icon name="check" size={12} />Verified</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Settles {p.settles} · {p.bank}</div>
            {p.status === 'settled' && p.utr && (
              <div className="row between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <span className="muted" style={{ fontSize: 12.5 }}>UTR reference</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.utr}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--gap)' }}>
        <Panel eyebrow={`WHAT’S INSIDE · ${d.transactions.length} OF ${p.txns} TRANSACTIONS`} title="Bookings in this run." pad={false}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Booking', 'Customer', 'Venue', 'Date · Time', 'Method', 'Gross', 'Fee', 'Net'].map((h, i) => (
                    <th key={i} className={['Gross', 'Fee', 'Net'].includes(h) ? 'num-col' : ''} style={i === 0 ? { paddingLeft: 24 } : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.transactions.map((b: any) => (
                  <tr key={b.bookingId} className="clickable" onClick={() => router.push(`/bookings/${b.bookingId}`)}>
                    <td style={{ paddingLeft: 24 }}><span className="ref">#{b.bookingId}</span></td>
                    <td><div className="who"><Avatar color={b.color} init={b.initials} /><span className="nm">{b.customerName}</span></div></td>
                    <td className="muted">{b.venueName}</td>
                    <td>
                      <div className="strong">{b.date}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{b.timeRange}</div>
                    </td>
                    <td><span className="badge gray" style={{ fontSize: 11 }}>{b.method}</span></td>
                    <td className="num-col muted">{fmtINR(b.amount, { full: true })}</td>
                    <td className="num-col" style={{ color: 'var(--danger)' }}>−{fmtINR(b.fee, { full: true })}</td>
                    <td className="num-col strong">{fmtINR(b.net, { full: true })}</td>
                  </tr>
                ))}
                {!d.transactions.length && (
                  <tr><td colSpan={8} className="muted" style={{ padding: 20, textAlign: 'center' }}>No linked bookings on this payout.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 'var(--gap)' }}>
        <Panel eyebrow={`WEEKLY PAYOUT HISTORY · ${p.biz}`} title="Past settlements." pad={false}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Settlement', 'Period', 'UTR reference', 'Account', 'Amount', 'Status'].map((h, i) => (
                    <th key={i} className={h === 'Amount' ? 'num-col' : ''} style={i === 0 ? { paddingLeft: 24 } : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.history.map((h: any) => (
                  <tr key={h.payoutId} className="clickable" onClick={() => router.push(`/payouts/${h.payoutId}`)}>
                    <td className="strong" style={{ paddingLeft: 24 }}>#{h.payoutId}</td>
                    <td className="muted">{h.period}</td>
                    <td><span className="ref">{h.utr || '—'}</span></td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{h.bank}</td>
                    <td className="num-col strong">{fmtINR(h.amount, { full: true })}</td>
                    <td><Badge status={h.status} /></td>
                  </tr>
                ))}
                {!d.history.length && (
                  <tr><td colSpan={6} className="muted" style={{ padding: 20, textAlign: 'center' }}>No past settlements for this owner.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {relModal && (
        <Modal
          title="Release payout"
          sub={`#${p.payoutId} · ${fmtINR(p.amount)} to ${p.biz}`}
          onClose={() => setRelModal(false)}
          width={460}
          foot={
            <>
              <button className="btn" onClick={() => setRelModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!utrInput.trim()}
                onClick={async () => {
                  const r = await release({ variables: { payoutId: p.payoutId, utr: utrInput.trim() } });
                  setRelModal(false);
                  toast(r.data?.adminReleasePayout?.message || `Released ${fmtINR(p.amount)} · UTR ${utrInput.trim()}`);
                }}
              >
                <Icon name="check" size={16} />Confirm release
              </button>
            </>
          }
        >
          <div className="row gap10" style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--info-soft)', borderRadius: 10 }}>
            <Icon name="wallet" size={20} style={{ color: 'var(--info)', flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>
              Initiate the bank transfer of <b>{fmtINR(p.amount, { full: true })}</b> to <b>{p.bank}</b>, then enter the UTR / reference number to mark this payout settled.
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Bank UTR / reference number</label>
            <input
              value={utrInput}
              onChange={(e) => setUtrInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. AXISN12345678"
              style={{ fontFamily: 'var(--mono)', letterSpacing: '.04em' }}
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
