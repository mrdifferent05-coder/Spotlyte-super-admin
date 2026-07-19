// typeDefs.admin.js — Super Admin Console extension (Section 9.2), plus a
// small, clearly-marked "console additions" block for the list pages that
// reuse base types (venues/bookings/disputes lists, invoice doc, autoflag).
export const typeDefsAdmin = `#graphql
scalar JSON

type AdminUser { _id: String, adminId: String, name: String!, email: String!, role: String! }
type AdminAuthResponse { success: Boolean!, token: String, admin: AdminUser, message: String }

type NavCounts { pendingOwners: Int!, pendingVenues: Int!, flaggedReviews: Int!,
  queuedPayouts: Int!, overdueInvoices: Int!, openDisputes: Int! }

type SearchHit { kind: String!, id: String!, title: String!, sub: String, badge: String }

# ── Overview ──
type HeroKpi { label: String!, value: String!, unit: String, deltaPercent: Float, meta: String, spark: [Int!], tone: String }
type MiniKpi { label: String!, value: String!, sub: String, icon: String!, route: String! }
type QueueItem { kind: String!, refId: String!, name: String!, who: String, meta: String, status: String!, submittedAgo: String, color: String, initials: String }
type SportMixRow { sport: String!, percent: Int!, revenue: Float!, colorVar: String! }
type AdminOverviewStat { dateLine: String!, heroKpis: [HeroKpi!]!, miniKpis: [MiniKpi!]!,
  approvalQueue: [QueueItem!]!, sportMix: [SportMixRow!]!,
  openDisputes: [DisputeListItem!]!, topVenues: [AdminVenueItem!]! }

# ── Owners (admin) ──
type AdminOwnerListItem { ownerId: String!, name: String!, biz: String!, city: String, kyc: String!,
  venues: Int, revenue: Float, payout: Float, rating: Float, disputes: Int,
  email: String, phone: String, joined: String, submittedAgo: String, spark: [Int!], color: String, initials: String }
type AdminOwnerCounts { all: Int!, review: Int!, docs: Int!, verified: Int!, suspended: Int! }
type AdminOwnerList { counts: AdminOwnerCounts!, stats: JSON!, owners: [AdminOwnerListItem!]!, total: Int! }
type AdminDocTile { name: String!, ref: String, status: String!, fileUrl: String }
type AdminOwnerDetail { owner: AdminOwnerListItem!, pipelineStep: Int!, documents: [AdminDocTile!]!,
  venues: [AdminVenueItem!]!, contact: JSON!, legal: JSON!, bank: JSON!, plan: JSON!,
  cancellationPolicy: JSON!, lifetime: JSON!, activity: [AuditEntry!]! }

# ── Venue detail (admin) ──
type SlotCell { time: String!, state: String! }            # booked | open | blocked
type CourtRow { courtName: String!, sport: String!, surface: String!, size: String!, slots: [SlotCell!]! }
type AdminVenueDetail { venue: AdminVenueItem!, ownerId: String, photos: [String!]!, games: [String!]!,
  courts: [CourtRow!]!, amenities: [String!]!, listing: JSON!, pricing: JSON!, spark: [Int!],
  recentBookings: [AdminBookingItem!]!, bookings: [AdminBookingItem!]!,
  disputes: [DisputeListItem!]!, payoutSummary: JSON!, payouts: [AdminPayoutRow!]!, activity: [AuditEntry!]! }

# ── Bookings (admin) ──
type BookingTimelineStep { title: String!, sub: String, state: String! }   # done|curr|cancel|refund|skip
type AdminBookingDetail { booking: AdminBookingItem!, txnRef: String, method: String, paid: Boolean,
  timeline: [BookingTimelineStep!]!, breakdown: JSON!, refund: JSON }

# ── Users (admin) ──
type AdminCustomerItem { userId: String!, name: String!, email: String, phone: String, city: String,
  joined: String, bookings: Int!, spend: Float!, lastSeen: String, status: String!, color: String, initials: String }
type AdminCustomerList { counts: JSON!, stats: JSON!, users: [AdminCustomerItem!]!, total: Int! }
type AdminCustomerDetail { user: AdminCustomerItem!, activityStats: JSON!,
  bookings: [AdminBookingItem!]!, spark: [Int!] }

# ── Reviews (admin) ──
type AdminReviewCard { reviewId: String!, user: String!, venue: String!, text: String!, rating: Int!,
  status: String!, flags: Int!, dateAgo: String, color: String, initials: String }
type AdminReviewList { counts: JSON!, stats: JSON!, reviews: [AdminReviewCard!]! }

# ── Payouts (admin) ──
type AdminPayoutRow { payoutId: String!, ownerId: String, owner: String!, biz: String!, venue: String,
  period: String!, gross: Float!, fee: Float!, tds: Float!, amount: Float!, status: String!,
  bank: String, ifsc: String, settles: String, txns: Int!, utr: String, color: String, initials: String }
type AdminPayoutList { counts: JSON!, stats: JSON!, nextRunLabel: String!, payouts: [AdminPayoutRow!]! }
type AdminPayoutDetail { payout: AdminPayoutRow!, timeline: [BookingTimelineStep!]!,
  transactions: [AdminBookingItem!]!, history: [AdminPayoutRow!]! }

# ── Invoices / Promos / Ads ──
type AdminInvoiceRow { invoiceId: String!, audience: String!, party: String!, sub: String,
  type: String!, period: String!, issued: String, due: String, amount: Float!, tax: Float!,
  total: Float!, status: String!, pdfUrl: String, color: String, initials: String }
type AdminInvoiceList { stats: JSON!, counts: JSON!, invoices: [AdminInvoiceRow!]! }
type AdminPromoRow { promoId: String!, code: String!, label: String, kind: String!, value: Float!,
  scope: String!, used: Int!, cap: Int!, expires: String!, status: String!, assistedRevenue: Float }
type AdminPromoList { stats: JSON!, promos: [AdminPromoRow!]! }
type AdminAdRow { adId: String!, venueId: String, venue: String!, owner: String!, slot: String!, city: String!,
  start: String!, end: String!, budget: Float!, spent: Float!, clicks: Int!, impressions: Int!, status: String! }
type AdminAdList { stats: JSON!, counts: JSON!, ads: [AdminAdRow!]! }

# ── Audit ──
type AuditEntry { logId: String!, actor: String!, action: String!, target: String!,
  type: String!, ref: String, ip: String, time: String!, createdAt: Float! }
type AuditList { total: Int!, entries: [AuditEntry!]! }

type ActionResult { success: Boolean!, message: String!, refId: String }

extend type Query {
  getAdminMe: AdminUser
  getAdminNavCounts: NavCounts!
  adminGlobalSearch(q: String!): [SearchHit!]!
  getAdminOverviewStat(range: String): AdminOverviewStat!
  getAdminOwnerList(tab: String, q: String, limit: Int, offset: Int): AdminOwnerList!
  getAdminOwnerDetail(ownerId: String!): AdminOwnerDetail!
  getAdminVenueDetail(venueId: String!): AdminVenueDetail!
  getAdminBookingDetail(bookingId: String!): AdminBookingDetail!
  getAdminUserList(tab: String, q: String, limit: Int, offset: Int): AdminCustomerList!
  getAdminUserDetail(userId: String!): AdminCustomerDetail!
  getAdminReviewList(tab: String): AdminReviewList!
  getAdminPayoutList(tab: String): AdminPayoutList!
  getAdminPayoutDetail(payoutId: String!): AdminPayoutDetail!
  getAdminInvoiceList(audience: String!, tab: String): AdminInvoiceList!
  getAdminPromoList(q: String): AdminPromoList!
  getAdminAdList(tab: String): AdminAdList!
  getAdminAuditLog(type: String, q: String, limit: Int, offset: Int): AuditList!
}

input CreatePromoInput { code: String!, kind: String!, value: Float!, scope: String!, cap: Int!, expires: String!, label: String }
input CreatePlacementInput { venueId: String!, slot: String!, start: String!, end: String!, budget: Float! }
input AdminInvoiceInput { audience: String!, partyId: String!, type: String!, period: String!, amount: Float! }
input InviteOwnerInput { name: String!, biz: String!, email: String!, phone: String, city: String }

extend type Mutation {
  adminLoginV2(email: String!, password: String!): AdminAuthResponse!
  adminLogout: ActionResult!
  adminInviteOwner(input: InviteOwnerInput!): ActionResult!
  adminApproveOwnerKyc(ownerId: String!, commissionTier: String!): ActionResult!
  adminRejectOwnerKyc(ownerId: String!, reason: String!, note: String): ActionResult!
  adminRequestOwnerDocs(ownerId: String!, docs: [String!]!, note: String): ActionResult!
  adminSuspendOwner(ownerId: String!): ActionResult!
  adminReinstateOwner(ownerId: String!): ActionResult!
  adminApproveVenueV2(venueId: String!): ActionResult!
  adminRejectVenue(venueId: String!, reason: String!, note: String): ActionResult!
  adminFeatureVenue(venueId: String!, slot: String!, months: Int!): ActionResult!
  adminUnfeatureVenue(venueId: String!): ActionResult!
  adminPauseVenue(venueId: String!): ActionResult!
  adminResumeVenue(venueId: String!): ActionResult!
  adminIssueRefund(bookingId: String!, percent: Int!, reason: String!, note: String): ActionResult!
  adminFlagUser(userId: String!): ActionResult!
  adminBanUser(userId: String!): ActionResult!
  adminReinstateUser(userId: String!): ActionResult!
  adminModerateReview(reviewId: String!, action: String!): ActionResult!   # approve|hide|escalate|delete
  adminRunPayouts: ActionResult!
  adminApprovePayout(payoutId: String!): ActionResult!
  adminHoldPayout(payoutId: String!): ActionResult!
  adminReleasePayout(payoutId: String!, utr: String!): ActionResult!
  adminRetryPayout(payoutId: String!): ActionResult!
  adminCreateInvoice(input: AdminInvoiceInput!): ActionResult!
  adminCreatePromo(input: CreatePromoInput!): ActionResult!
  adminUpdatePromo(promoId: String!, patch: JSON!): ActionResult!         # pause/resume/edit
  adminCreatePlacement(input: CreatePlacementInput!): ActionResult!
  adminApprovePlacement(adId: String!): ActionResult!
  adminMarkDisputeInvestigating(disputeId: String!): ActionResult!
  adminAddDisputeMessage(disputeId: String!, message: String!): ActionResult!
  adminResolveDisputeV2(disputeId: String!, resolution: String!, note: String): ActionResult!
  # resolution ∈ FULL_REFUND | PARTIAL_50 | WALLET_CREDIT | REJECT_CLAIM
}
`;

