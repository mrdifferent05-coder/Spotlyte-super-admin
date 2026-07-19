// run-acceptance.mjs — offline end-to-end acceptance battery (Section 13).
// Run: npm run test:acceptance (no MongoDB required — uses the mingo-backed
// driver fake in fake-mongo.mjs against the REAL seed, schema and resolvers).
// Injects an in-memory driver fake, runs the REAL seed, then executes the
// REAL GraphQL schema + resolvers against it, walking Section 13's checklist.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createFakeDb } from './fake-mongo.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

const API = join(__dir, '..', 'src');
process.env.JWT_SECRET = 'test-secret';

const { __setTestDb } = await import(`${API}/db.js`);
const fake = createFakeDb();
__setTestDb(fake);

// Run the real seed against the fake db (seed's main() runs on import).
await import(`${API}/seed/seed.js`);
await new Promise((r) => setTimeout(r, 300)); // let seed's async main settle

import { createRequire } from 'module';
const requireFromApi = createRequire(join(__dir, '..', 'package.json'));
const { ApolloServer } = requireFromApi('@apollo/server');
const { typeDefs } = await import(`${API}/graphql/index.js`);
const { resolvers } = await import(`${API}/resolvers/index.js`);

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

const admin = await fake.collection('admins').findOne({ email: 'priya@spotlyte.in' });
const baseCtx = () => ({
  db: fake,
  admin,
  ip: '49.37.21.103',
  res: { cookie() {}, clearCookie() {} },
});

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${extra ? ' — ' + JSON.stringify(extra).slice(0, 300) : ''}`); }
}

async function gql(query, variables = {}, ctx = baseCtx()) {
  const res = await server.executeOperation({ query, variables }, { contextValue: ctx });
  const body = res.body.kind === 'single' ? res.body.singleResult : null;
  if (body?.errors) return { errors: body.errors, data: body.data };
  return { data: body?.data };
}

// ── auth ─────────────────────────────────────────────────────
console.log('\n■ Auth');
{
  const bad = await gql(`mutation{adminLoginV2(email:"priya@spotlyte.in",password:"wrong"){success message}}`, {}, { ...baseCtx(), admin: null });
  check('login rejects wrong password', bad.data?.adminLoginV2?.success === false, bad);
  const good = await gql(`mutation{adminLoginV2(email:"priya@spotlyte.in",password:"admin123"){success token admin{name role}}}`, {}, { ...baseCtx(), admin: null });
  check('login succeeds + returns token', good.data?.adminLoginV2?.success === true && !!good.data.adminLoginV2.token, good);
  const unauth = await gql(`query{getAdminNavCounts{pendingOwners}}`, {}, { ...baseCtx(), admin: null });
  check('guarded query throws UNAUTHENTICATED without admin', unauth.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED', unauth.errors);
  const loginAudit = await fake.collection('auditLogs').findOne({ action: 'login', actorAdminId: 'ADM-10' });
  check('login writes audit row', !!loginAudit);
}

// ── nav counts + overview ────────────────────────────────────
console.log('\n■ Nav counts & overview');
let navBefore;
{
  const r = await gql(`query{getAdminNavCounts{pendingOwners pendingVenues flaggedReviews queuedPayouts overdueInvoices openDisputes}}`);
  navBefore = r.data?.getAdminNavCounts;
  check('nav counts: 5 pending owners (review+docs)', navBefore?.pendingOwners === 5, navBefore);
  check('nav counts: 4 pending venues', navBefore?.pendingVenues === 4, navBefore);
  check('nav counts: flagged reviews = 3', navBefore?.flaggedReviews === 3, navBefore);
  check('nav counts: queued payouts = 2', navBefore?.queuedPayouts === 2, navBefore);
  check('nav counts: overdue invoices = 1', navBefore?.overdueInvoices === 1, navBefore);
  check('nav counts: open disputes = 4', navBefore?.openDisputes === 4, navBefore);

  const o = await gql(`query{getAdminOverviewStat(range:"30D"){dateLine heroKpis{label value unit meta spark} miniKpis{label value route} approvalQueue{kind name status refId} sportMix{sport percent revenue colorVar} openDisputes{disputeId urgency} topVenues{venueId venueName revenue30d featured}}}`);
  const ov = o.data?.getAdminOverviewStat;
  check('overview dateLine has LIVE VENUES + CITIES', /LIVE VENUES · \d+ CITIES/.test(ov?.dateLine || ''), ov?.dateLine);
  check('overview: 4 hero KPIs with GMV in Cr/L', ov?.heroKpis?.length === 4 && /₹/.test(ov.heroKpis[0].value), ov?.heroKpis?.[0]);
  check('overview: approval queue ≤6 mixing kinds', ov?.approvalQueue?.length === 6 && ov.approvalQueue.some((q) => q.kind === 'Venue') && ov.approvalQueue.some((q) => q.kind === 'Owner KYC'), ov?.approvalQueue);
  check('overview: sport mix sums to ~100%', Math.abs(ov?.sportMix?.reduce((s, x) => s + x.percent, 0) - 100) <= 6, ov?.sportMix);
  check('overview: top venue is Maidan HSR ₹5.1L', ov?.topVenues?.[0]?.venueName === 'Maidan HSR' && ov.topVenues[0].revenue30d === 510000, ov?.topVenues?.[0]);
  const today = await gql(`query{getAdminOverviewStat(range:"Today"){heroKpis{label value}}}`);
  check('overview re-queries per range (Today ≠ 30D GMV)', today.data?.getAdminOverviewStat?.heroKpis?.[0]?.value !== ov?.heroKpis?.[0]?.value);
}

// ── global search ────────────────────────────────────────────
console.log('\n■ Global search');
{
  const r = await gql(`query{adminGlobalSearch(q:"maidan"){kind id title badge}}`);
  check('⌘K search finds Maidan venues + owner group', r.data?.adminGlobalSearch?.some((h) => h.kind === 'venue' && /Maidan/.test(h.title)), r.data?.adminGlobalSearch);
  const r2 = await gql(`query{adminGlobalSearch(q:"aswin"){kind title}}`);
  check('⌘K search finds users', r2.data?.adminGlobalSearch?.some((h) => h.kind === 'user' && h.title === 'Aswin John'), r2.data);
}

// ── owner KYC end-to-end (checklist item 2) ──────────────────
console.log('\n■ Owner KYC end-to-end (Farhan Qureshi)');
{
  const list = await gql(`query{getAdminOwnerList(tab:"review"){counts{all review docs verified suspended} owners{ownerId biz kyc} stats total}}`);
  const L = list.data?.getAdminOwnerList;
  check('owner list counts: 3 review · 2 docs · 7 verified · 2 suspended', L?.counts?.review === 3 && L?.counts?.docs === 2 && L?.counts?.verified === 7 && L?.counts?.suspended === 2, L?.counts);
  const farhan = L?.owners?.find((o) => o.biz === 'SportHaus');
  check('Farhan Qureshi (SportHaus) in review tab', !!farhan, L?.owners);

  const det = await gql(`query($id:String!){getAdminOwnerDetail(ownerId:$id){pipelineStep documents{name status} owner{kyc} venues{venueName} legal bank plan activity{action}}}`, { id: farhan.ownerId });
  check('detail: pipeline step 2 while in review', det.data?.getAdminOwnerDetail?.pipelineStep === 2, det.data?.getAdminOwnerDetail);
  check('detail: 6 doc tiles + legal PAN/GSTIN', det.data?.getAdminOwnerDetail?.documents?.length === 6 && !!det.data.getAdminOwnerDetail.legal.pan, det.data?.getAdminOwnerDetail?.legal);
  check('detail: SportHaus Powai listed under venues', det.data?.getAdminOwnerDetail?.venues?.some((v) => v.venueName === 'SportHaus Powai'));

  const reqDocs = await gql(`mutation($id:String!){adminRequestOwnerDocs(ownerId:$id,docs:["Bank account proof (cancelled cheque)","Venue ownership / lease deed"],note:"Latest renewal please"){success message}}`, { id: farhan.ownerId });
  check('request docs → toast copy', /Requested 2 documents · owner notified/.test(reqDocs.data?.adminRequestOwnerDocs?.message || ''), reqDocs);
  const afterDocs = await gql(`query($id:String!){getAdminOwnerDetail(ownerId:$id){owner{kyc} pipelineStep}}`, { id: farhan.ownerId });
  check('kyc → docs, pipeline moves to 1', afterDocs.data?.getAdminOwnerDetail?.owner?.kyc === 'docs' && afterDocs.data.getAdminOwnerDetail.pipelineStep === 1);

  const approve = await gql(`mutation($id:String!){adminApproveOwnerKyc(ownerId:$id,commissionTier:"Growth — 16%"){success message}}`, { id: farhan.ownerId });
  check('approve KYC toast: "KYC approved · SportHaus is live"', approve.data?.adminApproveOwnerKyc?.message === 'KYC approved · SportHaus is live', approve);
  const ownerDoc = await fake.collection('owners').findOne({ ownerId: farhan.ownerId });
  check('tier stored: Growth 16%', ownerDoc?.commissionTier?.pct === 16 && ownerDoc.kyc === 'verified', ownerDoc?.commissionTier);
  const nav2 = await gql(`query{getAdminNavCounts{pendingOwners}}`);
  check('nav badge decrements after approval', nav2.data?.getAdminNavCounts?.pendingOwners === navBefore.pendingOwners - 1, nav2.data);
  const audits = await fake.collection('auditLogs').find({ ref: `#${farhan.ownerId}` }).toArray();
  check('audit rows written (request docs + approve + tier)', audits.filter((a) => ['requested documents', 'approved KYC', 'set commission tier'].includes(a.action)).length >= 3, audits.map((a) => a.action));

  // reject path on another owner (Karan Mehta)
  const karan = (await fake.collection('owners').findOne({ biz: 'Acefield Arena' }));
  const rej = await gql(`mutation($id:String!){adminRejectOwnerKyc(ownerId:$id,reason:"Document mismatch / illegible",note:"PAN scan unreadable"){success message}}`, { id: karan.ownerId });
  check('reject path works with reason', rej.data?.adminRejectOwnerKyc?.message === 'KYC rejected · owner notified', rej);
  const karanAfter = await fake.collection('owners').findOne({ ownerId: karan.ownerId });
  check('rejection stored with reason + note', karanAfter.kyc === 'rejected' && karanAfter.rejection?.reason === 'Document mismatch / illegible');

  // suspend / reinstate
  const sus = await gql(`mutation{adminSuspendOwner(ownerId:"OWN-2040"){message}}`);
  check('suspend owner', sus.data?.adminSuspendOwner?.message === 'Owner suspended');
  const rei = await gql(`mutation{adminReinstateOwner(ownerId:"OWN-2040"){message}}`);
  check('reinstate owner', rei.data?.adminReinstateOwner?.message === 'Owner reinstated');

  // invite
  const inv = await gql(`mutation{adminInviteOwner(input:{name:"Ravi Kumar",biz:"Northside Turf",email:"ravi@northside.in",city:"Delhi"}){success message refId}}`);
  check('invite owner creates review-state owner with new id', inv.data?.adminInviteOwner?.refId === 'OWN-2054', inv.data);
}

