'use client';

// /users/[id] — customer detail with ban/reinstate (Section 8.8).
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { USER_DETAIL, BAN_USER, REINSTATE_USER, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import { Icon, Avatar, Badge, Panel, KV, Mono, Sparkline, Stat, HeadBar, Back, VenueThumb, fmtINR } from '@/components/ui';

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const { data, refetch } = useQuery(USER_DETAIL, { variables: { userId: id } });
  const opts = { ...REFRESH_NAV, onCompleted: () => refetch() };
  const [ban] = useMutation(BAN_USER, opts);
  const [reinstate] = useMutation(REINSTATE_USER, opts);

  const d = data?.getAdminUserDetail;
  if (!d)
    return (
      <div className="page">
        <div className="muted" style={{ padding: 40 }}>
          Loading user…
        </div>
      </div>
    );
  const u = d.user;
  const s = d.activityStats || {};

  return (
    <div className="page">
      <Back label="All users" onClick={() => router.push('/users')} />
      <HeadBar
        avatar={<Avatar color={u.color} init={u.initials} size="lg" />}
        title={u.name}
        badges={
          <>
            <Badge status={u.status} />
            <span className="badge gray" style={{ fontSize: 11 }}>
              {u.userId}
            </span>
          </>
        }
        sub={`${u.city} · joined ${u.joined} · last seen ${u.lastSeen}`}
        actions={
          <>
            <button className="btn" onClick={() => toast(`Message sent to ${u.name}`)}>
              <Icon name="mail" size={16} />
              Message
            </button>
            {u.status === 'banned' ? (
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const r = await reinstate({ variables: { userId: u.userId } });
                  toast(r.data?.adminReinstateUser?.message || 'User reinstated');
                }}
              >
                <Icon name="refresh" size={16} />
                Reinstate
              </button>
            ) : (
              <button
                className="btn"
                style={{ color: 'var(--danger)' }}
                onClick={async () => {
                  const r = await ban({ variables: { userId: u.userId } });
                  toast(r.data?.adminBanUser?.message || 'User banned');
                }}
              >
                <Icon name="ban" size={16} />
                Ban user
              </button>
            )}
          </>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        <div className="col gap16">
          <Panel eyebrow="ACTIVITY" title="Overall activity.">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <Stat label="BOOKINGS" value={s.bookings ?? 0} />
              <Stat label="LIFETIME SPEND" value={fmtINR(s.spend)} />
              <Stat label="AVG TICKET" value={fmtINR(s.avgTicket)} />
              <Stat label="CANCELLATIONS" value={s.cancellations ?? 0} />
            </div>
          </Panel>

          <Panel eyebrow="BOOKING HISTORY" title="Where they played." pad={false}>
            <div style={{ padding: '4px 10px 10px' }}>
              {d.bookings.length ? (
                d.bookings.map((b) => (
                  <div
                    key={b.bookingId}
                    className="row gap12"
                    style={{ padding: '11px 14px', borderRadius: 11, cursor: 'pointer' }}
                    onClick={() => router.push(`/bookings/${b.bookingId}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--wash)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <VenueThumb name={b.venueName} size={34} />
                    <div className="fill">
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{b.venueName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {b.courtName} · {b.date}
                      </div>
                    </div>
                    <Badge status={b.status} />
                    <span className="num" style={{ fontSize: 14, width: 62, textAlign: 'right' }}>
                      {fmtINR(b.amount, { full: true })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="muted" style={{ padding: 16, fontSize: 13 }}>
                  No bookings yet.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="col gap16">
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              CONTACT
            </div>
            <KV
              items={[
                ['Name', u.name],
                ['Email', <Mono key="e">{u.email}</Mono>],
                ['Phone', u.phone],
                ['City', u.city],
                ['Member since', u.joined],
              ]}
            />
          </div>
          {u.status === 'flagged' && (
            <div className="card card-pad" style={{ background: 'var(--danger-soft)', borderColor: 'color-mix(in oklab, var(--danger) 22%, transparent)' }}>
              <div className="row gap10">
                <Icon name="flag" size={18} style={{ color: 'var(--danger)' }} />
                <div>
                  <b style={{ fontSize: 13 }}>Flagged for review</b>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {s.flaggedNote || 'Fraud & abuse signals'}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              SPEND TREND · 14 DAYS
            </div>
            <Sparkline data={d.spark} h={56} color="var(--brand)" />
          </div>
        </div>
      </div>
    </div>
  );
}
