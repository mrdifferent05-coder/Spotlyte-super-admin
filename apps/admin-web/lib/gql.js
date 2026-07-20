// gql.ts — every GraphQL document the console uses, grouped by section.
import { gql } from '@apollo/client';

// ── shared fragments ─────────────────────────────────────────
export const VENUE_ITEM = gql`
  fragment VenueItem on AdminVenueItem {
    venueId
    venueName
    address
    city
    courtCount
    venueStatus
    revenue30d
    bookings30d
    occupancy
    avgRating
    reviewCount
    disputeCount
    ownerId
    ownerName
    featured
    featuredSlot
    sport
    spark
    submittedAgo
    color
  }
`;

export const BOOKING_ITEM = gql`
  fragment BookingItem on AdminBookingItem {
    bookingId
    customerName
    customerPhone
    date
    timeRange
    sport
    courtName
    venueName
    amount
    status
    duration
    customerId
    venueId
    city
    method
    txnRef
    paid
    color
    initials
    createdAt
    fee
    net
  }
`;

export const DISPUTE_ITEM = gql`
  fragment DisputeItem on DisputeListItem {
    disputeId
    disputeRef
    urgency
    avatarInitials
    openedLabel
    venueName
    title
    status
    customerName
    slotLabel
    sport
    courtName
    amount
    timeAgo
    reason
    color
    ownerName
    venueId
    bookingId
  }
`;

export const PAYOUT_ROW = gql`
  fragment PayoutRow on AdminPayoutRow {
    payoutId
    ownerId
    owner
    biz
    venue
    period
    gross
    fee
    tds
    amount
    status
    bank
    ifsc
    settles
    txns
    utr
    color
    initials
  }
`;

export const AUDIT_ENTRY = gql`
  fragment AuditEntryF on AuditEntry {
    logId
    actor
    action
    target
    type
    ref
    ip
    time
    createdAt
  }
`;

// ── auth ─────────────────────────────────────────────────────
export const ADMIN_ME = gql`
  query AdminMe {
    getAdminMe {
      adminId
      name
      email
      role
    }
  }
`;
export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    adminLoginV2(email: $email, password: $password) {
      success
      message
      admin {
        adminId
        name
        email
        role
      }
    }
  }
`;
export const LOGOUT = gql`
  mutation Logout {
    adminLogout {
      success
      message
    }
  }
`;

// ── shell ────────────────────────────────────────────────────
export const NAV_COUNTS = gql`
  query NavCounts {
    getAdminNavCounts {
      pendingOwners
      pendingVenues
      flaggedReviews
      queuedPayouts
      overdueInvoices
      openDisputes
    }
  }
`;
export const GLOBAL_SEARCH = gql`
  query GlobalSearch($q: String!) {
    adminGlobalSearch(q: $q) {
      kind
      id
      title
      sub
      badge
    }
  }
`;

// ── overview ─────────────────────────────────────────────────
export const OVERVIEW = gql`
  ${VENUE_ITEM}
  ${DISPUTE_ITEM}
  query Overview($range: String) {
    getAdminOverviewStat(range: $range) {
      dateLine
      heroKpis {
        label
        value
        unit
        deltaPercent
        meta
        spark
        tone
      }
      miniKpis {
        label
        value
        sub
        icon
        route
      }
      approvalQueue {
        kind
        refId
        name
        who
        meta
        status
        submittedAgo
        color
        initials
      }
      sportMix {
        sport
        percent
        revenue
        colorVar
      }
      openDisputes {
        ...DisputeItem
      }
      topVenues {
        ...VenueItem
      }
    }
  }
`;

// ── owners ───────────────────────────────────────────────────
export const OWNER_LIST = gql`
  query OwnerList($tab: String, $q: String) {
    getAdminOwnerList(tab: $tab, q: $q) {
      counts {
        all
        review
        docs
        verified
        suspended
      }
      stats
      total
      owners {
        ownerId
        name
        biz
        city
        kyc
        venues
        revenue
        payout
        rating
        disputes
        email
        phone
        joined
        submittedAgo
        spark
        color
        initials
      }
    }
  }
`;
export const OWNER_DETAIL = gql`
  ${VENUE_ITEM}
  ${AUDIT_ENTRY}
  query OwnerDetail($ownerId: String!) {
    getAdminOwnerDetail(ownerId: $ownerId) {
      owner {
        ownerId
        name
        biz
        city
        kyc
        venues
        revenue
        payout
        rating
        disputes
        email
        phone
        joined
        submittedAgo
        spark
        color
        initials
      }
      pipelineStep
      documents {
        name
        ref
        status
        fileUrl
      }
      venues {
        ...VenueItem
      }
      contact
      legal
      bank
      plan
      cancellationPolicy
      lifetime
      activity {
        ...AuditEntryF
      }
    }
  }