// ── venues (checklist item 3) ────────────────────────────────
console.log('\n■ Venues approve / reject / feature / pause');
{
  const page = await gql(`query{getAdminVenuePage(tab:"pending"){counts stats venues{venueId venueName venueStatus submittedAgo}}}`);
  const P = page.data?.getAdminVenuePage;
  check('venue page: pending tab holds 4 + submittedAgo strings', P?.venues?.length === 4 && P.venues.every((v) => !!v.submittedAgo), P?.venues);
  check('venue stats: 10 live · court totals present', P?.counts?.live === 10 && P?.stats?.courtsTotal > 30, P?.stats);

  const powai = P.venues.find((v) => v.venueName === 'SportHaus Powai');
  const det = await gql(`query($id:String!){getAdminVenueDetail(venueId:$id){venue{venueStatus} photos games courts{courtName sport surface slots{time state}} amenities listing pricing payoutSummary}}`, { id: powai.venueId });
  const D = det.data?.getAdminVenueDetail;
  check('venue detail: 8 photos · games · courts with 8 slot cells', D?.photos?.length === 8 && D.courts[0]?.slots?.length === 8, { photos: D?.photos?.length, slots: D?.courts?.[0]?.slots?.length });
  check('venue detail: surface mapping (Basketball → Acrylic hard court etc.)', D?.courts?.every((c) => !!c.surface), D?.courts?.map((c) => [c.sport, c.surface]));
  check('venue pricing: 900/1400/1800', D?.pricing?.offPeak === 900 && D.pricing.peak === 1400 && D.pricing.weekend === 1800, D?.pricing);

  const app = await gql(`mutation($id:String!){adminApproveVenueV2(venueId:$id){message}}`, { id: powai.venueId });
  check('approve venue toast', app.data?.adminApproveVenueV2?.message === 'Venue approved · live on marketplace', app);
  const afterApprove = await gql(`query{getAdminVenuePage(tab:"live"){counts venues{venueName}}}`);
  check('approved venue lands in live tab (11 live)', afterApprove.data?.getAdminVenuePage?.counts?.live === 11 && afterApprove.data.getAdminVenuePage.venues.some((v) => v.venueName === 'SportHaus Powai'));

  const omr = await fake.collection('venues').findOne({ name: 'TurfXL OMR' });
  const rej = await gql(`mutation($id:String!){adminRejectVenue(venueId:$id,reason:"Photos insufficient / low quality",note:"Retake exterior shots"){message}}`, { id: omr.venueId });
  check('reject venue toast', rej.data?.adminRejectVenue?.message === 'Listing rejected · owner notified');
  const rr = await gql(`mutation($id:String!){adminReReviewVenue(venueId:$id){message}}`, { id: omr.venueId });
  check('re-review returns rejected venue to the queue', rr.data?.adminReReviewVenue?.message === 'Back in review queue' && (await fake.collection('venues').findOne({ venueId: omr.venueId }))?.status === 'review');

  // availability derives from real bookings: Maidan HSR has 2 today-bookings
  const hsr = await gql(`query{getAdminVenueDetail(venueId:"VEN-7100"){courts{slots{state}} payoutSummary bookings{bookingId} disputes{disputeId} payouts{payoutId}}}`);
  const cells = hsr.data?.getAdminVenueDetail?.courts?.flatMap((c) => c.slots.map((s) => s.state)) || [];
  check('availability grid has booked + blocked + open cells', cells.includes('booked') && cells.includes('blocked') && cells.includes('open'), { booked: cells.filter((c) => c === 'booked').length, blocked: cells.filter((c) => c === 'blocked').length });

  const feat = await gql(`mutation{adminFeatureVenue(venueId:"VEN-7102",slot:"Search top",months:2){success message}}`);
  check('feature venue creates linked placement', /featured · Search top for 2 months/.test(feat.data?.adminFeatureVenue?.message || ''), feat.data);
  const linkedAd = await fake.collection('adPlacements').findOne({ venueId: 'VEN-7102', linkedFeature: true });
  check('linked ad placement exists with budget 24000', linkedAd?.budget === 24000, linkedAd);
  const unfeat = await gql(`mutation{adminUnfeatureVenue(venueId:"VEN-7102"){message}}`);
  check('unfeature ends linked placement', unfeat.data?.adminUnfeatureVenue?.message === 'Removed from featured' && (await fake.collection('adPlacements').findOne({ venueId: 'VEN-7102', linkedFeature: true }))?.status === 'ended');

  await gql(`mutation{adminPauseVenue(venueId:"VEN-7104"){message}}`);
  const paused = await fake.collection('venues').findOne({ venueId: 'VEN-7104' });
  check('pause venue', paused?.status === 'paused');
  await gql(`mutation{adminResumeVenue(venueId:"VEN-7104"){message}}`);
  check('resume venue', (await fake.collection('venues').findOne({ venueId: 'VEN-7104' }))?.status === 'live');
}

