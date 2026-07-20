'use client';

// /promos — growth levers (Section 8.13).
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { PROMO_LIST, CREATE_PROMO, UPDATE_PROMO, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import { Icon, Badge, StatCard, SecHead, It, Toolbar, Modal, Seg, Bar, fmtINR } from '@/components/ui';

const SCOPES = ['All venues', 'New users', 'Weekdays only', 'Football', 'Cricket', 'Min ₹3000'];

export default function PromosPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { data, refetch } = useQuery(PROMO_LIST, { variables: { q } });
  const d = data?.getAdminPromoList;
  const stats = d?.stats || {};
  const rows = d?.promos || [];

  const inr = (n) => {
    const s = fmtINR(n);
    const m = s.match(/^(.+?)\s(Cr|L)$/);
    return m ? { value: m[1], unit: m[2] } : { value: s, unit: undefined };
  };
  const spend = inr(stats.discountSpend);
  const gmv = inr(stats.assistedGmv);

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow={`PROMO CODES · ${stats.active ?? '—'} ACTIVE`}
        title={
          <>
            Levers for <It>growth</It>.
          </>
        }
      >
        <button className="btn btn-dark" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} />
          Create code
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Active codes" value={stats.active ?? '—'} meta={`${stats.scheduled ?? 0} scheduled`} />
        <StatCard label="Redemptions · 30D" value={(stats.redemptions30 ?? 0).toLocaleString('en-IN')} delta={stats.redemptionsDelta} meta="Across all codes" />
        <StatCard label="Discount spend" value={spend.value} unit={spend.unit} meta="Marketing budget" color="var(--warn)" />
        <StatCard label="Assisted GMV" value={gmv.value} unit={gmv.unit} delta={stats.assistedDelta} meta={`${stats.roi ?? 0}× ROI on spend`} color="var(--brand)" />
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Search codes, scope…" />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              {['Code', 'Discount', 'Scope', 'Redemptions', 'Expires', 'Status', ''].map((h, i) => (
                <th key={i} className={h === 'Redemptions' ? 'num-col' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.promoId}>
                <td>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                    {p.code}
                  </span>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {p.label}
                  </div>
                </td>
                <td>
                  <span className="badge brand-chip">{p.kind === 'pct' ? `${p.value}% off` : `₹${p.value} off`}</span>
                </td>
                <td className="muted">{p.scope}</td>
                <td className="num-col">
                  <div className="strong">
                    {p.used.toLocaleString('en-IN')} / {p.cap.toLocaleString('en-IN')}
                  </div>
                  <div style={{ marginTop: 5, marginLeft: 'auto', width: 90 }}>
                    <Bar pct={(p.used / Math.max(1, p.cap)) * 100} />
                  </div>
                </td>
                <td className="muted">{p.expires}</td>
                <td>
                  <Badge status={p.status} />
                </td>
                <td className="num-col">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(p)}>
                    <Icon name="pen" size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  No promo codes match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <PromoModal
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false);
            refetch();
          }}
        />
      )}
      {editing && (
        <PromoModal
          promo={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function PromoModal({ promo, onClose, onDone }) {
  const toast = useToast();
  const isEdit = !!promo;
  const [form, setForm] = useState(
    promo
      ? { code: promo.code, kind: promo.kind, value: promo.value, scope: promo.scope, cap: promo.cap, expires: promo.expires, label: promo.label || '' }
      : { code: '', kind: 'pct', value: 20, scope: 'All venues', cap: 1000, expires: nextYearEnd(), label: '' }
  );
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [createPromo, { loading: creating }] = useMutation(CREATE_PROMO, REFRESH_NAV);
  const [updatePromo, { loading: updating }] = useMutation(UPDATE_PROMO, REFRESH_NAV);

  const doUpdate = async (patch, msg) => {
    const { data } = await updatePromo({ variables: { promoId: promo.promoId, patch } });
    toast(msg || data?.adminUpdatePromo?.message || 'Promo updated');
    onDone();
  };

  return (
    <Modal
      title={isEdit ? `Edit ${promo.code}` : 'Create promo code'}
      sub={isEdit ? `${promo.used.toLocaleString('en-IN')} redemptions so far` : 'New discount campaign'}
      onClose={onClose}
      width={540}
      foot={
        <>
          {isEdit && (
            <>
              {promo.status === 'paused' ? (
                <button className="btn" onClick={() => doUpdate({ status: 'active' })}>
                  <Icon name="play" size={15} />
                  Resume
                </button>
              ) : (
                <button className="btn" onClick={() => doUpdate({ status: 'paused' })}>
                  <Icon name="pause" size={15} />
                  Pause
                </button>
              )}
              <button
                className="btn"
                onClick={async () => {
                  const dup = `${form.code}2`.slice(0, 12);
                  const { data } = await createPromo({
                    variables: {
                      input: { code: dup, kind: form.kind, value: +form.value, scope: form.scope, cap: +form.cap, expires: form.expires, label: form.label || undefined },
                    },
                  });
                  toast(data?.adminCreatePromo?.message || `Duplicated as ${dup}`);
                  onDone();
                }}
              >
                <Icon name="copy" size={15} />
                Duplicate
              </button>
              <span className="fill" />
            </>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={creating || updating || !form.code}
            onClick={async () => {
              if (isEdit) {
                await doUpdate({ kind: form.kind, value: +form.value, scope: form.scope, cap: +form.cap, expires: form.expires, label: form.label });
              } else {
                const { data } = await createPromo({
                  variables: {
                    input: {
                      code: form.code,
                      kind: form.kind,
                      value: +form.value,
                      scope: form.scope,
                      cap: +form.cap,
                      expires: form.expires,
                      label: form.label || undefined,
                    },
                  },
                });
                const res = data?.adminCreatePromo;
                toast(res?.message || `Promo ${form.code} created · live now`);
                if (res?.success) onDone();
              }
            }}
          >
            <Icon name="check" size={16} />
            {isEdit ? 'Save changes' : 'Create & activate'}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Code</label>
        <input
          value={form.code}
          disabled={isEdit}
          onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="e.g. SUMMER25"
          style={{ fontFamily: 'var(--mono)', letterSpacing: '.05em' }}
        />
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label>Discount type</label>
          <Seg
            light
            options={[
              { value: 'pct', label: '% off' },
              { value: 'flat', label: '₹ flat' },
            ]}
            value={form.kind}
            onChange={(v) => set('kind', v)}
            style={{ width: '100%' }}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{form.kind === 'pct' ? 'Percentage' : 'Amount (₹)'}</label>
          <input type="number" value={form.value} onChange={(e) => set('value', +e.target.value)} />
        </div>
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label>Applies to</label>
          <select value={form.scope} onChange={(e) => set('scope', e.target.value)}>
            {SCOPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Usage cap</label>
          <input type="number" value={form.cap} onChange={(e) => set('cap', +e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Expires on</label>
        <input type="date" value={form.expires} onChange={(e) => set('expires', e.target.value)} />
      </div>
      <div
        className="row gap10"
        style={{
          marginTop: 16,
          padding: '12px 14px',
          background: 'var(--brand-tint)',
          borderRadius: 10,
          border: '1px solid color-mix(in oklab, var(--brand) 20%, transparent)',
        }}
      >
        <span className="mono" style={{ fontWeight: 600, fontSize: 14, color: 'var(--brand-deep)' }}>
          {form.code || 'YOURCODE'}
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          {form.kind === 'pct' ? `${form.value}% off` : `₹${form.value} off`} · {form.scope} · cap {Number(form.cap).toLocaleString('en-IN')}
        </span>
      </div>
    </Modal>
  );
}

function nextYearEnd() {
  return `${new Date().getFullYear()}-12-31`;
}