`;
export const INVITE_OWNER = gql`
  mutation InviteOwner($input: InviteOwnerInput!) {
    adminInviteOwner(input: $input) {
      success
      message
      refId
    }
  }
`;
export const APPROVE_KYC = gql`
  mutation ApproveKyc($ownerId: String!, $tier: String!) {
    adminApproveOwnerKyc(ownerId: $ownerId, commissionTier: $tier) {
      success
      message
    }
  }
`;
export const REJECT_KYC = gql`
  mutation RejectKyc($ownerId: String!, $reason: String!, $note: String) {
    adminRejectOwnerKyc(ownerId: $ownerId, reason: $reason, note: $note) {
      success
      message
    }
  }
`;
export const REQUEST_DOCS = gql`
  mutation RequestDocs($ownerId: String!, $docs: [String!]!, $note: String) {
    adminRequestOwnerDocs(ownerId: $ownerId, docs: $docs, note: $note) {
      success
      message
    }
  }
`;
export const SUSPEND_OWNER = gql`
  mutation SuspendOwner($ownerId: String!) {
    adminSuspendOwner(ownerId: $ownerId) {
      success
      message
    }
  }
`;
export const REINSTATE_OWNER = gql`
  mutation ReinstateOwner($ownerId: String!) {
    adminReinstateOwner(ownerId: $ownerId) {
      success
      message
    }
  }
`;

// ── venues ───────────────────────────────────────────────────
export const VENUE_PAGE = gql`
  ${VENUE_ITEM}
  query VenuePage($tab: String, $q: String) {
    getAdminVenuePage(tab: $tab, q: $q) {
      counts
      stats
      total
      venues {
        ...VenueItem
      }
    }
  }
`;
export const VENUE_DETAIL = gql`
  ${VENUE_ITEM}
  ${BOOKING_ITEM}
  ${DISPUTE_ITEM}
  ${PAYOUT_ROW}
  ${AUDIT_ENTRY}
  query VenueDetail($venueId: String!) {
    getAdminVenueDetail(venueId: $venueId) {
      venue {
        ...VenueItem
      }
      ownerId
      photos
      games
      amenities
      listing
      pricing
      spark
      courts {
        courtName
        sport
        surface
        size
        slots {
          time
          state
        }
      }
      recentBookings {
        ...BookingItem
      }
      bookings {
        ...BookingItem
      }
      disputes {
        ...DisputeItem
      }
      payoutSummary
      payouts {
        ...PayoutRow
      }
      activity {
        ...AuditEntryF
      }
    }
  }
`;
export const APPROVE_VENUE = gql`
  mutation ApproveVenue($venueId: String!) {
    adminApproveVenueV2(venueId: $venueId) {
      success
      message
    }
  }
`;
export const REJECT_VENUE = gql`
  mutation RejectVenue($venueId: String!, $reason: String!, $note: String) {
    adminRejectVenue(venueId: $venueId, reason: $reason, note: $note) {
      success
      message
    }
  }
`;
export const FEATURE_VENUE = gql`
  mutation FeatureVenue($venueId: String!, $slot: String!, $months: Int!) {
    adminFeatureVenue(venueId: $venueId, slot: $slot, months: $months) {
      success
      message
    }
  }
`;
export const UNFEATURE_VENUE = gql`
  mutation UnfeatureVenue($venueId: String!) {
    adminUnfeatureVenue(venueId: $venueId) {
      success
      message
    }
  }
`;
export const PAUSE_VENUE = gql`
  mutation PauseVenue($venueId: String!) {
    adminPauseVenue(venueId: $venueId) {
      success
      message
    }
  }
`;
export const RESUME_VENUE = gql`
  mutation ResumeVenue($venueId: String!) {
    adminResumeVenue(venueId: $venueId) {
      success
      message
    }
  }
`;
export const REREVIEW_VENUE = gql`
  mutation ReReviewVenue($venueId: String!) {
    adminReReviewVenue(venueId: $venueId) {
      success
      message
    }
  }
`;

// ── bookings ─────────────────────────────────────────────────
export const BOOKING_PAGE = gql`
  ${BOOKING_ITEM}
  query BookingPage($tab: String, $q: String, $limit: Int, $offset: Int) {
    getAdminBookingPage(tab: $tab, q: $q, limit: $limit, offset: $offset) {
      counts
      stats
      total
      monthLabel
      bookings {
        ...BookingItem
      }
    }
  }
