// ids.js — human-readable public IDs via an atomic `counters` collection.
// Formats (Section 3): OWN-2040, VEN-7100, BKG-48210, USR-33010, REV-5510,
// PO-3072, INV-O-1040 / INV-U-8040, PRM-610, ADV-440, SP-7D2X9A, LOG-90120.

const SEQ_START = {
  owner: 2040,
  venue: 7100,
  booking: 48210,
  user: 33010,
  review: 5510,
  payout: 3072,
  invoiceOwner: 1040,
  invoiceUser: 8040,
  promo: 610,
  ad: 440,
  dispute: 0,
  log: 90120,
  admin: 10,
};

const PREFIX = {
  owner: (n) => `OWN-${n}`,
  venue: (n) => `VEN-${n}`,
  booking: (n) => `BKG-${n}`,
  user: (n) => `USR-${n}`,
  review: (n) => `REV-${n}`,
  payout: (n) => `PO-${n}`,
  invoiceOwner: (n) => `INV-O-${n}`,
  invoiceUser: (n) => `INV-U-${n}`,
  promo: (n) => `PRM-${n}`,
  ad: (n) => `ADV-${n}`,
  dispute: (n) => `SP-${disputeCode(n)}`,
  log: (n) => `LOG-${n}`,
  admin: (n) => `ADM-${n}`,
};

// SP refs look like SP-7D2X9A — base-32-ish code derived from the sequence,
// stable and collision-free because the sequence is atomic.
function disputeCode(n) {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let v = 0x7d2000 + n * 977; // keeps the familiar 7D2… look from the design
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = alphabet[v % 32] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

export async function nextSeq(db, name) {
  const res = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 }, $setOnInsert: { start: SEQ_START[name] ?? 0 } },
    { upsert: true, returnDocument: 'after' }
  );
  const doc = res && (res.value || res); // driver v6 returns the doc directly
  return (SEQ_START[name] ?? 0) + doc.seq - 1;
}

export async function nextId(db, name) {
  const n = await nextSeq(db, name);
  const fmt = PREFIX[name];
  if (!fmt) throw new Error(`Unknown id namespace: ${name}`);
  return fmt(n);
}