// ── bookings + refund (checklist item 4) ─────────────────────
console.log('\n■ Booking refund 60% via slider');
{
  const page = await gql(`query{getAdminBookingPage(tab:"all"){counts stats total monthLabel bookings{bookingId status amount method}}}`);
  const B = page.data?.getAdminBookingPage;
  check('bookings page: counts + stats + monthLabel', B?.counts?.all > 50 && !!B?.monthLabel && B?.stats?.gmv30 > 0, { all: B?.counts?.all, month: B?.monthLabel });

  const target = B.bookings.find((b) => b.status === 'completed');
  const refundedBefore = B.counts.refunded;
  const det = await gql(`query($id:String!){getAdminBookingDetail(bookingId:$id){timeline{title state} breakdown txnRef}}`, { id: target.bookingId });
  check('booking detail: 4-step timeline + breakdown', det.data?.getAdminBookingDetail?.timeline?.length === 4 && det.data.getAdminBookingDetail.breakdown.fee > 0, det.data?.getAdminBookingDetail?.breakdown);

  const refund = await gql(`mutation($id:String!){adminIssueRefund(bookingId:$id,percent:60,reason:"Facility unavailable / unsafe",note:"AC failure"){success message}}`, { id: target.bookingId });
  const expected = Math.round(target.amount * 0.6);
  check(`refund 60% message carries ₹${expected}`, refund.data?.adminIssueRefund?.message?.includes(`(60%)`) && refund.data.adminIssueRefund.message.includes(expected.toLocaleString('en-IN')), refund.data);
  const after = await gql(`query{getAdminBookingPage(tab:"refunded"){counts bookings{bookingId}}}`);
  check('refunded tab picks it up', after.data?.getAdminBookingPage?.counts?.refunded === refundedBefore + 1 && after.data.getAdminBookingPage.bookings.some((b) => b.bookingId === target.bookingId));
  const det2 = await gql(`query($id:String!){getAdminBookingDetail(bookingId:$id){refund timeline{title state}}}`, { id: target.bookingId });
  check('detail shows refund record + refund timeline step', det2.data?.getAdminBookingDetail?.refund?.pct === 60 && det2.data.getAdminBookingDetail.timeline.some((t) => t.state === 'refund'));
  const auditRefund = await fake.collection('auditLogs').findOne({ action: 'issued refund', ref: `#${target.bookingId}` });
  check('refund audit written', !!auditRefund);
}