`;
export const BOOKING_DETAIL = gql`
  ${BOOKING_ITEM}
  query BookingDetail($bookingId: String!) {
    getAdminBookingDetail(bookingId: $bookingId) {
      booking {
        ...BookingItem
      }
      txnRef
      method
      paid
      timeline {
        title
        sub
        state
      }
      breakdown
      refund
    }
  }
`;
export const ISSUE_REFUND = gql`
  mutation IssueRefund($bookingId: String!, $percent: Int!, $reason: String!, $note: String) {
    adminIssueRefund(bookingId: $bookingId, percent: $percent, reason: $reason, note: $note) {
      success
      message
    }
  }
`;

// ── users ────────────────────────────────────────────────────
export const USER_LIST = gql`
  query UserList($tab: String, $q: String) {
    getAdminUserList(tab: $tab, q: $q) {
      counts
      stats
      total
      users {
        userId
        name
        email
        phone
        city
        joined
        bookings
        spend
        lastSeen
        status
        color
        initials
      }
    }
  }
`;
export const USER_DETAIL = gql`
  ${BOOKING_ITEM}
  query UserDetail($userId: String!) {
    getAdminUserDetail(userId: $userId) {
      user {
        userId
        name
        email
        phone
        city
        joined
        bookings
        spend
        lastSeen
        status
        color
        initials
      }
      activityStats
      bookings {
        ...BookingItem
      }
      spark
    }
  }
`;
export const BAN_USER = gql`
  mutation BanUser($userId: String!) {
    adminBanUser(userId: $userId) {
      success
      message
    }
  }
`;
export const REINSTATE_USER = gql`
  mutation ReinstateUser($userId: String!) {
    adminReinstateUser(userId: $userId) {
      success
      message
    }
  }
`;

// ── reviews ──────────────────────────────────────────────────
export const REVIEW_LIST = gql`
  query ReviewList($tab: String) {
    getAdminReviewList(tab: $tab) {
      counts
      stats
      reviews {
        reviewId
        user
        venue
        text
        rating
        status
        flags
        dateAgo
        color
        initials
      }
    }
  }
`;
export const MODERATE_REVIEW = gql`
  mutation ModerateReview($reviewId: String!, $action: String!) {
    adminModerateReview(reviewId: $reviewId, action: $action) {
      success
      message
    }
  }
`;
export const AUTOFLAG_RULES = gql`
  query AutoflagRules {
    getAdminAutoflagRules
  }
`;
export const SET_AUTOFLAG_RULES = gql`
  mutation SetAutoflagRules($rules: JSON!) {
    adminSetAutoflagRules(rules: $rules) {
      success
      message
    }
  }
`;

// ── payouts ──────────────────────────────────────────────────
export const PAYOUT_LIST = gql`
  ${PAYOUT_ROW}
  query PayoutList($tab: String) {
    getAdminPayoutList(tab: $tab) {
      counts
      stats
      nextRunLabel
      payouts {
        ...PayoutRow
      }
    }
  }
`;
export const PAYOUT_DETAIL = gql`
  ${PAYOUT_ROW}
  ${BOOKING_ITEM}
  query PayoutDetail($payoutId: String!) {
    getAdminPayoutDetail(payoutId: $payoutId) {
      payout {
        ...PayoutRow
      }
      timeline {
        title
        sub
        state
      }
      transactions {
        ...BookingItem
      }
      history {
        ...PayoutRow
      }
    }
  }
`;
export const RUN_PAYOUTS = gql`
  mutation RunPayouts {
    adminRunPayouts {
      success
      message
    }
  }
`;
export const APPROVE_PAYOUT = gql`
  mutation ApprovePayout($payoutId: String!) {
    adminApprovePayout(payoutId: $payoutId) {
      success
      message
    }
  }
`;
export const HOLD_PAYOUT = gql`
  mutation HoldPayout($payoutId: String!) {
    adminHoldPayout(payoutId: $payoutId) {
      success
      message
    }
  }
`;
export const RELEASE_PAYOUT = gql`
  mutation ReleasePayout($payoutId: String!, $utr: String!) {
    adminReleasePayout(payoutId: $payoutId, utr: $utr) {
      success
      message
    }
  }
`;
export const RETRY_PAYOUT = gql`
  mutation RetryPayout($payoutId: String!) {
    adminRetryPayout(payoutId: $payoutId) {
      success
      message
    }
  }
