'use client';

// /invoices — GST tax & billing (Section 8.12).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { INVOICE_LIST, CREATE_INVOICE, OWNER_LIST, USER_LIST, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon, Avatar, Badge, StatCard, SecHead, It, Seg, useSort, Th, Modal, fmtINR,
} from '@/components/ui';

export default function InvoicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [aud, setAud] = useState('owner');
  const [tab, setTab] = useState('all');
  const [create, setCreate] = useState(false);
  const { data, refetch } = useQuery(INVOICE_LIST, { variables: { audience: aud, tab } });
  const d = data?.getAdminInvoiceList;
  const counts = d?.counts || {};
  const stats = d?.stats || {};
  const rows = (d?.invoices || []).map((i: any) => ({ ...i, id: i.invoiceId }));
  const [sorted, sort, toggle] = useSort(rows);

  const inr = (n?: number) => {
    const s = fmtINR(n);
    const m = s.match(/^(.+?)\s(Cr|L)$/);
    return m ? { value: m[1], unit: m[2] } : { value: s, unit: undefined };
  };
  const billed = inr(stats.billed);
  const collected = inr(stats.collected);
  const gstc = inr(stats.gstCollected);

  return (
    <div className="page page-wide">
      <SecHead eyebrow="INVOICES · TAX & BILLING" title={<>Every <It>rupee</It>, documented.</>}>
        <button className="btn" onClick={() => toast(`Downloading ${sorted.length} invoices as ZIP…`)}>
          <Icon name="download" size={16} />Download all
        </button>
        <button className="btn btn-dark" onClick={() => setCreate(true)}><Icon name="plus" size={16} />New invoice</button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
        {aud === 'owner' ? (
          <>
            <StatCard label="Billed to owners" value={billed.value} unit={billed.unit} meta="Subscription + commission" />
            <StatCard label="Outstanding" value={fmtINR(stats.outstanding)} meta={`${stats.due ?? 0} due · ${stats.overdue ?? 0} overdue`} color="var(--warn)" />
            <StatCard label="Collected" value={collected.value} unit={collected.unit} delta={7} meta={`${stats.collectionRate ?? 0}% collection rate`} color="var(--brand)" />
            <StatCard label="Overdue" value={stats.overdue ?? 0} meta="Auto-reminder sent" color="var(--danger)" />
          </>
        ) : (
          <>
            <StatCard label="User tax invoices" value={stats.count ?? '—'} meta="Booking receipts · 30D" />
            <StatCard label="GST collected" value={gstc.value} unit={gstc.unit} meta="18% on platform fee" color="var(--brand)" />
            <StatCard label="Avg invoice" value={fmtINR(stats.avgInvoice, { full: true })} meta="incl. GST" />
            <StatCard label="Auto-issued" value={stats.autoIssued ?? 100} unit="%" meta="On payment capture" color="var(--info)" />
          </>
        )}
      </div>

      <div className="row between wrap gap12" style={{ marginBottom: 18 }}>
        <Seg
          light
          options={[{ value: 'owner', label: 'To owners' }, { value: 'user', label: 'To users' }]}
          value={aud}
          onChange={(v) => { setAud(v); setTab('all'); }}
        />
        <div className="chips">
          {(['all', 'due', 'overdue', 'paid'] as string[]).map((t) => (
            <button key={t} className={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
              {t === 'all' ? `All · ${counts.all ?? 0}` : `${t[0].toUpperCase() + t.slice(1)} · ${counts[t] ?? 0}`}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th k="id" sort={sort} toggle={toggle}>Invoice</Th>
              <Th k="party" sort={sort} toggle={toggle}>{aud === 'owner' ? 'Owner' : 'User'}</Th>
              <Th k="type" sort={sort} toggle={toggle}>Type</Th>
              <Th k="period" sort={sort} toggle={toggle}>Period</Th>
              <Th k="issued" sort={sort} toggle={toggle}>Issued</Th>
              <Th k="total" sort={sort} toggle={toggle} num>Total (incl. GST)</Th>
              <Th k="status" sort={sort} toggle={toggle}>Status</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.length ? sorted.map((i: any) => (
              <tr key={i.invoiceId}>
                <td><span className="ref">{i.invoiceId}</span></td>
                <td><div className="who"><Avatar color={i.color} init={i.initials} /><div><div className="nm">{i.party}</div><div className="sub">{i.sub}</div></div></div></td>
                <td><span className="badge gray" style={{ fontSize: 11 }}>{i.type}</span></td>
                <td className="muted">{i.period}</td>
                <td className="muted">{i.issued}</td>
                <td className="num-col strong">{fmtINR(i.total, { full: true })}</td>
                <td><Badge status={i.status} /></td>
                <td className="num-col">
                  <button className="btn btn-sm btn-ghost" onClick={() => router.push(`/invoices/${i.invoiceId}`)}>
                    <Icon name="doc" size={14} />View
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="muted" style={{ padding: 24, textAlign: 'center' }}>No invoices for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {create && <NewInvoiceModal onClose={() => setCreate(false)} onDone={() => { setCreate(false); refetch(); }} />}
    </div>
  );
}

function NewInvoiceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [aud, setAud] = useState('owner');
  const [partyId, setPartyId] = useState('');
  const [type, setType] = useState('Subscription');
  const [period, setPeriod] = useState('');
  const [amount, setAmount] = useState(2499);
  const { data: ownersData } = useQuery(OWNER_LIST, { variables: { tab: 'verified' } });
  const { data: usersData } = useQuery(USER_LIST, { variables: { tab: 'all' } });
  const [createInvoice, { loading }] = useMutation(CREATE_INVOICE, REFRESH_NAV);
  const owners = ownersData?.getAdminOwnerList?.owners || [];
  const users = usersData?.getAdminUserList?.users || [];
  const gstAmt = Math.round(amount * 0.18);

  return (
    <Modal
      title="New invoice"
      sub="Manual tax invoice — GST 18% computed automatically"
      onClose={onClose}
      width={520}
      foot={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={loading || !partyId || !amount}
            onClick={async () => {
              const { data } = await createInvoice({ variables: { input: { audience: aud, partyId, type, period: period || undefined, amount } } });
              const res = data?.adminCreateInvoice;
              if (res?.success) { toast(res.message); onDone(); }
              else toast(res?.message || 'Could not create invoice');
            }}
          >
            <Icon name="check" size={16} />Create invoice
          </button>
        </>
      }
    >
      <div className="field">
        <label>Audience</label>
        <Seg
          light
          options={[{ value: 'owner', label: 'To owner' }, { value: 'user', label: 'To user' }]}
          value={aud}
          onChange={(v) => { setAud(v); setPartyId(''); setType(v === 'owner' ? 'Subscription' : 'Booking receipt'); }}
          style={{ width: '100%' }}
        />
      </div>
      <div className="field">
        <label>{aud === 'owner' ? 'Owner' : 'User'}</label>
        <select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
          <option value="">Select…</option>
          {(aud === 'owner' ? owners : users).map((p: any) =>
            aud === 'owner'
              ? <option key={p.ownerId} value={p.ownerId}>{p.biz} — {p.name}</option>
              : <option key={p.userId} value={p.userId}>{p.name} — {p.city}</option>
          )}
        </select>
      </div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1 }}>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {(aud === 'owner' ? ['Subscription', 'Commission'] : ['Booking receipt']).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Period</label>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. May 2026" />
        </div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Amount (₹, pre-GST)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} />
      </div>
      <div className="row between" style={{ marginTop: 16, padding: '12px 14px', background: 'var(--brand-tint)', borderRadius: 10, border: '1px solid color-mix(in oklab, var(--brand) 20%, transparent)' }}>
        <span style={{ fontSize: 13 }}>₹{amount.toLocaleString('en-IN')} + GST ₹{gstAmt.toLocaleString('en-IN')}</span>
        <span className="num" style={{ fontSize: 18, color: 'var(--brand-deep)' }}>₹{(amount + gstAmt).toLocaleString('en-IN')}</span>
      </div>
    </Modal>
  );
}