// ── payout lifecycle (checklist item 5) ──────────────────────
console.log('\n■ Payout lifecycle + money math');
{
  const before = await gql(`query{getAdminPayoutList(tab:"all"){counts stats nextRunLabel payouts{payoutId status gross fee tds amount}}}`);
  const P = before.data?.getAdminPayoutList;
  check('payout list: 12 seeded (2 queued · 1 processing · 8 settled · 1 failed)', P?.counts?.all === 12 && P.counts.queued === 2 && P.counts.processing === 1 && P.counts.settled === 8 && P.counts.failed === 1, P?.counts);
  const anyP = P.payouts[0];
  const feeOk = P.payouts.every((p) => p.amount === p.gross - p.fee - p.tds);
  check('money math gross − fee − tds = net on every row', feeOk, anyP);

  const run = await gql(`mutation{adminRunPayouts{success message}}`);
  check('Run payouts creates queued rows', /Payout run scheduled · \d+ owners/.test(run.data?.adminRunPayouts?.message || ''), run.data);
  const afterRun = await gql(`query{getAdminPayoutList(tab:"queued"){counts payouts{payoutId ownerId gross feePct: fee amount txns}}}`);
  const newQueued = afterRun.data?.getAdminPayoutList;
  check('queued count grew', newQueued?.counts?.queued > 2, newQueued?.counts);

  const fresh = newQueued.payouts.find((p) => parseInt(p.payoutId.split('-')[1]) >= 3084);
  const det = await gql(`query($id:String!){getAdminPayoutDetail(payoutId:$id){payout{gross fee tds amount status} timeline{title state} transactions{bookingId fee net}}}`, { id: fresh.payoutId });
  const pd = det.data?.getAdminPayoutDetail?.payout;
  check('fresh payout math: net = gross − fee − tds', pd && pd.amount === pd.gross - pd.fee - pd.tds, pd);
  check('detail: 5-step settlement timeline + member transactions', det.data?.getAdminPayoutDetail?.timeline?.length === 5 && det.data.getAdminPayoutDetail.transactions.length > 0);

  const app = await gql(`mutation($id:String!){adminApprovePayout(payoutId:$id){message}}`, { id: fresh.payoutId });
  check('approve → processing', app.data?.adminApprovePayout?.message === 'Approved · now processing');
  const rel = await gql(`mutation($id:String!){adminReleasePayout(payoutId:$id,utr:"AXISN12345678"){success message}}`, { id: fresh.payoutId });
  check('release with UTR AXISN12345678', rel.data?.adminReleasePayout?.message?.includes('UTR AXISN12345678'), rel.data);
  const settled = await fake.collection('payouts').findOne({ payoutId: fresh.payoutId });
  check('settled with UTR stored', settled?.status === 'settled' && settled.utr === 'AXISN12345678');

  // hold + retry path on the remaining queued payout
  const q2 = (await fake.collection('payouts').find({ status: 'queued' }).toArray())[0];
  const hold = await gql(`mutation($id:String!){adminHoldPayout(payoutId:$id){message}}`, { id: q2.payoutId });
  check('hold → "Payout put on hold" (failed)', hold.data?.adminHoldPayout?.message === 'Payout put on hold' && (await fake.collection('payouts').findOne({ payoutId: q2.payoutId }))?.status === 'failed');
  const retry = await gql(`mutation($id:String!){adminRetryPayout(payoutId:$id){message}}`, { id: q2.payoutId });
  check('retry → processing', retry.data?.adminRetryPayout?.message === 'Retrying transfer' && (await fake.collection('payouts').findOne({ payoutId: q2.payoutId }))?.status === 'processing');
}