`;

// ── invoices ─────────────────────────────────────────────────
export const INVOICE_LIST = gql`
  query InvoiceList($audience: String!, $tab: String) {
    getAdminInvoiceList(audience: $audience, tab: $tab) {
      stats
      counts
      invoices {
        invoiceId
        audience
        party
        sub
        type
        period
        issued
        due
        amount
        tax
        total
        status
        pdfUrl
        color
        initials
      }
    }
  }
`;
export const INVOICE_DOC = gql`
  query InvoiceDoc($invoiceId: String!) {
    getAdminInvoiceDoc(invoiceId: $invoiceId) {
      invoice {
        invoiceId
        audience
        party
        sub
        type
        period
        issued
        due
        amount
        tax
        total
        status
        color
        initials
      }
      seller
      buyer
      lines
      notes
    }
  }
`;
export const CREATE_INVOICE = gql`
  mutation CreateInvoice($input: AdminInvoiceInput!) {
    adminCreateInvoice(input: $input) {
      success
      message
      refId
    }
  }
`;

// ── promos ───────────────────────────────────────────────────
export const PROMO_LIST = gql`
  query PromoList($q: String) {
    getAdminPromoList(q: $q) {
      stats
      promos {
        promoId
        code
        label
        kind
        value
        scope
        used
        cap
        expires
        status
        assistedRevenue
      }
    }
  }
`;
export const CREATE_PROMO = gql`
  mutation CreatePromo($input: CreatePromoInput!) {
    adminCreatePromo(input: $input) {
      success
      message
    }
  }
`;
export const UPDATE_PROMO = gql`
  mutation UpdatePromo($promoId: String!, $patch: JSON!) {
    adminUpdatePromo(promoId: $promoId, patch: $patch) {
      success
      message
    }
  }
`;

// ── advertising ──────────────────────────────────────────────
export const AD_LIST = gql`
  query AdList($tab: String) {
    getAdminAdList(tab: $tab) {
      stats
      counts
      ads {
        adId
        venueId
        venue
        owner
        slot
        city
        start
        end
        budget
        spent
        clicks
        impressions
        status
      }
    }
  }
`;
export const CREATE_PLACEMENT = gql`
  mutation CreatePlacement($input: CreatePlacementInput!) {
    adminCreatePlacement(input: $input) {
      success
      message
    }
  }
`;
export const APPROVE_PLACEMENT = gql`
  mutation ApprovePlacement($adId: String!) {
    adminApprovePlacement(adId: $adId) {
      success
      message
    }
  }
`;

// ── disputes ─────────────────────────────────────────────────
export const DISPUTE_PAGE = gql`
  ${DISPUTE_ITEM}
  query DisputePage($tab: String, $q: String) {
    getAdminDisputePage(tab: $tab, q: $q) {
      counts
      stats
      disputes {
        ...DisputeItem
      }
    }
  }
`;
export const DISPUTE_DETAIL = gql`
  ${DISPUTE_ITEM}
  query DisputeDetail($disputeId: String!) {
    getAdminDisputeDetailV2(disputeId: $disputeId) {
      dispute {
        ...DisputeItem
      }
      escrowHeld
      escrowAmount
      caseDetails
      resolution
      timeline {
        title
        sub
        state
      }
      thread {
        senderRole
        senderName
        message
        timeLabel
      }
    }
  }
`;
export const MARK_INVESTIGATING = gql`
  mutation MarkInvestigating($disputeId: String!) {
    adminMarkDisputeInvestigating(disputeId: $disputeId) {
      success
      message
    }
  }
`;
export const ADD_DISPUTE_MESSAGE = gql`
  mutation AddDisputeMessage($disputeId: String!, $message: String!) {
    adminAddDisputeMessage(disputeId: $disputeId, message: $message) {
      success
      message
    }
  }
`;
export const RESOLVE_DISPUTE = gql`
  mutation ResolveDispute($disputeId: String!, $resolution: String!, $note: String) {
    adminResolveDisputeV2(disputeId: $disputeId, resolution: $resolution, note: $note) {
      success
      message
    }
  }
`;

// ── audit ────────────────────────────────────────────────────
export const AUDIT_LOG = gql`
  ${AUDIT_ENTRY}
  query AuditLog($type: String, $q: String, $limit: Int, $offset: Int) {
    getAdminAuditLog(type: $type, q: $q, limit: $limit, offset: $offset) {
      total
      entries {
        ...AuditEntryF
      }
    }
  }
`;

// Refetch nav counts after any mutation that changes a badge.
export const REFRESH_NAV = { refetchQueries: ['NavCounts'] };
