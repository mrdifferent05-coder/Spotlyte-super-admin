'use client';

// /owners — list with KYC tabs + invite modal (Section 8.2).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { OWNER_LIST, INVITE_OWNER, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import { downloadCSV } from '@/lib/csv';
import {
  Icon, Avatar, Badge, StatCard, SecHead, It, Tabs, Toolbar, useSort, Th, Modal, fmtINR,
} from '@/components/ui';

const CITIES = ['Bangalore', 'Chennai', 'Mumbai', 'Hyderabad', 'Pune', 'Delhi'];

export default function OwnersPage() {
  const router = useRouter();
  const [tab, setTab] = useState('review');
  const [q, setQ] = useState('');
  const [invite, setInvite] = useState(false);
  const { data, refetch } = useQuery(OWNER_LIST, { variables: { tab, q } });
  const d = data?.getAdminOwnerList;
  const counts = d?.counts || { all: 0, review: 0, docs: 0, verified: 0, suspended: 0 };
  const stats = d?.stats || {};
  const [sorted, sort, toggle] = useSort(d?.owners || []);

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow={`OWNERS · ${counts.all} OPERATORS`}
        title={<>Who runs the <It>floors</It>.</>}
      >
        <button
          className="btn"
          onClick={() => downloadCSV('spotlyte-owners', (d?.owners || []).map((o: any) => ({
            id: o.ownerId, business: o.biz, owner: o.name, city: o.city, kyc: o.kyc, venues: o.venues, gmv: o.revenue, rating: o.rating, disputes: o.disputes,
          })))}
        >
          <Icon name="download" size={16} />Export
        </button>
        <button className="btn btn-dark" onClick={() => setInvite(true)}><Icon name="plus" size={16} />Invite owner</button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Verified owners" value={stats.verified ?? '—'} meta={`Across ${stats.cities ?? '—'} cities`} />
        <StatCard label="Awaiting KYC" value={stats.awaiting ?? '—'} meta={`${stats.review ?? 0} in review · ${stats.docs ?? 0} need docs`} color="var(--warn)" />
        <StatCard label="Owner GMV · 30D" value={fmtINR(stats.gmv30d).replace(/ (Cr|L)$/, '')} unit={/ (Cr|L)$/.test(fmtINR(stats.gmv30d)) ? fmtINR(stats.gmv30d).match(/ (Cr|L)$/)![1] : undefined} delta={stats.gmvDelta} meta={`Top: ${stats.topBiz ?? '—'}`} />
        <StatCard label="Suspended / rejected" value={stats.suspended ?? '—'} meta="Access revoked" color="var(--danger)" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'review', label: 'In review', count: counts.review },
          { value: 'docs', label: 'Docs needed', count: counts.docs },
          { value: 'verified', label: 'Verified', count: counts.verified },
          { value: 'suspended', label: 'Suspended', count: counts.suspended },
        ]}
      />
      <Toolbar q={q} setQ={setQ} placeholder="Search owners, business, city…" />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th k="biz" sort={sort} toggle={toggle}>Owner / Business</Th>
              <Th k="city" sort={sort} toggle={toggle}>City</Th>
              <Th k="kyc" sort={sort} toggle={toggle}>KYC</Th>
              <Th k="venues" sort={sort} toggle={toggle} num>Venues</Th>
              <Th k="revenue" sort={sort} toggle={toggle} num>GMV</Th>
              <Th k="rating" sort={sort} toggle={toggle} num>Rating</Th>
              <Th k="disputes" sort={sort} toggle={toggle} num>Disputes</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((o: any) => (
              <tr key={o.ownerId} className="clickable" onClick={() => router.push(`/owners/${o.ownerId}`)}>
                <td>
                  <div className="who">
                    <Avatar color={o.color} init={o.initials} />
                    <div>
                      <div className="nm">{o.biz}</div>
                      <div className="sub">{o.name} · {o.ownerId}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{o.city}</td>
                <td><Badge status={o.kyc} /></td>
                <td className="num-col strong">{o.venues || '—'}</td>
                <td className="num-col strong">{fmtINR(o.revenue)}</td>
                <td className="num-col">
                  {o.rating ? (
                    <span className="row gap6" style={{ justifyContent: 'flex-end' }}>
                      <Icon name="star" size={13} style={{ color: 'var(--warn)', fill: 'var(--warn)' }} />
                      {o.rating}
                    </span>
                  ) : <span className="dash">—</span>}
                </td>
                <td className="num-col">
                  {o.disputes ? (
                    <span className={'badge ' + (o.disputes > 2 ? 'red' : 'amber')} style={{ fontSize: 11 }}>{o.disputes}</span>
                  ) : <span className="dash">0</span>}
                </td>
                <td className="num-col">
                  {['review', 'docs'].includes(o.kyc) ? (
                    <button className="btn btn-sm btn-dark" onClick={(e) => { e.stopPropagation(); router.push(`/owners/${o.ownerId}`); }}>Review KYC</button>
                  ) : (
                    <Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} />
                  )}
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={8} className="muted" style={{ padding: 24, textAlign: 'center' }}>No owners in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {invite && <InviteOwnerModal onClose={() => setInvite(false)} onDone={() => { setInvite(false); refetch(); }} />}
    </div>
  );
}

function InviteOwnerModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', biz: '', email: '', phone: '', city: 'Bangalore' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [inviteOwner, { loading }] = useMutation(INVITE_OWNER, REFRESH_NAV);
  return (
    <Modal
      title="Invite owner"
      sub="Creates an operator in review — they complete KYC from the owner app"
      onClose={onClose}
      width={480}
      foot={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={loading || !form.name || !form.biz || !form.email}
            onClick={async () => {
              const { data } = await inviteOwner({ variables: { input: form } });
              if (data?.adminInviteOwner?.success) { toast('Invite sent'); onDone(); }
              else toast(data?.adminInviteOwner?.message || 'Could not invite');
            }}
          >
            <Icon name="mail" size={16} />Send invite
          </button>
        </>
      }
    >
      <div className="field"><label>Contact name</label><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ravi Kumar" /></div>
      <div className="field"><label>Business name</label><input value={form.biz} onChange={(e) => set('biz', e.target.value)} placeholder="e.g. Northside Turf Pvt Ltd" /></div>
      <div className="row gap12">
        <div className="field" style={{ flex: 1.4 }}><label>Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="owner@business.in" /></div>
        <div className="field" style={{ flex: 1 }}><label>Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" /></div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>City</label>
        <select value={form.city} onChange={(e) => set('city', e.target.value)}>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
    </Modal>
  );
}
