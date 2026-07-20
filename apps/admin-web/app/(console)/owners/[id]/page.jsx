'use client';

// /owners/[id] — owner detail + full KYC flow (Section 8.3).
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { OWNER_DETAIL, APPROVE_KYC, REJECT_KYC, REQUEST_DOCS, SUSPEND_OWNER, REINSTATE_OWNER, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon,
  Avatar,
  Badge,
  Panel,
  KV,
  Modal,
  Mono,
  Sparkline,
  Pipeline,
  ActivityLog,
  RequestDocsModal,
  ReasonList,
  Stat,
  HeadBar,
  Back,
  VenueThumb,
  fmtINR,
} from '@/components/ui';

const OWNER_DOC_TYPES = [
  'PAN Card',
  'GST Certificate',
  'Business Registration / LLP',
  'Bank account proof (cancelled cheque)',
  'Identity proof (Aadhaar)',
  'Venue ownership / lease deed',
  'Authorised signatory letter',
  'Cancelled cheque',
];
const REJECT_REASONS = ['Document mismatch / illegible', 'Business not verifiable', 'Suspected fraudulent details', 'Duplicate account', 'Other (specify)'];
const TIERS = ['Standard — 18%', 'Growth — 16%', 'Strategic — 14%'];
const CXL_TONE = { Flexible: 'green', Moderate: 'amber', Strict: 'red' };