// ── disputes (checklist item 6) ──────────────────────────────
console.log('\n■ Dispute: investigate → message → resolve PARTIAL_50');
{
  const page = await gql(`query{getAdminDisputePage(tab:"open"){counts stats disputes{disputeId customerName amount bookingId urgency}}}`);
  const D = page.data?.getAdminDisputePage;
  check('dispute page: open tab + at-risk sum', D?.disputes?.length >= 3 && D?.stats?.atRisk > 5000, D?.stats);
  const target = D.disputes[0];

  const inv = await gql(`mutation($id:String!){adminMarkDisputeInvestigating(disputeId:$id){message}}`, { id: target.disputeId });
  check('investigate toast "Marked investigating"', inv.data?.adminMarkDisputeInvestigating?.message === 'Marked investigating');

  const msg = await gql(`mutation($id:String!){adminAddDisputeMessage(disputeId:$id,message:"Please attach the venue CCTV clip."){message}}`, { id: target.disputeId });
  check('support message appended', msg.data?.adminAddDisputeMessage?.message === 'Message sent to both parties');
  const det = await gql(`query($id:String!){getAdminDisputeDetailV2(disputeId:$id){thread{senderRole senderName message} escrowHeld escrowAmount timeline{title}}}`, { id: target.disputeId });
  const T = det.data?.getAdminDisputeDetailV2;
  check('thread has customer + owner + 2 admin messages', T?.thread?.length === 4 && T.thread[3].senderName === 'spotlyte Support', T?.thread?.map((t) => t.senderRole));
  check('escrow held before resolution', T?.escrowHeld === true && T.escrowAmount === target.amount);

  const res = await gql(`mutation($id:String!){adminResolveDisputeV2(disputeId:$id,resolution:"PARTIAL_50",note:"Split liability"){message}}`, { id: target.disputeId });
  check('resolve toast carries partial-refund label', /Dispute resolved · Partial refund/.test(res.data?.adminResolveDisputeV2?.message || ''), res.data);
  const efter = await gql(`query($id:String!){getAdminDisputeDetailV2(disputeId:$id){escrowHeld resolution dispute{status}}}`, { id: target.disputeId });
  check('escrow cleared + status resolved', efter.data?.getAdminDisputeDetailV2?.escrowHeld === false && efter.data.getAdminDisputeDetailV2.dispute.status === 'resolved');
  const linkedBooking = await fake.collection('bookings').findOne({ bookingId: target.bookingId });
  check('linked booking got 50% refund record', linkedBooking?.status === 'refunded' && linkedBooking.refund?.pct === 50 && linkedBooking.refund.amount === Math.round(target.amount / 2), linkedBooking?.refund);
  const nav3 = await gql(`query{getAdminNavCounts{openDisputes}}`);
  check('open disputes badge decremented', nav3.data?.getAdminNavCounts?.openDisputes < navBefore.openDisputes);
}