// ── Console additions ────────────────────────────────────────────────────────
// List pages for venues / bookings / disputes reuse the base item types
// (AdminVenueItem, AdminBookingItem, DisputeListItem) — these extensions add
// the display fields the console renders plus page-level composite queries.
export const typeDefsAdminExtra = `#graphql
extend type AdminVenueItem {
  ownerId: String
  ownerName: String
  featured: Boolean
  featuredSlot: String
  sport: String
  spark: [Int!]
  submittedAgo: String
  color: String
}
extend type AdminBookingItem {
  customerId: String
  venueId: String
  city: String
  method: String
  txnRef: String
  paid: Boolean
  color: String
  initials: String
  createdAt: Float
  fee: Float
  net: Float
}
extend type DisputeListItem {
  color: String
  ownerName: String
  venueId: String
  bookingId: String
}

type AdminVenuePage { counts: JSON!, stats: JSON!, total: Int!, venues: [AdminVenueItem!]! }
type AdminBookingPage { counts: JSON!, stats: JSON!, total: Int!, monthLabel: String!, bookings: [AdminBookingItem!]! }
type AdminDisputePage { counts: JSON!, stats: JSON!, disputes: [DisputeListItem!]! }

type DisputeThreadMsg { senderRole: String!, senderName: String!, message: String!, timeLabel: String! }
type AdminDisputeDetailV2 { dispute: DisputeListItem!, escrowHeld: Boolean!, escrowAmount: Float!,
  caseDetails: JSON!, timeline: [BookingTimelineStep!]!, thread: [DisputeThreadMsg!]!, resolution: JSON }

type AdminInvoiceDoc { invoice: AdminInvoiceRow!, seller: JSON!, buyer: JSON!, lines: [JSON!]!, notes: String }

extend type Query {
  getAdminVenuePage(tab: String, q: String): AdminVenuePage!
  getAdminBookingPage(tab: String, q: String, limit: Int, offset: Int): AdminBookingPage!
  getAdminDisputePage(tab: String, q: String): AdminDisputePage!
  getAdminDisputeDetailV2(disputeId: String!): AdminDisputeDetailV2!
  getAdminInvoiceDoc(invoiceId: String!): AdminInvoiceDoc!
  getAdminAutoflagRules: JSON!
}
extend type Mutation {
  adminSetAutoflagRules(rules: JSON!): ActionResult!
  adminReReviewVenue(venueId: String!): ActionResult!
}
`;
