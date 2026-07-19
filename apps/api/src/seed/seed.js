// seed.js — deterministic wipe + insert. Recreates the marketplace scale from
// the approved design (Section 12) with all dates relative to `now`, so the
// console feels alive on first boot. Run: npm run seed
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb, closeDb } from '../db.js';
import { payoutMath, gst, TIERS } from '../services/money.js';
import { spark, avColor, initials, periodLabel, dayShort, nextMonday, maskBank, MIN, HOUR, DAY } from '../services/format.js';
import { checkReview, DEFAULT_RULES } from '../services/autoflag.js';

const now = Date.now();
const minAgo = (n) => now - n * MIN;
const hoursAgo = (n) => now - n * HOUR;
const daysAgo = (n) => now - n * DAY;
const at = (ms, h, m = 0) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
};

const CITIES = ['Bangalore', 'Chennai', 'Mumbai', 'Hyderabad', 'Pune', 'Delhi'];
const SPORTS = ['Football', 'Cricket', 'Badminton', 'Basketball', 'Pickleball', 'Tennis'];
const SURFACE = {
  Football: 'Artificial turf', Cricket: 'Astro pitch', Badminton: 'Synthetic mat',
  Basketball: 'Acrylic hard court', Pickleball: 'Cushioned acrylic', Tennis: 'Synthetic hard court',
};
const AMENITIES = ['Floodlights', 'Parking', 'Changing rooms', 'Drinking water', 'Washrooms', 'Seating / gallery', 'Equipment rental', 'First aid', 'CCTV', 'Cafeteria'];
const STATE_CODE = { Bangalore: '29', Chennai: '33', Mumbai: '27', Hyderabad: '36', Pune: '27', Delhi: '07' };
const BANKS = [
  ['HDFC Bank', 'HDFC0001234'], ['ICICI Bank', 'ICIC0004412'], ['Axis Bank', 'UTIB0002231'],
  ['State Bank of India', 'SBIN0009087'], ['Kotak Mahindra', 'KKBK0007781'],
];
const PLAN_CYCLE = ['Growth', 'Standard', 'Strategic', 'Starter'];
const CXL = [
  { tier: 'Flexible', text: 'Full refund up to 24 h before slot' },
  { tier: 'Moderate', text: '50% refund up to 12 h before slot' },
  { tier: 'Strict', text: 'No refund within 48 h of slot' },
];
const OWNER_DOCS = ['PAN Card', 'GST Certificate', 'Business Registration', 'Bank Proof', 'Identity (Aadhaar)', 'Venue Ownership / Lease'];