// ── reviews (checklist item 7) ───────────────────────────────
console.log('\n■ Review moderation + auto-flag');
{
  const list = await gql(`query{getAdminReviewList(tab:"flagged"){counts stats reviews{reviewId user venue text flags status}}}`);
  const R = list.data?.getAdminReviewList;
  check('flagged tab: 3 (incl. auto-flagged phone + URL spam)', R?.counts?.flagged === 3, R?.counts);
  const phoneSpam = R.reviews.find((r) => /9876543210/.test(r.text));
  check('review with phone number auto-flagged on ingestion', !!phoneSpam && phoneSpam.flags > 0, phoneSpam);

  const hide = await gql(`mutation($id:String!){adminModerateReview(reviewId:$id,action:"hide"){message}}`, { id: phoneSpam.reviewId });
  check('hide persists', hide.data?.adminModerateReview?.message === 'Review hidden' && (await fake.collection('reviews').findOne({ reviewId: phoneSpam.reviewId }))?.status === 'hidden');
  const approveTarget = R.reviews.find((r) => r.reviewId !== phoneSpam.reviewId);
  await gql(`mutation($id:String!){adminModerateReview(reviewId:$id,action:"approve"){message}}`, { id: approveTarget.reviewId });
  check('approve → visible', (await fake.collection('reviews').findOne({ reviewId: approveTarget.reviewId }))?.status === 'visible');
  const del = await gql(`mutation($id:String!){adminModerateReview(reviewId:$id,action:"delete"){message}}`, { id: approveTarget.reviewId });
  check('delete is soft (status deleted, doc kept)', del.data?.adminModerateReview?.message === 'Review deleted' && (await fake.collection('reviews').findOne({ reviewId: approveTarget.reviewId }))?.status === 'deleted');

  const rules = await gql(`query{getAdminAutoflagRules}`);
  check('autoflag rules readable', rules.data?.getAdminAutoflagRules?.phoneNumbers === true);
  const setRules = await gql(`mutation{adminSetAutoflagRules(rules:{phoneNumbers:true,urls:false,spamWords:true,profanity:true}){message}}`);
  check('autoflag rules persist', setRules.data?.adminSetAutoflagRules?.message === 'Auto-flag rules saved' && (await fake.collection('settings').findOne({ _id: 'autoflag' }))?.rules?.urls === false);
}