export default function OwnerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [reason, setReason] = useState(0);
  const [note, setNote] = useState('');
  const [tier, setTier] = useState(TIERS[0]);

  const { data, refetch } = useQuery(OWNER_DETAIL, { variables: { ownerId: id } });
  const opts = { ...REFRESH_NAV, onCompleted: () => refetch() };
  const [approveKyc] = useMutation(APPROVE_KYC, opts);
  const [rejectKyc] = useMutation(REJECT_KYC, opts);
  const [requestDocs] = useMutation(REQUEST_DOCS, opts);
  const [suspend] = useMutation(SUSPEND_OWNER, opts);
  const [reinstate] = useMutation(REINSTATE_OWNER, opts);

  const d = data?.getAdminOwnerDetail;
  if (!d)
    return (
      <div className="page">
        <div className="muted" style={{ padding: 40 }}>
          Loading owner…
        </div>
      </div>
    );
  const o = d.owner;
  const pending = ['review', 'docs'].includes(o.kyc);
  const plan = d.plan || {};
  const cxl = d.cancellationPolicy || {};
  const life = d.lifetime || {};

  return (
    <div className="page">
      <Back label="All owners" onClick={() => router.push('/owners')} />
      <HeadBar
        avatar={<Avatar color={o.color} init={o.initials} size="lg" />}
        title={o.biz}
        badges={
          <>
            <Badge status={o.kyc} />
            <span className="badge gray" style={{ fontSize: 11 }}>
              {o.ownerId}
            </span>
          </>
        }
        sub={`${o.name} · ${o.city} · joined ${o.joined || '—'}`}
        actions={
          pending ? (
            <>
              <button className="btn btn-danger" onClick={() => setModal('reject')}>
                <Icon name="x" size={16} />
                Reject
              </button>
              {o.kyc === 'review' && (
                <button className="btn" onClick={() => setModal('docs')}>
                  <Icon name="mail" size={16} />
                  Request docs
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setModal('approve')}>
                <Icon name="check" size={16} />
                Approve KYC
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => toast(`Message sent to ${o.name}`)}>
                <Icon name="mail" size={16} />
                Message
              </button>
              {o.kyc === 'verified' ? (
                <button
                  className="btn"
                  style={{ color: 'var(--danger)' }}
                  onClick={async () => {
                    const r = await suspend({ variables: { ownerId: o.ownerId } });
                    toast(r.data?.adminSuspendOwner?.message || 'Owner suspended');
                  }}
                >
                  <Icon name="pause" size={16} />
                  Suspend
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const r = await reinstate({ variables: { ownerId: o.ownerId } });
                    toast(r.data?.adminReinstateOwner?.message || 'Owner reinstated');
                  }}
                >
                  <Icon name="refresh" size={16} />
                  Reinstate
                </button>
              )}
            </>
          )
        }
      />

      {pending && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <Pipeline current={d.pipelineStep} />
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        {/* left */}
        <div className="col gap16">
          <Panel eyebrow="KYC DOCUMENTS" title="Verify the paperwork.">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {d.documents.map((doc, i) => (
                <div
                  key={i}
                  className="doc"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setViewerDoc(doc);
                    setModal('viewer');
                  }}
                >
                  <div className="ico">
                    <Icon name="doc" size={18} />
                  </div>
                  <div className="fill">
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.name}</div>
                    <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {doc.ref || '—'}
                    </div>
                  </div>
                  {doc.status === 'verified' ? (
                    <span className="badge green" style={{ fontSize: 10.5 }}>
                      <Icon name="check" size={12} />
                      Verified
                    </span>
                  ) : doc.status === 'missing' ? (
                    <span className="badge red" style={{ fontSize: 10.5 }}>
                      Missing
                    </span>
                  ) : (
                    <span className="badge amber" style={{ fontSize: 10.5 }}>
                      Review
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          {d.venues.length > 0 && (
            <Panel eyebrow={`VENUES · ${d.venues.length}`} title="What they operate." pad={false}>
              <div style={{ padding: '6px 10px 10px' }}>
                {d.venues.map((v) => (
                  <div
                    key={v.venueId}
                    className="row gap12"
                    style={{ padding: '11px 14px', borderRadius: 11, cursor: 'pointer' }}
                    onClick={() => router.push(`/venues/${v.venueId}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wash)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <VenueThumb name={v.venueName} color={v.color} />
                    <div className="fill">
                      <div className="strong" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
                        {v.venueName}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {v.courtCount} courts · {v.city}
                      </div>
                    </div>
                    <Badge status={v.venueStatus} />
                    <span className="num" style={{ fontSize: 15, width: 70, textAlign: 'right' }}>
                      {fmtINR(v.revenue30d)}
                    </span>
                    <Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* right */}
        <div className="col gap16">
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              CONTACT
            </div>
            <KV
              items={[
                ['Contact', d.contact?.contact],
                ['Email', <Mono key="e">{d.contact?.email}</Mono>],
                ['Phone', d.contact?.phone],
                ['City', d.contact?.city],
              ]}
            />
          </div>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              LEGAL ENTITY
            </div>
            <KV
              items={[
                ['Legal name', d.legal?.legalName],
                ['PAN', <Mono key="p">{d.legal?.pan || '—'}</Mono>],
                ['GSTIN', <Mono key="g">{d.legal?.gstin || '—'}</Mono>],
                ['Reg. type', d.legal?.regType],
              ]}
            />
          </div>
          <div className="card card-pad">
            <div className="row between" style={{ marginBottom: 14 }}>
              <div className="eyebrow">BANK DETAILS</div>
              {d.bank?.verified && (
                <span className="badge green" style={{ fontSize: 10.5 }}>
                  <Icon name="check" size={12} />
                  Verified
                </span>
              )}
            </div>
            <KV
              items={[
                ['Account holder', d.bank?.accountHolder],
                ['Bank', d.bank?.bankName],
                ['Account no.', <Mono key="a">{d.bank?.accountNoMasked || '—'}</Mono>],
                ['IFSC', <Mono key="i">{d.bank?.ifsc || '—'}</Mono>],
                ['Branch', d.bank?.branch],
              ]}
            />
          </div>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              SUBSCRIPTION PLAN
            </div>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="row gap8" style={{ alignItems: 'center' }}>
                  <span className="num" style={{ fontSize: 19 }}>
                    {plan.name}
                  </span>
                  <span className="badge green" style={{ fontSize: 10.5 }}>
                    Active
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {plan.commissionLine}
                </div>
              </div>
              <div className="right">
                <div className="num" style={{ fontSize: 17 }}>
                  {plan.priceMo ? `₹${Number(plan.priceMo).toLocaleString('en-IN')}` : 'Free'}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  per mo
                </div>
              </div>
            </div>
            <hr className="hr" style={{ margin: '14px 0' }} />
            <KV
              items={[
                ['Member since', plan.memberSince],
                ['Renews', plan.renews],
                ['Billing', plan.billing],
              ]}
            />
          </div>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              CANCELLATION POLICY
            </div>
            <div className="row gap10" style={{ alignItems: 'flex-start' }}>
              <span className={'badge ' + (CXL_TONE[cxl.tier] || 'gray')} style={{ fontSize: 11, flexShrink: 0 }}>
                <span className="dot" />
                {cxl.tier}
              </span>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{cxl.text}</div>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="GMV · LIFETIME" value={fmtINR(life.gmv)} />
            <Stat label="PENDING PAYOUT" value={fmtINR(life.pendingPayout)} />
            <Stat label="RATING" value={life.rating || '—'} sub={life.ratingSub} />
            <Stat label="DISPUTES" value={life.disputes} sub={life.disputesSub} />
          </div>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              GMV TREND · 14 DAYS
            </div>
            <Sparkline data={o.spark} h={60} color="var(--brand)" />
          </div>
        </div>
      </div>

      <Panel eyebrow={`INTERNAL ACTIVITY · ${o.ownerId}`} title="Everything we did here." style={{ marginTop: 'var(--gap)' }}>
        <ActivityLog items={d.activity} />
      </Panel>

      {/* ── modals ── */}
      {modal === 'docs' && (
        <RequestDocsModal
          title="Request documents"
          sub={`${o.biz} · ${o.ownerId}`}
          options={OWNER_DOC_TYPES}
          onClose={() => setModal(null)}
          onSend={async (picked, n) => {
            const r = await requestDocs({ variables: { ownerId: o.ownerId, docs: picked, note: n } });
            setModal(null);
            toast(r.data?.adminRequestOwnerDocs?.message || `Requested ${picked.length} documents · owner notified`);
          }}
        />
      )}

      {modal === 'reject' && (
        <Modal
          title="Reject KYC application"
          sub={`${o.biz} · ${o.ownerId}`}
          onClose={() => setModal(null)}
          foot={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  const r = await rejectKyc({ variables: { ownerId: o.ownerId, reason: REJECT_REASONS[reason], note } });
                  setModal(null);
                  toast(r.data?.adminRejectOwnerKyc?.message || 'KYC rejected · owner notified');
                }}
              >
                Reject & notify
              </button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
            Select a reason. The owner is emailed and can re-submit corrected documents.
          </p>
          <ReasonList options={REJECT_REASONS} value={reason} onChange={setReason} />
          <div className="field" style={{ marginTop: 8 }}>
            <label>Note to owner (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add specifics so they can fix and resubmit…" />
          </div>
        </Modal>
      )}

      {modal === 'approve' && (
        <Modal
          title="Approve KYC"
          sub={`${o.biz} · ${o.ownerId}`}
          onClose={() => setModal(null)}
          width={460}
          foot={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const r = await approveKyc({ variables: { ownerId: o.ownerId, tier } });
                  setModal(null);
                  toast(r.data?.adminApproveOwnerKyc?.message || `KYC approved · ${o.biz} is live`);
                }}
              >
                <Icon name="check" size={16} />
                Confirm approval
              </button>
            </>
          }
        >
          <div className="col gap10">
            <div
              className="row gap10"
              style={{ padding: 14, background: 'var(--brand-tint)', borderRadius: 12, border: '1px solid color-mix(in oklab, var(--brand) 20%, transparent)' }}
            >
              <Icon name="shield" size={20} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <div style={{ fontSize: 13.5 }}>
                All 6 documents verified. Approving grants <b>{o.biz}</b> the ability to list venues and accept bookings.
              </div>
            </div>
            <div className="field">
              <label>Commission tier</label>
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                {TIERS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'viewer' && viewerDoc && (
        <Modal
          title={viewerDoc.name}
          sub={`${o.biz} · ${viewerDoc.ref || 'no reference'}`}
          onClose={() => {
            setModal(null);
            setViewerDoc(null);
          }}
          width={520}
          foot={
            <button
              className="btn"
              onClick={() => {
                setModal(null);
                setViewerDoc(null);
              }}
            >
              Close
            </button>
          }
        >
          {viewerDoc.fileUrl ? (
            <img src={viewerDoc.fileUrl} alt={viewerDoc.name} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
          ) : (
            <div style={{ height: 260, borderRadius: 12, border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', background: 'var(--wash)' }}>
              <div style={{ textAlign: 'center' }}>
                <Icon name="doc" size={28} style={{ color: 'var(--muted-2)' }} />
                <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                  {viewerDoc.status === 'missing' ? 'Not uploaded yet — requested from owner.' : 'Preview unavailable in demo · reference on file'}
                </div>
                <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
                  {viewerDoc.ref}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
