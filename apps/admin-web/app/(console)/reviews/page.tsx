'use client';

// /reviews — moderation queue with auto-flag rules (Section 8.9).
import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { REVIEW_LIST, MODERATE_REVIEW, AUTOFLAG_RULES, SET_AUTOFLAG_RULES, REFRESH_NAV } from '@/lib/gql';
import { useToast } from '@/lib/toast';
import {
  Icon, Avatar, Badge, Stars, StatCard, SecHead, It, Tabs, Modal,
} from '@/components/ui';

const RULES: { key: string; label: string; sub: string }[] = [
  { key: 'phoneNumbers', label: 'Phone numbers', sub: 'Flags reviews containing Indian mobile numbers' },
  { key: 'urls', label: 'URLs & link shorteners', sub: 'http(s), www, bit.ly and friends' },
  { key: 'spamWords', label: 'Spam repetition', sub: '“spam / fake / scam” wording and repeated words' },
  { key: 'profanity', label: 'Profanity', sub: 'Common abusive terms' },
];

export default function ReviewsPage() {
  const toast = useToast();
  const [tab, setTab] = useState('flagged');
  const [rulesOpen, setRulesOpen] = useState(false);
  const { data, refetch } = useQuery(REVIEW_LIST, { variables: { tab } });
  const [moderate] = useMutation(MODERATE_REVIEW, { ...REFRESH_NAV, onCompleted: () => refetch() });
  const d = data?.getAdminReviewList;
  const counts = d?.counts || {};
  const stats = d?.stats || {};

  const act = async (reviewId: string, action: string) => {
    const r = await moderate({ variables: { reviewId, action } });
    toast(r.data?.adminModerateReview?.message || 'Done');
  };

  return (
    <div className="page">
      <SecHead eyebrow="REVIEWS · MODERATION" title={<>Keep the <It>signal</It> clean.</>}>
        <button className="btn" onClick={() => setRulesOpen(true)}><Icon name="settings" size={16} />Auto-flag rules</button>
      </SecHead>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <StatCard label="Total reviews" value={stats.total ?? '—'} delta={stats.totalDelta} meta={`Avg ${stats.avg ?? '—'} ★`} />
        <StatCard label="Flagged" value={stats.flagged ?? '—'} meta="Spam / abuse signals" color="var(--danger)" />
        <StatCard label="Awaiting moderation" value={stats.pending ?? '—'} meta="New since yesterday" color="var(--warn)" />
        <StatCard label="1-star rate" value={stats.oneStarRate ?? '—'} unit="%" delta={-1} meta="Within healthy range" color="var(--brand)" />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'flagged', label: 'Flagged', count: counts.flagged },
          { value: 'pending', label: 'Pending', count: counts.pending },
          { value: 'visible', label: 'Visible', count: counts.visible },
          { value: 'all', label: 'All', count: counts.all },
        ]}
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(d?.reviews || []).map((r: any) => (
          <div key={r.reviewId} className="card card-pad">
            <div className="row between">
              <div className="who">
                <Avatar color={r.color} init={r.initials} />
                <div>
                  <div className="nm">{r.user}</div>
                  <div className="sub">on {r.venue} · {r.dateAgo}</div>
                </div>
              </div>
              <Badge status={r.status} />
            </div>
            <div className="row gap8" style={{ margin: '14px 0 8px' }}>
              <Stars n={r.rating} />
              {r.flags > 0 && (
                <span className="badge red" style={{ fontSize: 11 }}><Icon name="flag" size={12} />{r.flags} flags</span>
              )}
            </div>
            <p className="quote">“{r.text}”</p>
            <div className="row gap8" style={{ marginTop: 16 }}>
              {r.status !== 'visible' && (
                <button className="btn btn-sm btn-primary" onClick={() => act(r.reviewId, 'approve')}>
                  <Icon name="check" size={14} />Approve
                </button>
              )}
              {r.status !== 'hidden' && (
                <button className="btn btn-sm" onClick={() => act(r.reviewId, 'hide')}>
                  <Icon name="eye" size={14} />Hide
                </button>
              )}
              {r.status !== 'flagged' && (
                <button className="btn btn-sm btn-ghost" onClick={() => act(r.reviewId, 'escalate')}>
                  <Icon name="flag" size={14} />Escalate
                </button>
              )}
              <DeleteButton onConfirm={() => act(r.reviewId, 'delete')} />
            </div>
          </div>
        ))}
        {!(d?.reviews || []).length && (
          <div className="card card-pad muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 32 }}>
            Nothing in this queue. Clean signal.
          </div>
        )}
      </div>

      {rulesOpen && <AutoflagModal onClose={() => setRulesOpen(false)} />}
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className="row gap6" style={{ marginLeft: 'auto' }}>
        <span className="muted" style={{ fontSize: 12 }}>Delete?</span>
        <button className="btn btn-sm btn-danger" onClick={onConfirm}>Yes</button>
        <button className="btn btn-sm" onClick={() => setConfirm(false)}>No</button>
      </span>
    );
  }
  return (
    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => setConfirm(true)}>
      <Icon name="trash" size={14} />Delete
    </button>
  );
}

function AutoflagModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { data } = useQuery(AUTOFLAG_RULES);
  const [setRulesMut] = useMutation(SET_AUTOFLAG_RULES);
  const [local, setLocal] = useState<Record<string, boolean> | null>(null);
  const rules = local || data?.getAdminAutoflagRules || { phoneNumbers: true, urls: true, spamWords: true, profanity: true };

  return (
    <Modal
      title="Auto-flag rules"
      sub="New reviews matching an enabled rule are flagged on arrival"
      onClose={onClose}
      width={500}
      foot={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              const r = await setRulesMut({ variables: { rules } });
              toast(r.data?.adminSetAutoflagRules?.message || 'Auto-flag rules saved');
              onClose();
            }}
          >
            <Icon name="check" size={16} />Save rules
          </button>
        </>
      }
    >
      {RULES.map((r) => (
        <div
          key={r.key}
          className={'checkrow' + (rules[r.key] ? ' on' : '')}
          onClick={() => setLocal({ ...rules, [r.key]: !rules[r.key] })}
        >
          <span className="cb">{rules[r.key] && <Icon name="check" size={13} />}</span>
          <div className="fill">
            <div style={{ fontWeight: 500 }}>{r.label}</div>
            <div className="muted" style={{ fontSize: 12 }}>{r.sub}</div>
          </div>
        </div>
      ))}
    </Modal>
  );
}