// ── users ────────────────────────────────────────────────────
console.log('\n■ Users ban / reinstate');
{
  const list = await gql(`query{getAdminUserList(tab:"all"){counts stats users{userId name status spend}}}`);
  const U = list.data?.getAdminUserList;
  check('user list: 15 + Ajith flagged + Sanjay banned', U?.counts?.all >= 15 && U.counts.flagged === 1 && U.counts.banned === 1, U?.counts);
  const ajith = U.users.find((u) => u.name === 'Ajith P');
  const det = await gql(`query($id:String!){getAdminUserDetail(userId:$id){user{status} activityStats bookings{bookingId} spark}}`, { id: ajith.userId });
  check('user detail: activity stats + booking history + spark', det.data?.getAdminUserDetail?.activityStats?.bookings > 0 && det.data.getAdminUserDetail.spark.length === 14, det.data?.getAdminUserDetail?.activityStats);
  const ban = await gql(`mutation($id:String!){adminBanUser(userId:$id){message}}`, { id: ajith.userId });
  check('ban toast "User banned"', ban.data?.adminBanUser?.message === 'User banned');
  const rei = await gql(`mutation($id:String!){adminReinstateUser(userId:$id){message}}`, { id: ajith.userId });
  check('reinstate toast "User reinstated"', rei.data?.adminReinstateUser?.message === 'User reinstated');
}

// ── invoices ─────────────────────────────────────────────────
console.log('\n■ Invoices (GST)');
{
  const own = await gql(`query{getAdminInvoiceList(audience:"owner",tab:"all"){stats counts invoices{invoiceId total amount tax status type}}}`);
  const O = own.data?.getAdminInvoiceList;
  check('owner invoices: 14 (2 due · 1 overdue · 11 paid)', O?.counts?.all === 14 && O.counts.due === 2 && O.counts.overdue === 1, O?.counts);
  check('GST rule: total = amount + round(18%)', O?.invoices?.every((i) => i.total === i.amount + Math.round(i.amount * 0.18)));
  const usr = await gql(`query{getAdminInvoiceList(audience:"user",tab:"all"){counts stats}}`);
  check('user receipts auto-created for every paid booking', usr.data?.getAdminInvoiceList?.counts?.all > 50 && usr.data.getAdminInvoiceList.stats.autoIssued === 100, usr.data?.getAdminInvoiceList?.counts);

  const created = await gql(`mutation{adminCreateInvoice(input:{audience:"owner",partyId:"OWN-2044",type:"Commission",period:"Jul 2026",amount:12000}){success message refId}}`);
  check('manual invoice created due with GST', created.data?.adminCreateInvoice?.success && created.data.adminCreateInvoice.message.includes('14,160'), created.data);
  const doc = await gql(`query($id:String!){getAdminInvoiceDoc(invoiceId:$id){invoice{total} seller buyer lines}}`, { id: created.data.adminCreateInvoice.refId });
  check('invoice doc: seller GSTIN + 2 lines', doc.data?.getAdminInvoiceDoc?.seller?.gstin && doc.data.getAdminInvoiceDoc.lines.length === 2, doc.data?.getAdminInvoiceDoc?.seller);
}

