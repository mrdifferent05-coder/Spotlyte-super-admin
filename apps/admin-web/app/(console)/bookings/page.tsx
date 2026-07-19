'use client';

// /bookings — all transactions (Section 8.6).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { BOOKING_PAGE } from '@/lib/gql';
import { downloadCSV } from '@/lib/csv';
import {
  Icon, Avatar, Badge, StatCard, SecHead, It, Tabs, Toolbar, useSort, Th, fmtINR,
} from '@/components/ui';

export default function BookingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const { data } = useQuery(BOOKING_PAGE, { variables: { tab, q } });
  const d = data?.getAdminBookingPage;
  const counts = d?.counts || {};
  const stats = d?.stats || {};
  const rows = (d?.bookings || []).map((b: any) => ({ ...b, id: b.bookingId, customer: b.customerName, venue: b.venueName }));
  const [sorted, sort, toggle] = useSort(rows);

  return (
    <div className="page page-wide">
      <SecHead eyebrow={`BOOKINGS · ${counts.all ?? '—'} · 30D`} title={<>Every slot, <It>booked</It>.</>}>
        <button className="btn"><Icon name="calendar" size={16} />{d?.monthLabel || '—'}</button>
        <button
          className="btn"
          onClick={() => downloadCSV('spotlyte-bookings', rows.map((b: any) => ({
            id: b.bookingId, customer: b.customer, venue: b.venue, court: b.courtName, date: b.date, time: b.timeRange, method: b.method, amount: b.amount, status: b.status, txn: b.txnRef,
          })))}
        >
          <Icon name="download" size={16} />Export
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Gross bookings · 30D" value={stats.gross30 ?? '—'} delta={stats.gross30Delta} meta={`${fmtINR(stats.gmv30)} GMV`} />
        <StatCard label="Confirmed upcoming" value={stats.upcoming7 ?? '—'} meta="Next 7 days" />
        <StatCard label="Cancellation rate" value={stats.cancellationRate ?? '—'} unit="%" delta={stats.cancellationRate != null ? -1 : null} meta={stats.cxlMeta} color="var(--brand)" />
        <StatCard label="Refunds · 30D" value={fmtINR(stats.refunds30)} meta={`${stats.refundTxns ?? 0} transactions`} color="var(--info)" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'confirmed', label: 'Confirmed', count: counts.confirmed },
          { value: 'completed', label: 'Completed', count: counts.completed },
          { value: 'cancelled', label: 'Cancelled / No-show', count: counts.cancelled },
          { value: 'refunded', label: 'Refunded', count: counts.refunded },
        ]}
      />
      <Toolbar q={q} setQ={setQ} placeholder="Search booking ID, customer, venue, txn…" />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th k="id" sort={sort} toggle={toggle}>Booking</Th>
              <Th k="customer" sort={sort} toggle={toggle}>Customer</Th>
              <Th k="venue" sort={sort} toggle={toggle}>Venue / Court</Th>
              <Th k="createdAt" sort={sort} toggle={toggle}>Date · Time</Th>
              <Th k="method" sort={sort} toggle={toggle}>Payment</Th>
              <Th k="amount" sort={sort} toggle={toggle} num>Amount</Th>
              <Th k="status" sort={sort} toggle={toggle}>Status</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((b: any) => (
              <tr key={b.bookingId} className="clickable" onClick={() => router.push(`/bookings/${b.bookingId}`)}>
                <td><span className="ref">#{b.bookingId}</span></td>
                <td><div className="who"><Avatar color={b.color} init={b.initials} /><span className="nm">{b.customer}</span></div></td>
                <td>
                  <div className="strong">{b.venue}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{b.courtName} · {b.sport}</div>
                </td>
                <td>
                  <div className="strong">{b.date}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{b.timeRange} · {b.duration}</div>
                </td>
                <td><span className="badge gray" style={{ fontSize: 11 }}>{b.method}</span></td>
                <td className="num-col strong">{fmtINR(b.amount, { full: true })}</td>
                <td><Badge status={b.status} /></td>
                <td className="num-col"><Icon name="chevronRight" size={16} style={{ color: 'var(--muted-2)' }} /></td>
              </tr>
            ))}
            {!sorted.length && (
              <tr><td colSpan={8} className="muted" style={{ padding: 24, textAlign: 'center' }}>No bookings in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
