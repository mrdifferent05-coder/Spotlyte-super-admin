'use client';

// /payouts — owner settlements list + Run payouts (Section 8.10).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { PAYOUT_LIST, RUN_PAYOUTS, RETRY_PAYOUT, APPROVE_PAYOUT, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import { downloadCSV } from '@/lib/csv';
import { Icon, Avatar, Badge, StatCard, SecHead, It, Tabs, useSort, Th, fmtINR } from '@/components/ui';

export default function PayoutsPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState('queued');
  const { data, refetch } = useQuery(PAYOUT_LIST, { variables: { tab } });
  const opts = { ...REFRESH_NAV, onCompleted: () => refetch() };
  const [runPayouts, { loading: running }] = useMutation(RUN_PAYOUTS, opts);
  const [approvePayout] = useMutation(APPROVE_PAYOUT, opts);
  const [retryPayout] = useMutation(RETRY_PAYOUT, opts);

  const d = data?.getAdminPayoutList;
  const counts = d?.counts || {};
  const stats = d?.stats || {};
  const rows = (d?.payouts || []).map((p) => ({ ...p, id: p.payoutId }));
  const [sorted, sort, toggle] = useSort(rows);

  const inr = (n) => {
    const s = fmtINR(n);
    const m = s.match(/^(.+?)\s(Cr|L)$/);
    return m ? { value: m[1], unit: m[2] } : { value: s, unit: undefined };
  };
  const settled = inr(stats.settled30);
  const fees = inr(stats.fees30);

  return (
    <div className="page page-wide">
      <SecHead
        eyebrow={`PAYOUTS · NEXT RUN ${d?.nextRunLabel || '—'}`}
        title={
          <>
            Money <It>moving</It>.
          </>
        }
      >
        <button
          className="btn"
          onClick={() =>
            downloadCSV(
              'spotlyte-payout-statement',
              rows.map((p) => ({
                id: p.payoutId,
                owner: p.owner,
                biz: p.biz,
                period: p.period,
                gross: p.gross,
                fee: p.fee,
                tds: p.tds,
                net: p.amount,
                status: p.status,
                utr: p.utr || '',
              }))
            )
          }
        >
          <Icon name="download" size={16} />
          Statement
        </button>
        <button
          className="btn btn-primary"
          disabled={running}
          onClick={async () => {
            const r = await runPayouts();
            toast(r.data?.adminRunPayouts?.message || 'Payout run scheduled');
          }}
        >
          <Icon name="bolt" size={16} />
          Run payouts
        </button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard
          label="Queued for payout"
          value={fmtINR(stats.queuedTotal)}
          meta={`${counts.queued ?? 0} queued · ${counts.processing ?? 0} processing`}
          color="var(--info)"
        />
        <StatCard label="Settled · 30D" value={settled.value} unit={settled.unit} delta={stats.settled30Delta} meta={`Across ${stats.settledTransfers ?? 0} transfers`} />
        <StatCard label="Platform fees · 30D" value={fees.value} unit={fees.unit} meta={`Avg ${stats.avgTakeRate ?? 18}% take rate`} />
        <StatCard label="Failed transfers" value={counts.failed ?? '—'} meta="Bank detail mismatch" color="var(--danger)" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'queued', label: 'Queued', count: counts.queued },
          { value: 'processing', label: 'Processing', count: counts.processing },
          { value: 'settled', label: 'Settled', count: counts.settled },
          { value: 'failed', label: 'Failed', count: counts.failed },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <Th k="id" sort={sort} toggle={toggle}>
                Payout
              </Th>
              <Th k="owner" sort={sort} toggle={toggle}>
                Owner
              </Th>
              <Th k="period" sort={sort} toggle={toggle}>
                Period
              </Th>
              <Th k="gross" sort={sort} toggle={toggle} num>
                Gross
              </Th>
              <Th k="fee" sort={sort} toggle={toggle} num>
                Fee
              </Th>
              <Th k="amount" sort={sort} toggle={toggle} num>
                Net payout
              </Th>
              <Th k="status" sort={sort} toggle={toggle}>
                Status
              </Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.payoutId} className="clickable" onClick={() => router.push(`/payouts/${p.payoutId}`)}>
                <td>
                  <span className="ref">#{p.payoutId}</span>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {p.bank}
                  </div>
                </td>
                <td>
                  <div className="who">
                    <Avatar color={p.color} init={p.initials} />
                    <div>
                      <div className="nm">{p.owner}</div>
                      <div className="sub">{p.biz}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{p.period}</td>
                <td className="num-col muted">{fmtINR(p.gross)}</td>
                <td className="num-col" style={{ color: 'var(--danger)' }}>
                  −{fmtINR(p.fee)}
                </td>
                <td className="num-col strong">{fmtINR(p.amount)}</td>
                <td>
                  <Badge status={p.status} />
                </td>
                <td className="num-col">
                  {p.status === 'queued' ? (
                    <button
                      className="btn btn-sm btn-dark"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const r = await approvePayout({ variables: { payoutId: p.payoutId } });
                        toast(r.data?.adminApprovePayout?.message || 'Approved · now processing');
                      }}
                    >
                      Release
                    </button>
                  ) : p.status === 'failed' ? (
                    <button
                      className="btn btn-sm"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const r = await retryPayout({ variables: { payoutId: p.payoutId } });
                        toast(r.data?.adminRetryPayout?.message || 'Retrying transfer');
                      }}
                    >
                      <Icon name="refresh" size={13} />
                      Retry
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>
                      {p.settles}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={8} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  No payouts in this view. Hit “Run payouts” to queue settlements.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