// ── promos ───────────────────────────────────────────────────
console.log('\n■ Promos');
{
  const list = await gql(`query{getAdminPromoList{stats promos{code status used cap}}}`);
  const P = list.data?.getAdminPromoList;
  const byCode = Object.fromEntries(P.promos.map((p) => [p.code, p.status]));
  check('8 seeded codes with derived statuses', P?.promos?.length === 8 && byCode.MONSOON === 'scheduled' && byCode.DIWALI500 === 'paused' && byCode.WELCOME === 'expired' && byCode.SPOTLYTE100 === 'active', byCode);

  const dup = await gql(`mutation{adminCreatePromo(input:{code:"SPOTLYTE100",kind:"flat",value:100,scope:"All venues",cap:100,expires:"2026-12-31"}){success message}}`);
  check('duplicate code rejected', dup.data?.adminCreatePromo?.success === false, dup.data);
  const created = await gql(`mutation{adminCreatePromo(input:{code:"SUMMER25",kind:"pct",value:25,scope:"All venues",cap:1000,expires:"2026-12-31"}){success message}}`);
  check('SUMMER25 created · live now', created.data?.adminCreatePromo?.message === 'Promo SUMMER25 created · live now');
  const listAfter = await gql(`query{getAdminPromoList(q:"SUMMER"){promos{code status}}}`);
  check('created code appears active + searchable', listAfter.data?.getAdminPromoList?.promos?.[0]?.status === 'active');
  const promoDoc = await fake.collection('promos').findOne({ code: 'SUMMER25' });
  const paused = await gql(`mutation($id:String!){adminUpdatePromo(promoId:$id,patch:{status:"paused"}){message}}`, { id: promoDoc.promoId });
  check('pause via patch', paused.data?.adminUpdatePromo?.message === 'Promo SUMMER25 paused');
}

// ── advertising ──────────────────────────────────────────────
console.log('\n■ Advertising');
{
  const list = await gql(`query{getAdminAdList(tab:"all"){stats counts ads{adId venue slot status impressions clicks}}}`);
  const A = list.data?.getAdminAdList;
  check('ad list: seeded placements + review pending', A?.counts?.review >= 1 && A?.stats?.revenue30 > 0, A?.counts);
  const reviewAd = A.ads.find((a) => a.status === 'review');
  const app = await gql(`mutation($id:String!){adminApprovePlacement(adId:$id){message}}`, { id: reviewAd.adId });
  check('approve placement toast', app.data?.adminApprovePlacement?.message === `Placement approved · ${reviewAd.venue}`, app.data);
  const created = await gql(`mutation{adminCreatePlacement(input:{venueId:"VEN-7100",slot:"City banner",start:"2026-08-01",end:"2026-08-31",budget:15000}){message}}`);
  check('create placement → review', /sent for review/.test(created.data?.adminCreatePlacement?.message || ''));
}

// ── audit log ────────────────────────────────────────────────
console.log('\n■ Audit log');
{
  const log = await gql(`query{getAdminAuditLog(limit:100){total entries{logId actor action target type ref ip time}}}`);
  const L = log.data?.getAdminAuditLog;
  check('audit total grew well past seed (~14) from mutations', L?.total > 40, L?.total);
  check('entries newest-first with formatted times', /\d{1,2}:\d{2} (AM|PM)/.test(L?.entries?.[0]?.time || ''), L?.entries?.[0]);
  const filtered = await gql(`query{getAdminAuditLog(type:"payout",q:"released"){total entries{action}}}`);
  check('type + q filters compose', filtered.data?.getAdminAuditLog?.entries?.every((e) => e.action.includes('released')), filtered.data?.getAdminAuditLog?.entries?.slice(0, 3));
  const paged = await gql(`query{getAdminAuditLog(limit:5,offset:5){entries{logId}}}`);
  check('offset pagination works', paged.data?.getAdminAuditLog?.entries?.length === 5);
}

// ── legacy compatibility ─────────────────────────────────────
console.log('\n■ Legacy base-schema queries');
{
  const r = await gql(`query{getSuperAdmin{name} getSuperAdminOwners{fullName businessName status} getSuperAdminDisputes{disputeId status}}`);
  check('getSuperAdmin* respond from same DB', r.data?.getSuperAdmin?.name === 'Priya Menon' && r.data.getSuperAdminOwners.length >= 14, r.errors);
  const legacyApprove = await gql(`mutation{adminApproveVenue(venueId:"VEN-7113",status:"live")}`);
  check('legacy adminApproveVenue wrapper works', legacyApprove.data?.adminApproveVenue === 'ok', legacyApprove);
}

console.log(`\n━━━ ${pass} passed · ${fail} failed ━━━`);
if (failures.length) { console.log('Failed:', failures); process.exit(1); }
process.exit(0);
