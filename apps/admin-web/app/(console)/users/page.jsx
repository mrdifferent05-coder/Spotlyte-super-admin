'use client';

// /users — customer base (Section 8.8).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { USER_LIST } from '@/lib/gql';
import { downloadCSV } from '@/lib/csv';
import { Icon, Avatar, Badge, StatCard, SecHead, It, Tabs, Toolbar, useSort, Th, fmtINR } from '@/components/ui';

export default function UsersPage() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const { data } = useQuery(USER_LIST, { variables: { tab, q } });
  const d = data?.getAdminUserList;
  const counts = d?.counts || {};
  const stats = d?.stats || {};
  const rows = (d?.users || []).map((u) => ({ ...u, id: u.userId }));
  const [sorted, sort, toggle] = useSort(rows);

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow={`USERS · ${stats.registered ?? '—'} REGISTERED`}
        title={
          <>
            The people who <It>play</It>.
          </>
        }
      >
        <button
          className="btn"
          onClick={() =>
            downloadCSV(
              'spotlyte-users',
              rows.map((u) => ({
                id: u.userId,
                name: u.name,
                email: u.email,
                city: u.city,
                joined: u.joined,
                bookings: u.bookings,
                spend: u.spend,
                status: u.status,
              }))
            )
          }
        >
          <Icon name="download" size={16} />
          Export
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Registered users" value={stats.registered ?? '—'} delta={stats.registeredDelta} meta={`${stats.newThisMonth ?? 0} new this month`} />
        <StatCard label="Monthly active" value={stats.monthlyActive ?? '—'} meta={`${stats.activePct ?? 0}% of base`} />
        <StatCard label="Avg LTV" value={fmtINR(stats.avgLtv)} meta={`${stats.avgBookings ?? 0} bookings / user`} />
        <StatCard label="Flagged / banned" value={stats.flaggedBanned ?? '—'} meta="Fraud & abuse review" color="var(--danger)" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'flagged', label: 'Flagged', count: counts.flagged },
          { value: 'banned', label: 'Banned', count: counts.banned },
        ]}
      />

      <Toolbar q={q} setQ={setQ} placeholder="Search name, email, city…" />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th k="name" sort={sort} toggle={toggle}>
                User
              </Th>
              <Th k="city" sort={sort} toggle={toggle}>
                City
              </Th>
              <Th k="joined" sort={sort} toggle={toggle}>
                Joined
              </Th>
              <Th k="bookings" sort={sort} toggle={toggle} num>
                Bookings
              </Th>
              <Th k="spend" sort={sort} toggle={toggle} num>
                Lifetime spend
              </Th>
              <Th k="lastSeen" sort={sort} toggle={toggle}>
                Last seen
              </Th>
              <Th k="status" sort={sort} toggle={toggle}>
                Status
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr key={u.userId} className="clickable" onClick={() => router.push(`/users/${u.userId}`)}>
                <td>
                  <div className="who">
                    <Avatar color={u.color} init={u.initials} />
                    <div>
                      <div className="nm">{u.name}</div>
                      <div className="sub">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{u.city}</td>
                <td className="muted">{u.joined}</td>
                <td className="num-col strong">{u.bookings}</td>
                <td className="num-col strong">{fmtINR(u.spend)}</td>
                <td className="muted">{u.lastSeen}</td>
                <td>
                  <Badge status={u.status} />
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  No users in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