async function main() {
  const db = await getDb();
  console.log('Seeding spotlyte …');

  const cols = ['admins', 'owners', 'venues', 'customers', 'bookings', 'reviews', 'payouts', 'invoices', 'promos', 'adPlacements', 'disputes', 'auditLogs', 'settings', 'counters'];
  for (const c of cols) await db.collection(c).deleteMany({});

  // ── admins ────────────────────────────────────────────────
  const hash = bcrypt.hashSync('admin123', 10);
  const admins = [
    { adminId: 'ADM-10', name: 'Priya Menon', email: 'priya@spotlyte.in', role: 'super' },
    { adminId: 'ADM-11', name: 'Rajesh K', email: 'rajesh@spotlyte.in', role: 'Ops' },
    { adminId: 'ADM-12', name: 'Anish T', email: 'anish@spotlyte.in', role: 'Finance' },
  ].map((a) => ({ ...a, passwordHash: hash, createdAt: daysAgo(400) }));
  await db.collection('admins').insertMany(admins);

  // ── owners (14 — every KYC state, exact cast) ────────────
  // [name, biz, city, kyc, joinedDaysAgo|null, submittedAgo(ms)|null, revenue, payout, rating, disputes]
  const ownerRaw = [
    ['Suresh Sharma', 'spotlyte Sports LLP', 'Chennai', 'verified', 545, null, 1910000, 410000, 4.8, 3],
    ['Anita Reddy', 'GreenField Arenas', 'Hyderabad', 'verified', 470, null, 880000, 95000, 4.6, 1],
    ['Mohan Kumar', 'PlayCircle Pvt Ltd', 'Hyderabad', 'verified', 434, null, 640000, 51000, 4.8, 0],
    ['Farhan Qureshi', 'SportHaus', 'Mumbai', 'review', null, daysAgo(7), 0, 0, 0, 0],
    ['Deepa Nair', 'TurfXL Networks', 'Chennai', 'verified', 598, null, 2240000, 84000, 4.7, 2],
    ['Vikram Singh', 'Maidan Group', 'Bangalore', 'verified', 638, null, 3100000, 110000, 4.6, 3],
    ['Rhea Mathew', 'Baseline Courts', 'Pune', 'docs', null, daysAgo(4), 0, 0, 0, 0],
    ['Karan Mehta', 'Acefield Arena', 'Mumbai', 'review', null, daysAgo(2), 0, 0, 0, 0],
    ['Lakshmi Iyer', 'SmashPoint', 'Bangalore', 'verified', 400, null, 720000, 38000, 4.9, 0],
    ['Arjun Das', 'Koregaon Sports', 'Pune', 'suspended', 590, null, 410000, 0, 4.1, 4],
    ['Nisha Patel', 'Stride Athletics', 'Bangalore', 'review', null, hoursAgo(26), 0, 0, 0, 0],
    ['Imran Shaikh', 'PowerPlay Turf', 'Mumbai', 'verified', 415, null, 330000, 29000, 4.5, 1],
    ['Tara Krishnan', 'RallyHub', 'Chennai', 'docs', null, daysAgo(3), 0, 0, 0, 0],
    ['Gaurav Joshi', 'Northline Courts', 'Delhi', 'rejected', null, daysAgo(60), 0, 0, 0, 0],
  ];
  const owners = ownerRaw.map((o, i) => {
    const [name, biz, city, kyc, joinedDays, submittedAt, revenue, payout, rating, disputes] = o;
    const seq = 2040 + i;
    const pan = ['AAB', 'AAC', 'AAD', 'ABC', 'ABD', 'AAE', 'AAF'][seq % 7] + 'CS' + String(1234 + seq * 11).slice(0, 4) + ['F', 'G', 'H', 'K', 'M'][seq % 5];
    const gstin = (STATE_CODE[city] || '29') + pan + '1Z' + ((seq % 9) + 1);
    const [bankName, ifsc] = BANKS[seq % 5];
    const acctTail = String(70030000 + seq * 131).slice(-4);
    const planName = kyc === 'verified' ? PLAN_CYCLE[seq % 4] : 'Starter';
    const tier = TIERS[planName] || TIERS.Standard;
    const pendingDoc = kyc === 'docs';
    const docs = OWNER_DOCS.map((dn, di) => ({
      name: dn,
      ref: [pan, gstin, `LLP-2024-${seq}`, `${bankName.split(' ')[0].toUpperCase()} ••${acctTail}`, 'XXXX-XXXX-4821', '3 documents'][di],
      status: pendingDoc && (dn === 'Bank Proof' || dn === 'Venue Ownership / Lease') ? 'missing' : kyc === 'review' && dn === 'Venue Ownership / Lease' ? 'pending' : kyc === 'verified' ? 'verified' : di < 3 ? 'verified' : 'pending',
      fileUrl: null,
      uploadedAt: daysAgo(30 + i),
    }));
    return {
      ownerId: `OWN-${seq}`,
      name, biz, city, kyc,
      email: name.toLowerCase().replace(/ /g, '.') + '@' + biz.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) + '.in',
      phone: '+91 ' + String(90000 + i * 137).slice(0, 5) + ' ' + String(10000 + i * 321).slice(0, 5),
      commissionTier: { name: tier.name, pct: tier.pct },
      plan: {
        name: tier.name, priceMo: tier.priceMo, commissionPct: tier.pct,
        renews: kyc === 'verified' ? `01 ${['Jun', 'Jul', 'Aug'][seq % 3]} ${new Date(now).getFullYear()}` : '—',
        billing: kyc === 'verified' ? `Auto-debit · ${bankName.split(' ')[0]}` : 'Not set up',
      },
      legal: { legalName: biz, pan, gstin, regType: /llp/i.test(biz) ? 'LLP' : /pvt/i.test(biz) ? 'Private Limited' : 'Proprietorship' },
      bank: { bankName, accountHolder: biz, accountNoMasked: `•••• •••• ${acctTail}`, ifsc, branch: `${city} Main`, verified: kyc === 'verified' },
      cancellationPolicy: CXL[seq % 3],
      documents: docs,
      requestedDocs: pendingDoc ? ['Bank account proof (cancelled cheque)', 'Venue ownership / lease deed'] : [],
      rejection: kyc === 'rejected' ? { reason: 'Business not verifiable', note: 'GSTIN lookup failed twice.', at: daysAgo(58) } : null,
      revenue, pendingPayout: payout, rating: rating || null, disputeCount: disputes, venueCount: 0,
      spark: spark(i * 7 + 3, 14, 1),
      joinedAt: joinedDays ? daysAgo(joinedDays) : submittedAt,
      submittedAt: submittedAt || (joinedDays ? daysAgo(joinedDays) : now),
      createdAt: joinedDays ? daysAgo(joinedDays) : submittedAt,
      updatedAt: now,
    };
  });
  await db.collection('owners').insertMany(owners);
  const ownerByName = Object.fromEntries(owners.map((o) => [o.name, o]));

  // ── venues (16 — exact cast) ─────────────────────────────
  // [name, city, ownerName, status, featured, courts, revenue30d, bookings30d, occupancy, rating, reviews]
  const venueRaw = [
    ['Maidan HSR', 'Bangalore', 'Vikram Singh', 'live', true, 6, 510000, 612, 84, 4.9, 426],
    ['TurfXL Velachery', 'Chennai', 'Deepa Nair', 'live', true, 5, 380000, 456, 78, 4.8, 312],
    ['Maidan Indiranagar', 'Bangalore', 'Vikram Singh', 'live', false, 4, 300000, 364, 69, 4.6, 209],
    ['SportHaus Powai', 'Mumbai', 'Farhan Qureshi', 'pending', false, 4, 0, 0, 0, 0, 0],
    ['TurfXL Anna Nagar', 'Chennai', 'Deepa Nair', 'live', false, 3, 220000, 287, 71, 4.7, 184],
    ['PlayCircle Banjara', 'Hyderabad', 'Mohan Kumar', 'live', true, 3, 160000, 214, 74, 4.8, 96],
    ['Maidan Koregaon', 'Pune', 'Arjun Das', 'paused', false, 2, 89000, 121, 54, 4.4, 58],
    ['GreenField Gachibowli', 'Hyderabad', 'Anita Reddy', 'live', false, 3, 210000, 256, 72, 4.6, 142],
    ['SmashPoint Jayanagar', 'Bangalore', 'Lakshmi Iyer', 'live', false, 3, 180000, 198, 68, 4.9, 121],
    ['Acefield Andheri', 'Mumbai', 'Karan Mehta', 'pending', false, 2, 0, 0, 0, 0, 0],
    ['PowerPlay Bandra', 'Mumbai', 'Imran Shaikh', 'live', false, 2, 140000, 176, 66, 4.5, 88],
    ['Maidan Whitefield', 'Bangalore', 'Vikram Singh', 'live', false, 4, 260000, 301, 70, 4.5, 167],
    ['TurfXL OMR', 'Chennai', 'Deepa Nair', 'review', false, 3, 0, 0, 0, 0, 0],
    ['Stride Koramangala', 'Bangalore', 'Nisha Patel', 'pending', false, 1, 0, 0, 0, 0, 0],
    ['GreenField Kukatpally', 'Hyderabad', 'Anita Reddy', 'live', false, 2, 130000, 162, 63, 4.6, 77],
    ['SmashPoint HSR', 'Bangalore', 'Lakshmi Iyer', 'rejected', false, 2, 0, 0, 0, 0, 0],
  ];
  const pendingAges = [minAgo(38), hoursAgo(2), hoursAgo(5), daysAgo(1)];
  let pendingIdx = 0;
  const venues = venueRaw.map((v, i) => {
    const [name, city, ownerName, status, featured, courtN, revenue30d, bookings30d, occupancy, rating, reviewsCount] = v;
    const seq = 7100 + i;
    const owner = ownerByName[ownerName];
    const sport = SPORTS[i % 6];
    const games = [sport, ...SPORTS.filter((s) => s !== sport)].slice(0, 2 + (seq % 3));
    const courts = Array.from({ length: courtN }).map((_, ci) => ({
      name: `Court ${ci + 1}`,
      sport: games[ci % games.length],
      surface: SURFACE[games[ci % games.length]] || 'Multi-surface',
      size: ['5-a-side', '7-a-side', 'Full size', 'Half court'][ci % 4],
      active: true,
    }));
    const blackouts = courts.flatMap((c, ci) =>
      ['06:00', '12:00', '16:00', '20:00'].filter((_, si) => (seq + ci * 13 + si * 7) % 10 === 4).map((time) => ({ court: c.name, time }))
    );
    return {
      venueId: `VEN-${seq}`,
      ownerId: owner?.ownerId || null,
      ownerName,
      name, city, status,
      addr: `${city} · ${['Sector 1', 'HSR Layout', 'MG Road', 'Tech Park', 'Lake View', 'Ring Rd'][i % 6]}`,
      featured: !!featured,
      featuredSlot: featured ? (i === 0 ? 'Home spotlight' : 'Search top') : null,
      featuredUntil: featured ? now + 24 * DAY : null,
      sport, games, courts, blackouts,
      amenities: AMENITIES.slice(0, 5 + (seq % 4)),
      photos: Array.from({ length: 8 }).map((_, p) => `grad:${p}`),
      pricing: { offPeak: 900, peak: 1400, weekend: 1800 },
      occupancy, rating: rating || null, reviewsCount,
      revenue30d, bookings30d,
      revenueChange: [12, 8, -3, 0, 6, 9, -8, 5, 7, 0, 4, 6, 0, 0, 3, 0][i],
      spark: spark(i * 5 + 11, 12, status === 'paused' ? -1 : 1),
      submittedAt: ['pending', 'review'].includes(status) ? pendingAges[pendingIdx++ % 4] : daysAgo(200 - i * 4),
      createdAt: daysAgo(220 - i * 5),
    };
  });
  await db.collection('venues').insertMany(venues);
  await Promise.all(
    owners.map((o) =>
      db.collection('owners').updateOne(
        { ownerId: o.ownerId },
        { $set: { venueCount: venues.filter((v) => v.ownerId === o.ownerId).length } }
      )
    )
  );
  const venueByName = Object.fromEntries(venues.map((v) => [v.name, v]));
  const liveVenues = venues.filter((v) => v.status === 'live');

  // ── customers (15 — one flagged: Ajith P · one banned: Sanjay G) ──
  const custNames = ['Aswin John', 'Karthik R', 'Meera Iyer', 'Dhanesh M', 'Ajith P', 'Sujith K', 'Rohit S', 'Naren K', 'Priya V', 'Sanjay G', 'Divya R', 'Manoj T', 'Kavya S', 'Rahul N', 'Sneha P'];
  const lastSeenSpread = [hoursAgo(2), hoursAgo(5), daysAgo(1), daysAgo(3), daysAgo(7)];
  const customers = custNames.map((n, i) => {
    const bookingsCount = 4 + ((i * 7) % 40);
    return {
      userId: `USR-${33010 + i}`,
      name: n,
      email: n.toLowerCase().replace(/ /g, '') + '@gmail.com',
      phone: '+91 9' + String(800000000 + i * 1234567).slice(0, 9),
      city: CITIES[i % 6],
      status: n === 'Ajith P' ? 'flagged' : n === 'Sanjay G' ? 'banned' : 'active',
      flagNote: n === 'Ajith P' ? '3 chargebacks in 30 days' : null,
      joinedAt: daysAgo(170 - i * 9),
      lastSeenAt: lastSeenSpread[i % 5],
      bookingsCount,
      lifetimeSpend: bookingsCount * 1450,
      spark: spark(33010 + i, 14, 0),
      createdAt: daysAgo(170 - i * 9),
    };
  });
  await db.collection('customers').insertMany(customers);

  // ── bookings (~67: today grid + 30-day spread + upcoming + dispute-linked) ──
  const AMOUNTS = [1200, 1800, 2400, 900, 1600, 1100, 2000, 1400];
  const METHODS = ['UPI', 'Card', 'UPI', 'Wallet', 'Card'];
  const SLOT_HOURS = [6, 8, 10, 12, 14, 16, 18, 20];
  const bookings = [];
  let bseq = 48210;
  let txn = 900321;
  const mkBooking = (venue, customer, slotAt, status, amount, extra = {}) => {
    const owner = ownerByName[venue.ownerName];
    const gIdx = [0, 0, 0, 1, 0, 2, 0, 1][bseq % 8];
    const b = {
      bookingId: `BKG-${bseq++}`,
      customerId: customer.userId,
      customerName: customer.name,
      customerPhone: customer.phone,
      venueId: venue.venueId,
      venueName: venue.name,
      ownerId: venue.ownerId,
      city: venue.city,
      courtName: `Court ${1 + (bseq % Math.max(1, venue.courts.length))}`,
      sport: venue.games[gIdx % venue.games.length],
      slotAt,
      time: `${String(new Date(slotAt).getHours()).padStart(2, '0')}:00`,
      durationMin: 60,
      amount,
      feePct: owner?.commissionTier?.pct ?? 18,
      status,
      paid: status !== 'cancelled',
      method: METHODS[bseq % 5],
      txnRef: `TXN${(txn += 47)}`,
      payoutId: null,
      refund: status === 'refunded'
        ? { pct: 100, amount, reason: 'Venue cancelled the slot', note: null, at: slotAt + 3 * HOUR, byAdminId: 'ADM-10' }
        : null,
      createdAt: slotAt - (2 + (bseq % 5)) * DAY,
      ...extra,
    };
    bookings.push(b);
    return b;
  };

  // today's slots for the availability grid (2 per live venue: one past-today → completed, one later → confirmed)
  liveVenues.forEach((v, i) => {
    const c1 = customers[i % 15];
    const c2 = customers[(i + 7) % 15];
    const hPast = SLOT_HOURS[i % 4];           // 06–12 → likely past
    const hFut = SLOT_HOURS[4 + (i % 4)];      // 14–20 → likely upcoming
    mkBooking(v, c1, at(now, hPast), at(now, hPast) < now ? 'completed' : 'confirmed', AMOUNTS[i % 8]);
    mkBooking(v, c2, at(now, hFut), at(now, hFut) < now ? 'completed' : 'confirmed', AMOUNTS[(i + 3) % 8]);
  });

  // 30-day spread with the status distribution
  const spreadStatus = ['completed', 'completed', 'confirmed', 'completed', 'cancelled', 'completed', 'refunded', 'completed', 'no-show', 'completed'];
  for (let i = 0; i < 28; i++) {
    const v = liveVenues[i % liveVenues.length];
    const c = customers[(i * 3) % 15];
    const dAgo = 1 + ((i * 29) % 28);
    const slot = at(daysAgo(dAgo), SLOT_HOURS[i % 8]);
    let status = spreadStatus[i % 10];
    if (status === 'confirmed') status = 'completed'; // past slots can't be upcoming
    mkBooking(v, c, slot, status, AMOUNTS[(i * 5) % 8]);
  }

  // upcoming week (confirmed)
  for (let i = 0; i < 8; i++) {
    const v = liveVenues[(i * 2) % liveVenues.length];
    const c = customers[(i * 5 + 2) % 15];
    mkBooking(v, c, at(now + (1 + (i % 6)) * DAY, SLOT_HOURS[2 + (i % 6)]), 'confirmed', AMOUNTS[(i * 7) % 8]);
  }

  // ── disputes (9 — exact reasons/urgency/amounts, threads, linked bookings) ──
  // [customer, venueName, reason, urgency, amount, openedAgoMs, status]
  const dispRaw = [
    ['Aswin John', 'TurfXL Velachery', 'Floodlight failure', 'high', 4067, minAgo(38), 'open'],
    ['Karthik R', 'Maidan Indiranagar', 'Booked but locked', 'medium', 1800, hoursAgo(2), 'open'],
    ['Meera Iyer', 'TurfXL Anna Nagar', 'No-show host', 'high', 2400, hoursAgo(4), 'open'],
    ['Dhanesh M', 'Maidan Indiranagar', 'Equipment missing', 'low', 1100, daysAgo(1), 'investigating'],
    ['Ajith P', 'Maidan Koregaon', 'Refund pending', 'medium', 1600, daysAgo(2), 'open'],
    ['Sujith K', 'SportHaus Powai', 'Wrong sport tagged', 'low', 950, daysAgo(3), 'investigating'],
    ['Rohit S', 'Maidan Koregaon', 'Floodlight failure', 'low', 1400, daysAgo(5), 'resolved'],
    ['Naren K', 'TurfXL Velachery', 'Locked court', 'medium', 1600, daysAgo(6), 'resolved'],
    ['Priya V', 'GreenField Gachibowli', 'Double booking', 'high', 2100, daysAgo(7), 'resolved'],
  ];
  const DAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const disputeCodeAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const disputeCode = (n) => {
    let v = 0x7d2000 + n * 977, out = '';
    for (let k = 0; k < 6; k++) { out = disputeCodeAlphabet[v % 32] + out; v = Math.floor(v / 32); }
    return out;
  };
  const disputes = dispRaw.map((d, i) => {
    const [custName, venueName, reason, urgency, amount, openedAt, status] = d;
    const cust = customers.find((c) => c.name === custName);
    const venue = venueByName[venueName];
    const slotAt = at(openedAt - DAY, [18, 9, 19, 16, 11, 20, 18, 21, 7][i]);
    const booking = mkBooking(venue, cust, slotAt, status === 'resolved' && i !== 8 ? 'refunded' : 'completed', amount);
    const sd = new Date(slotAt);
    const court = booking.courtName;
    const slotLabel = `${court} · ${DAYS_S[sd.getDay()]} ${sd.getDate()} ${MONS[sd.getMonth()]} ${String(sd.getHours()).padStart(2, '0')}:00`;
    const resolvedTypes = ['FULL_REFUND', 'FULL_REFUND', 'REJECT_CLAIM'];
    const resType = resolvedTypes[i % 3];
    return {
      disputeId: `SP-${disputeCode(i)}`,
      bookingId: booking.bookingId,
      customerId: cust.userId,
      customerName: cust.name,
      ownerId: venue.ownerId,
      ownerName: venue.ownerName,
      venueId: venue.venueId,
      venueName,
      courtName: court,
      sport: booking.sport,
      slotLabel,
      reason, urgency, amount, status,
      escrowHeld: status !== 'resolved',
      resolution: status === 'resolved'
        ? {
            type: resType,
            label: resType === 'REJECT_CLAIM' ? 'Claim rejected · favour owner' : `Full refund ₹${amount.toLocaleString('en-IN')} → customer`,
            note: null, byAdminId: 'ADM-10', at: openedAt + 2 * DAY,
            favour: resType === 'REJECT_CLAIM' ? 'owner' : 'customer',
          }
        : null,
      thread: [
        { senderRole: 'customer', senderName: cust.name, message: `${reason}. I want a full refund — this is unacceptable.`, at: openedAt },
        { senderRole: 'owner', senderName: `${venue.ownerName} (Owner)`, message: 'There was a power cut in the area, beyond our control. Willing to offer a reschedule.', at: openedAt + 2 * HOUR },
        { senderRole: 'admin', senderName: 'spotlyte Support', message: `Escrow hold placed on ₹${amount.toLocaleString('en-IN')}. Reviewing evidence from both parties.`, at: openedAt + 3 * HOUR },
      ],
      openedAt,
      createdAt: openedAt,
    };
  });
  await db.collection('disputes').insertMany(disputes);

  // ── payouts (12 — 2 queued · 1 processing · 8 settled · 1 failed) ──
  const verified = owners.filter((o) => o.kyc === 'verified'); // 7 owners
  const payoutBase = [410000, 95000, 51000, 84000, 110000, 38000, 29000];
  const completedPool = bookings.filter((b) => b.status === 'completed' && b.paid);
  let poolIdx = 0;
  const payouts = Array.from({ length: 12 }).map((_, i) => {
    const o = verified[i % 7];
    const status = i < 2 ? 'queued' : i < 3 ? 'processing' : i < 11 ? 'settled' : 'failed';
    const gross = Math.round((payoutBase[i % 7] - i * 1200) * 1.18);
    const m = payoutMath(gross, o.commissionTier.pct);
    const weeksBack = i < 3 ? 1 : i - 1; // recent for queued/processing, older for settled
    const to = daysAgo(weeksBack * 7);
    const from = to - 6 * DAY;
    const ownVenues = liveVenues.filter((v) => v.ownerId === o.ownerId);
    const venue = ownVenues[i % Math.max(1, ownVenues.length)] || null;
    // attach 3–6 real completed bookings for the "what's inside" table
    const take = 3 + (i % 4);
    const ids = [];
    for (let k = 0; k < take && poolIdx < completedPool.length - 10; k++) {
      const b = completedPool[poolIdx++];
      if (!b.payoutId) { b.payoutId = `PO-${3072 + i}`; ids.push(b.bookingId); }
    }
    return {
      payoutId: `PO-${3072 + i}`,
      ownerId: o.ownerId,
      ownerName: o.name,
      biz: o.biz,
      venueId: venue?.venueId || null,
      venueName: venue?.name || o.biz,
      periodFrom: from,
      periodTo: to,
      periodLabel: periodLabel(from, to),
      bookingIds: ids,
      txns: 12 + i * 3,
      gross, feePct: o.commissionTier.pct, fee: m.fee, tds: m.tds, amount: m.net,
      status,
      bankMasked: maskBank(o.bank.bankName, o.bank.accountNoMasked),
      ifsc: o.bank.ifsc,
      settlesLabel: status === 'settled' ? dayShort(to + 2 * DAY) : dayShort(nextMonday(now)),
      utr: status === 'settled' ? `${o.bank.bankName.split(' ')[0].toUpperCase().slice(0, 4)}N${52380000 + i * 137}` : null,
      settledAt: status === 'settled' ? to + 2 * DAY : null,
      timeline: [{ step: 'created', at: from }],
      createdAt: to,
    };
  });
  await db.collection('payouts').insertMany(payouts);
  // bookings carry their payoutId (embedded above) — insert after linking
  await db.collection('bookings').insertMany(bookings);

  // ── invoices — 14 owner (2 due · 1 overdue · 11 paid) + a receipt per paid booking ──
  const months = [0, 1, 2, 3].map((k) => {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth() - k, 1);
  });
  const monthLabel = (d) => `${MONS[d.getMonth()]} ${d.getFullYear()}`;
  const ownerInvoices = Array.from({ length: 14 }).map((_, i) => {
    const o = verified[i % 7];
    const type = i % 3 === 0 ? 'Subscription' : 'Commission';
    const amount = type === 'Subscription' ? (o.plan.priceMo || 2499) : [18400, 9500, 7200][i % 3];
    const status = i < 2 ? 'due' : i < 3 ? 'overdue' : 'paid';
    const m = months[i % 4];
    const issuedAt = new Date(m.getFullYear(), m.getMonth(), 1 + (i % 9)).getTime();
    return {
      invoiceId: `INV-O-${1040 + i}`,
      audience: 'owner',
      partyId: o.ownerId,
      partyName: o.biz,
      subLabel: o.name,
      type,
      period: monthLabel(m),
      amount, tax: gst(amount), total: amount + gst(amount),
      status,
      issuedAt,
      dueAt: issuedAt + 14 * DAY,
      paidAt: status === 'paid' ? issuedAt + 6 * DAY : null,
      createdAt: issuedAt,
    };
  });
  // Rule (Section 8.12): a user tax invoice is auto-created on every paid booking.
  const paidBookings = bookings.filter((b) => b.paid);
  const userInvoices = paidBookings.map((b, i) => {
    const m = new Date(b.createdAt);
    return {
      invoiceId: `INV-U-${8040 + i}`,
      audience: 'user',
      partyId: b.customerId,
      partyName: b.customerName,
      subLabel: `Booking #${b.bookingId}`,
      type: 'Booking receipt',
      period: monthLabel(m),
      amount: b.amount, tax: gst(b.amount), total: b.amount + gst(b.amount),
      status: 'paid',
      bookingId: b.bookingId,
      issuedAt: b.createdAt,
      dueAt: b.createdAt,
      paidAt: b.createdAt,
      createdAt: b.createdAt,
    };
  });
  await db.collection('invoices').insertMany([...ownerInvoices, ...userInvoices]);

  // ── reviews (10 — incl. auto-flagged spam) ───────────────
  const reviewRaw = [
    ['Great turf, lights could be brighter in the evening but overall solid.', 5, 'visible'],
    ['Booking got cancelled last minute and no refund. Avoid this place!!', 1, 'flagged', 3],
    ['Best pickleball courts in the city. Staff super friendly.', 5, 'visible'],
    ['Worst experience. The owner is a 9876543210 scammer call me', 2, 'pending'],
    ['Decent for the price. Parking is a pain on weekends.', 3, 'visible'],
    ['Booked cricket net, was clean and well maintained.', 4, 'visible'],
    ['fake fake fake do not book spam spam http://bit.ly/x', 1, 'flagged'],
    ['Amazing floodlights and the new flooring is excellent.', 5, 'pending'],
    ['Court was double booked, had to wait 30 mins.', 2, 'visible'],
    ['Loved it. Will come back with the whole team.', 5, 'visible'],
  ];
  const reviewAges = [hoursAgo(2), hoursAgo(5), daysAgo(1), daysAgo(2)];
  const reviews = reviewRaw.map((r, i) => {
    const [text, rating, baseStatus, userFlags] = r;
    const auto = checkReview(text, DEFAULT_RULES); // rules applied on ingestion
    const flagged = auto.flagged || baseStatus === 'flagged';
    return {
      reviewId: `REV-${5510 + i}`,
      customerId: customers[i % 15].userId,
      customerName: customers[i % 15].name,
      venueId: venues[i % 16].venueId,
      venueName: venues[i % 16].name,
      text, rating,
      status: flagged ? 'flagged' : baseStatus,
      flags: flagged ? (userFlags || auto.flags || 2) : 0,
      autoflagReasons: auto.reasons,
      createdAt: reviewAges[i % 4],
    };
  });
  await db.collection('reviews').insertMany(reviews);

  // ── promos (8 — exact codes) ─────────────────────────────
  const promoRaw = [
    ['SPOTLYTE100', 'Flat ₹100 off', 'flat', 100, 'active', 1840, 2500, 'All venues', 52],
    ['FIRST50', '50% off first booking', 'pct', 50, 'active', 920, 2000, 'New users', 235],
    ['WEEKDAY20', '20% off weekday slots', 'pct', 20, 'active', 430, 1000, 'Weekdays only', 57],
    ['MONSOON', '₹150 off football', 'flat', 150, 'scheduled', 0, 1500, 'Football', 57],
    ['DIWALI500', '₹500 off team bookings', 'flat', 500, 'paused', 210, 500, 'Min ₹3000', -9],
    ['CRICKET10', '10% off cricket nets', 'pct', 10, 'active', 156, 800, 'Cricket', 93],
    ['WELCOME', 'Flat ₹75 off', 'flat', 75, 'expired', 2000, 2000, 'New users', -19],
    ['REFER25', '25% off via referral', 'pct', 25, 'active', 88, 1000, 'Referrals', 134],
  ];
  const promos = promoRaw.map((p, i) => {
    const [code, label, kind, value, status, used, cap, scope, expiresDays] = p;
    return {
      promoId: `PRM-${610 + i}`,
      code, label, kind, value, scope, used, cap,
      expires: new Date(now + expiresDays * DAY).toISOString().slice(0, 10),
      startAt: status === 'scheduled' ? now + 12 * DAY : null,
      status: status === 'paused' ? 'paused' : 'active', // active/expired/scheduled derived at read
      assistedRevenue: used * (kind === 'flat' ? value * 4 : 180),
      createdAt: daysAgo(60 - i * 5),
    };
  });
  await db.collection('promos').insertMany(promos);

  // ── ad placements (6 — 3 active · 1 review · 1 scheduled · 1 ended) ──
  const adRaw = [
    ['Maidan HSR', 'Home spotlight', 'active', -18, 12, 25000, 18400, 142],
    ['TurfXL Velachery', 'Search top', 'active', -24, 6, 12000, 9100, 88],
    ['PlayCircle Banjara', 'Home spotlight', 'active', -16, 15, 25000, 6200, 54],
    ['GreenField Gachibowli', 'City banner', 'review', 5, 36, 15000, 0, 0],
    ['SmashPoint Jayanagar', 'Search top', 'scheduled', 15, 46, 12000, 0, 0],
    ['Maidan Koregaon', 'Home spotlight', 'ended', -65, -35, 25000, 21000, 176],
  ];
  const ads = adRaw.map((a, i) => {
    const [venueName, slot, status, startDays, endDays, budget, spent, clicks] = a;
    const v = venueByName[venueName];
    return {
      adId: `ADV-${440 + i}`,
      venueId: v.venueId,
      ownerId: v.ownerId,
      venueName,
      ownerName: v.ownerName,
      slot, city: v.city,
      start: now + startDays * DAY,
      end: now + endDays * DAY,
      budget, spent, clicks,
      impressions: clicks * (40 + i * 5),
      status,
      createdAt: now + Math.min(startDays, 0) * DAY - 2 * DAY,
    };
  });
  await db.collection('adPlacements').insertMany(ads);

  // ── audit log (~14 entries matching Section 8.16) ────────
  const actors = ['Priya Menon (Admin)', 'Rajesh K (Ops)', 'System', 'Anish T (Finance)', 'Priya Menon (Admin)', 'Ops Bot'];
  const auditRaw = [
    ['approved KYC', 'Owner · Anita Reddy', 'approval', '#OWN-2041'],
    ['rejected venue', 'Venue · SmashPoint HSR', 'venue', '#VEN-7115'],
    ['released payout', '₹4.1L → spotlyte Sports LLP', 'payout', '#PO-3075'],
    ['featured venue', 'Venue · Maidan HSR', 'feature', '#VEN-7100'],
    ['resolved dispute', 'Refund ₹1,400 → Rohit S', 'dispute', `#${disputes[6].disputeId}`],
    ['suspended owner', 'Owner · Arjun Das', 'account', '#OWN-2049'],
    ['edited promo', 'PRM · DIWALI500 paused', 'promo', '#PRM-614'],
    ['hidden review', 'Review flagged ×3', 'review', '#REV-5516'],
    ['approved venue', 'Venue · GreenField Kukatpally', 'venue', '#VEN-7114'],
    ['issued invoice', '₹5,899 → Maidan Group', 'invoice', '#INV-O-1045'],
    ['login', 'Admin console access', 'auth', null],
    ['exported data', 'Bookings · 30D CSV', 'export', null],
    ['updated commission', 'Platform fee 18% → 16% (Pune)', 'config', '#CFG-22'],
    ['banned user', 'User · Sanjay G', 'account', '#USR-33019'],
  ];
  const audit = auditRaw.map((a, i) => ({
    logId: `LOG-${90120 + (auditRaw.length - 1 - i)}`, // newest first ⇒ highest id first
    actor: actors[i % 6],
    actorAdminId: ['ADM-10', 'ADM-11', null, 'ADM-12', 'ADM-10', null][i % 6],
    action: a[0],
    target: a[1],
    type: a[2],
    ref: a[3],
    ip: `49.37.${20 + i}.${100 + i * 3}`,
    createdAt: now - i * 7 * HOUR - (i * 13 % 47) * MIN,
  }));
  await db.collection('auditLogs').insertMany(audit);

  // ── settings + counters ──────────────────────────────────
  await db.collection('settings').updateOne(
    { _id: 'autoflag' },
    { $set: { rules: { phoneNumbers: true, urls: true, spamWords: true, profanity: true } } },
    { upsert: true }
  );
  const counters = [
    ['owner', owners.length], ['venue', venues.length], ['booking', bseq - 48210], ['user', customers.length],
    ['review', reviews.length], ['payout', payouts.length], ['invoiceOwner', ownerInvoices.length],
    ['invoiceUser', userInvoices.length], ['promo', promos.length], ['ad', ads.length],
    ['dispute', disputes.length], ['log', audit.length], ['admin', admins.length],
  ];
  for (const [name, seq] of counters) {
    await db.collection('counters').updateOne({ _id: name }, { $set: { seq } }, { upsert: true });
  }

  console.log(`Seeded:
  ${admins.length} admins · ${owners.length} owners · ${venues.length} venues · ${customers.length} customers
  ${bookings.length} bookings · ${reviews.length} reviews · ${payouts.length} payouts
  ${ownerInvoices.length} owner invoices + ${userInvoices.length} user receipts
  ${promos.length} promos · ${ads.length} placements · ${disputes.length} disputes · ${audit.length} audit entries

  Login → priya@spotlyte.in / admin123`);
  await closeDb();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
