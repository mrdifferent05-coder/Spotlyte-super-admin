// typeDefs.base.js — the production schema of the owner-facing app plus the
// legacy super-admin queries, kept so the API stays compatible with the owner
// app. Cleaned per Section 9.1:
//  • duplicate DailyAvailability / UpdateCourtInput / BlackoutInput /
//    VenueActionInput declarations removed (one of each kept)
//  • the two Sport declarations merged into { _id, title!, slug!, url, image, noVenue }
//  • the small PayoutStat (amount/status/date) renamed VenuePayoutInfo and
//    VenuePerformanceItem.payout retyped; the owner-dashboard PayoutStat kept
//  • stray spacing normalized (status : String ! → status: String!)
export const typeDefsBase = `#graphql
    scalar Upload
    
    type OtpResponse {
        message: String!
    }

    type VerifyOtpResponse {
        message: String!
        status: String
    }

    type AzureSasToken {
        uploadUrl: String!
        fileUrl: String!
    }

    type User {
        _id: String
        uuid: String!
        phone: String!
        fullName: String
        email: String
        aadhar: String
        businessName: String
        gstin: String
        pan: String
        bankName: String
        accountHolderName: String
        accountNumber: String
        reEnterAccountNumber: String
        ifscCode: String
        accountType: String
        noVenue: Float
        venue: [Venue]
        venuePhotos: [VenuePhoto]
        cancellationPolicy: String 
        courts: [Court] 
        status: String
        createdAt: String
        updatedAt: String
        plan: ActivePlan
        pendingPlan: PendingPlan
        KycDocuments:KycDoc
        onboardingStep: Int
    }

    type ActivePlan {
        planName: String
        activePlan: String
	    planExpire: Float
		planStart: Float
        planAmount: Float
	    maxVenues: Float
	    maxCourt: Float
		billingPeriod: String
        support: String
    }

    type PendingPlan {
        plan: String
        billingPeriod: String
        planAmount: Float
        status: String
        createdAt: String
    } 

    input PendingPlanInput {
        plan: String!
        billingPeriod: String!
        planAmount:Float!
    }

    type PlanHistory {
        _id: String
        bookingId: String
        planName: String
        planStart: Float
        planExpire: Float
        planAmount: Float
    }

    type Customer {
        _id: String
        uuid: String
        name: String
        email: String
        phone: String
        city: String
        status: String
        lastLogin: Float
        createdAt: Float
        spend: Float
        noBooking: Float
        bookings: [BookingItem]
    }

    type Sport {
        _id: String
        title: String!
        slug: String!
        url: String
        image: String
        noVenue: Float
    }

    type Review {
        _id: String
        uuid: String
        user: Customer
        venue: Venue
        review: String
        rating: Float
        status: String
        createdAt: Float
    }

    type Venue {
        _id: String
        venueId: String
        userId: String
        courts: [Court]
        noCourt: Float
        amenities: [String]
        venuePhotos: [String]
        status: String
        venueName: String
        venueType: String
        venueStatus: String
        address: String
        city: String
        locationId: String
        locationUrl: String
        cancellationPolicy: String 
        policyPreview: [CancellationPolicyPreview]
        pincode: String
        description: String
        iframeSrc: String
        createdAt: String
        updatedAt: String
        revenue30d: Float
        bookings30d: Float
        occupancyRate: Float
        avgRating: AvgRatingStat
        pendingPayout: Float
        disputes: Float
        owner: User
        completedStep: Int
        isOnboardingDraft:Boolean
        onboardingCompleted:Boolean
        bookings: [BookingItem]
    }

    type Dispute {
        _id: String
        disputeId: String
        disputeRef: String
        customer: Customer
        venueId: String
        venue: Venue
        bookingId: String
        status: String
        urgency: String
        reason: String
        courtName: String
        date: String
        fromTime: String
        toTime: String
        amount: Float
        createdAt: Float
        conversation: [DisputeConversation]
    }

    type DisputeConversation {
        _id: String
        uuid: String
        senderId: String
        senderRole: String
        message: String
        attachments: [String]
        createdAt: Float
        customer: Customer
    }

    type Court {
        _id: String
        courtId: String
        venueId: String
        courtName: String
        courtType: String
        surface: String
        sports: [String!]
        openTime: String
        closeTime: String
        openDays: [String!]
        peakStart: String
        peakEnd: String
        amenities: [String] 
        sportPrices: [SportPrice]
        status: String
        createdAt: String
        updatedAt: String
    }

    type SportPrice {
        priceId: String!
        sport: String!
        playersCapacity: Int!
        offPeakRate: Float!
        weekendPeak: Float
        peakRate: Float!
        slotLength: Int!
        minimumBooking: Int!
        smartPricing: Boolean!
        status: String
        createdAt: String
        updatedAt: String
        slots: [SportPriceSlots]
    }

    type SportPriceSlots {
        fromTime: String
        toTime: String
        label: String
    }

    type VenuePhoto {
        index: Int!
        url: String!
        createdAt: String
    }

    enum KycDocumentStatus {
        NOT_UPLOADED
        UPLOADED
        UNDER_REVIEW
        VERIFIED
        REJECTED
    }

    type KycDocument {
        fileUrl: String
        fileName: String
        fileSize: Int
        status: KycDocumentStatus
        rejectionReason: String
        uploadedAt: String
        reviewedAt: String
    }


    type KycDoc {
        panCard: KycDocument
        aadhar: KycDocument
        propertyProof: KycDocument
        gstCertificate: KycDocument
    }

    type RevenueChartItem {
        date: String
        revenue: Float
        label: String
    }

    type BookingItem {
        _id: String
        bookingId: String
        customerName: String
        customerPhone: String
        date: String
        timeRange: String
        fromTime: String
        toTime: String
        sport: String
        courtName: String
        venueName: String
        amount: Float
        total: Float
        status: String
        duration: String
        paymentMethod: String
        createdAt: Float
        venue: Venue
        court: Court
    }

    type BookingList {
        total: Int
        bookings: [BookingItem]
    }

    type AlertItem {
        alertId: String
        title: String
        description: String
        type: String
        requiresAction: Boolean
        timeAgo: String
        createdAt: String
    }

    type AlertList {
        total: Int
        alerts: [AlertItem]
    }

    type OverviewStat {
        todayRevenue: Float
        occupancy: Int
        upcomingBooking: Int
        refundAmount: Int
        totalBookingsCount: Int 
        totalSessionsToday: Int        
        todaySchedule: [SessionItem] 
        revenueChart(range: String): [RevenueChartItem]
        recentBookings(filter: String, limit: Int, offset: Int): BookingList 
        alerts: AlertList
    }

    type OverviewHeatMap {
        courtId: String
        slot: String
        noBooking: Int
    }

    type SessionItem {
        customerName: String
        sport: String
        courtName: String
        fromTime: String
        toTime: String
        duration: String
    }

    type CourtItem {
    courtId: String
    courtName: String
    sport: String
    surface: String
    capacity: Int
    ratePerHour: Float
    todayBookings: Int
    status: String
    statusNote: String
    isActive: Boolean
}

    type CourtList {
        total: Int
        active: Int
        inactive: Int
        maintenance: Int
        closure: Int
        courts: [CourtItem]
    }

    type BlackoutItem {
        blackoutId: String
        dateLabel: String
        startDate: String
        endDate: String
        reason: String
        scope: String
        courts: [String]
        type: String
        repeatsYearly: Boolean
    }

    type BlackoutList {
        upcomingCount: Int
        blackouts: [BlackoutItem]
    }

    type DangerZone {
        venueName: String
        upcomingBookingsCount: Int
    }

    type VenueSetting {
        courtsList(filter: String): CourtList
        blackouts: BlackoutList
        dangerZone: DangerZone
    }

    type SlotItem {
        slotId: String
        date: String
        fromTime: String
        toTime: String
        label: String
        subLabel: String
        courtName: String
        type: String
    }

    type BlackoutDay {
       date: String!
       reason: String
       type: String
       courtName: String
    }

    type DateRange {
        startDate: String
        endDate: String
        label: String
    }

    type AvailableSlot {
        fromTime: String
        toTime: String
        label: String
        isPeak: Boolean
        price: Float
        isBooked: Boolean
        bookedBy: String
        bookedSport: String
        bookingId: String
    }

    type DailyAvailability {
    date: String!
    slots: [AvailableSlot!]!
    }

    type Calendar {
        slots: [SlotItem]
        availableSlots:[availableSlots]
        weeklyAvailability: [DailyAvailability]
        dateRange: DateRange
        blackoutDays: [BlackoutDay]
    }
    
    type availableSlots {
      fromTime: String,
      toTime: String,
      label: String,
      isPeak : Boolean,
      isBooked: Boolean,
      price : Float,
    }

    type BookingActionResponse {
        success: Boolean
        bookingId: String
        refundAmount: Float
        refundType: String
        message: String
    }

    type TimelineItem {
        timelineId: String
        title: String
        description: String
        timeLabel: String
        isDone: Boolean
    }

    type PlayerItem {
        playerId: String
        name: String
    }

    type BookingDetail {
        bookingId: String
        sport: String
        courtName: String
        venueName: String
        date: String
        dateLabel: String
        fromTime: String
        toTime: String
        duration: String
        ratePerHour: Float
        status: String
        customerName: String
        customerPhone: String
        memberSince: String
        visitCount: Int
        totalPlayers: Int
        captainName: String
        players: [PlayerItem]
        amountPaid: Float
        paymentMethod: String
        paymentGateway: String
        transactionId: String
        timeline: [TimelineItem]
        venuePolicy: VenuePolicy
    }

    type CancelBookingResponse {
        success: Boolean
        bookingId: String
        refundAmount: Float
        refundType: String
        message: String
    }

    type SlotGrid {
        time: String
        status: String
    }

    type WalkInSlotInfo {
        courtId: String
        courtName: String
        sport: String
        date: String
        dateLabel: String
        fromTime: String
        ratePerHour: Float
        slotGrid: [SlotGrid]
    }

    type WalkInPrice {
        sport: String
        duration: Float
        baseAmount: Float
        serviceFeePercent: Int
        serviceFee: Float
        total: Float
    }

    type WalkInBookingResponse {
        success: Boolean
        bookingId: String
        courtName: String
        sport: String
        date: String
        fromTime: String
        toTime: String
        total: Float
        paymentMethod: String
        message: String
    }

    

    type StatCard {
        count: Int
        changePercent: Int
    }

    type CardMetric {
       label: String
       value: String
    }

    type BookingStat {
        total30Days: StatCard
        today: StatCard
        thisWeek: StatCard
        cancellations: StatCard
        bookings(filter: String, limit: Int, offset: Int): BookingList
    }

    type OverallBookingStat {
        total: StatCard
        confirmed: StatCard
        cancelled: StatCard
        pending: StatCard
        bookings(filter: String, limit: Int, offset: Int): BookingList
    }

    type GrossRevenueCard {
        total: String!
        changePercent: String!
        platformFee : String!
        netPayout : String!
    }

    type WithdrawCard {
        total: String!
        status: String!
        lastPayout : String!
        nextPayout : String!
    }
    
    type AvgPerBookingCard {
        total: String!
        changePercent: String!
        highestVenue : String!
        avgDuration : String!
    }

    type RefundCard {
        total: String!
        changePercent: String!
        refundRate : String!
        disputeOpen: String!
    }

    type CommissionStat {
        amount: String!
        percentage: String!
    }

    type VenuePayoutInfo {
        amount: String!
        status: String!
        date: String!
    }

    type VenuePerformanceItem {
        venueInitial: String!
        venueName: String!
        revenue: String!
        commision: CommissionStat!
        payout: VenuePayoutInfo!
    }

    type RevenueBySport {
        sport: String!
        percentage: String!
        amount: String!
    }

    type MonthBar {
      month: String!
      revenue: Float!
      percentage: Float!
    }

    type MonthlyGrowth {
      label: String!
      months: [MonthBar]
    }

    type QuickMetric {
       revenueGrowth: String!
       totalBooking: String!
       comparisonPercentage: String!
       topRated: String!
    }

    type InsightItem {
       bestPerformance: String!
       lowOccupancy: String!
       peakDemand: String!
    
    }

    type OverallEarningsStat {
        grossRevenue: GrossRevenueCard!
        availableToWithdraw: WithdrawCard!
        avgPerBooking: AvgPerBookingCard!
        refunds: RefundCard!
        venuePerformanceList: [VenuePerformanceItem]
        revenueBySport: [RevenueBySport]
        monthlyGrowth: [MonthlyGrowth]
        quickMetrics: [QuickMetric]
        allInsights: [InsightItem]
    }


    type ActivityItem {
        timelineId: String
        time: String
        date: String
        title: String
        type: String        # "booking" | "payment" | "sms" | "note" | "reminder"
        isDone: Boolean
    }

    type ReceiptItem {
        label: String
        amount: Float
    }

    type BookingFullDetail {
        # customer
        customerName: String
        customerPhone: String
        isMember: Boolean
        lifetimeVisits: Int
        lifetimeSpend: Float
        onTimeRate: Int
        streak: Int
        # slot
        venueName: String
        courtName: String
        courtSize: String
        amenities: [String]
        sport: String
        date: String
        dateLabel: String
        yearLabel: String
        fromTime: String
        toTime: String
        timeRange: String
        duration: String
        totalPlayers: Int
        knownContacts: Int
        totalPaid: Float
        # activity
        activity: [ActivityItem]
        # receipt
        receiptItems: [ReceiptItem]
        totalPaidReceipt: Float
        paymentMethod: String
        transactionRef: String
        capturedAt: String
        paymentStatus: String
    }

    type TotalCustomersStat {
        count: Float
        changePercent: Float
        changeLabel: String
    }

    type RepeatRateStat {
        rate: Int
        label: String
    }

    type TopSpenderStat {
        amount: Float
        customerName: String
        visitCount: Int
    }

    type AvgTicketStat {
        amount: Float
        label: String
    }

    type CustomerStat {
        totalCustomers: TotalCustomersStat
        repeatRate: RepeatRateStat
        topSpender: TopSpenderStat
        avgTicket: AvgTicketStat
    }

    type CustomerItem {
        _id: ID
        customerPhone: String
        customerName: String
        visitCount: Int
        totalSpend: Float
        lastVisitLabel: String
        lastVisitDate: String
        joinedLabel: String
    }

    type CustomerList {
        total: Int
        customers: [CustomerItem]
    }

    type CustomerBook {
        customers(limit: Int, offset: Int): CustomerList
    }

    type CustomerInfo {
        customerName: String
        customerPhone: String
        isMember: Boolean
        lifetimeVisits: Int
        lifetimeSpend: Float
        onTimeRate: Int
        streak: Int
    }

    type SportBreakdown {
        sport: String
        count: Int
        percent: Int
    }

    type UserPattern {
        sportBreakdown: [SportBreakdown]
        favoriteCourt: String
        timeOfDay: String
        groupSize: String
    }

    type VisitItem {
        bookingId: String
        dateLabel: String
        sport: String
        courtName: String
        fromTime: String
        amount: Float
        status: String
    }

    type VisitList {
        total: Int
        visits: [VisitItem]
    }

    type ReviewItem {
        reviewId: String
        customerName: String
        avatarInitials: String
        hasReply: Boolean
        reply: String
        rating: Int
        comment: String
        sport: String
        courtName: String
        timeAgo: String
        helpfulCount: Int
        isNew: Boolean
    }

    type CustomerProfile {
        info: CustomerInfo
        userPattern: UserPattern
        lastVisits: VisitList
        reviews: [ReviewItem]
    }

    type ReviewSummary {
        avg30Day: Float
        total: Int
        newThisWeek: Int
        responseRate: Int
    }

    type ReviewDistributionItem {
        star: Int
        count: Int
        percent: Int
    }

    type ReviewMention {
        topMention: String
        watchMention: String
        watchCount: Int
    }

    type ReviewList {
        total: Int
        needsReplyCount: Int
        reviews: [ReviewItem]
    }

    type ReviewStat {
        summary: ReviewSummary
        distribution: [ReviewDistributionItem]
        mentions: ReviewMention
        reviews(filter: String, limit: Int, offset: Int): ReviewList
    }

    type ReplyToReviewResponse {
        reviewId: String
        reply: String
        hasReply: Boolean
    }

    type PayoutChartItem {
        label: String
        amount: Float
    }

    type YearToDate {
        totalAmount: Float
        payoutCount: Int
        avgCycleDays: Float
        feesYTD: Float
        bankLast4: String
        chartData: [PayoutChartItem]
    }

    type Payout {
        _id: String
        bookingIds: [String]
        status: String
        amount: Float
        owner: User
        venue: Venue
        periodFrom: String
        periodEnd: String
    }

    type Audit {
        _id: String
        uuid: String
        type: String
        what: String
        refID: String
        ip: String
        status: String
        createdAt: String
    }

    type PendingPayout {
        amount: Float
        settlesLabel: String
        bankLast4: String
    }

    type PayoutItem {
        payoutId: String
        periodLabel: String
        periodStart: String
        periodEnd: String
        settlesLabel: String
        bankLast4: String
        amount: Float
        status: String
    }

    type PayoutHistory {
        total: Int
        payouts: [PayoutItem]
    }

    type PayoutStat {
        yearToDate: YearToDate
        pendingPayout: PendingPayout
        history(limit: Int, offset: Int): PayoutHistory
    }

    type Revenue90Stat {
        amount: Float
        changePercentage: Int
    }

    type Bookings90Stat {
        count: Int
        courtCount: Int
    }

    type AvgBookingStat {
        amount: Float
        changePercentage: Int
    }

    type RepeatRateInsightStat {
        rate: Int
        changePoint: Int
    }

    type InsightStat {
        revenue90d: Revenue90Stat
        bookings90d: Bookings90Stat 
        avgBooking: AvgBookingStat
        repeatRate: RepeatRateInsightStat
    }

    type SportMixItem {
        sport: String
        revenue: Float
        count: Int
        percent: Int
    }

    type InsightSportMix {
        sports: [SportMixItem]
    }

    type CourtRevenueItem {
        sport: String
        timeSlot: String
        revenue: Float
        percent: Int
    }

    type InsightRevenueByCourt {
        courtName: String
        breakdown: [CourtRevenueItem]
    }

    type CohortRow {
        monthLabel: String
        retention: [Int]
    }

    type InsightRepeatCohort {
        cohorts: [CohortRow]
    }

    type CancellationReason {
        reason: String
        count: Int
        percent: Int
    }

    type InsightCancellations {
        totalLastWeek: Int
        reasons: [CancellationReason]
    }

    type Revenue30dStat {
        amount: Float
        changePercent: Float
    }

    type Bookings30dStat {
        count: Int
        changePercent: Float
        live: Int
        upcoming: Int
    }

    type PendingPayoutStat {
        amount: Float
        batchCount: Int
        settlesLabel: String
    }

    type ActiveDisputesStat {
        count: Int
        change: Int
        amountAtRisk: Float
        highUrgency: Int
    }

    type AvgOccupancyStat {
        rate: Float
        changePoints: Float
        peakLabel: String
    }

    type NewCustomersStat {
        count: Int
        changePercent: Int
        returningCount: Int
    }

    type AvgRatingStat {
        rating: Float
        totalReviews: Int
    }

    type AdminStat {
        revenue30d: Revenue30dStat
        bookings30d: Bookings30dStat
        pendingPayout: PendingPayoutStat
        activeDisputes: ActiveDisputesStat
        avgOccupancy: AvgOccupancyStat
        newCustomers: NewCustomersStat
        avgRating: AvgRatingStat
    }

    type AdminPayoutItem {
        payoutId: String
        periodLabel: String
        settlesLabel: String
        bankLast4: String
        amount: Float
        status: String
    }

    type AdminPayouts {
        payouts(limit: Int, offset: Int): [AdminPayoutItem]
    }

    type AdminSportMixItem {
        sport: String
        revenue: Float
        count: Int
        percent: Int
    }

    type AdminSportMix {
        sports: [AdminSportMixItem]
    }

    type AdminVenueItem {
        venueId: String
        venueName: String
        address: String
        city: String
        courtCount: Int
        image: String
        venueStatus: String
        revenue30d: Float
        revenueChange: Float
        bookings30d: Int
        occupancy: Int
        avgRating: Float
        reviewCount: Int
        pendingPayoutAmount: Float
        refundCount: Int
        disputeCount: Int
        refundAmount: Float
    }

    type AdminVenueList {
        total: Int
        venues(limit: Int, offset: Int): [AdminVenueItem]
    }

    type AdminBookingStatCard {
        count: Int
        changePercent: Int
    }

    type AdminBookingStat {
        totalBookings: AdminBookingStatCard
        confirmedBookings: AdminBookingStatCard
        cancelledBookings: AdminBookingStatCard
        pendingBookings: AdminBookingStatCard
    }

    type AdminBookingItem {
        bookingId: String
        customerName: String
        customerPhone: String
        date: String
        timeRange: String
        sport: String
        courtName: String
        venueName: String
        amount: Float
        status: String
        duration: String
        }

    type VenueOption {
        venueId: String
        venueName: String
    }

    type AdminBookingList {
        total: Int
        venues: [VenueOption]
        bookings: [AdminBookingItem]
    }

    type DisputeOpenStat {
        count: Int
        label: String
    }

    type DisputeUnderReviewStat {
        count: Int
        label: String
    }

    type DisputeResolved30dStat {
        count: Int
        changePercent: Int
        label: String
    }

    type DisputeAmountAtRiskStat {
        amount: Float
        label: String
    }

    type AdminDisputeStat {
        open: DisputeOpenStat
        underReview: DisputeUnderReviewStat
        resolved30d: DisputeResolved30dStat
        amountAtRisk: DisputeAmountAtRiskStat
    }

    input CreateAccountInput {
        fullName: String!
        email: String!
        number: String
        aadhar: String
        businessName: String
        gstin: String
        pan: String
    }

    type DisputeListItem {
        disputeId: String
        disputeRef: String
        urgency:String
        avatarInitials:String
        openedLabel:String
        venueName: String
        title: String
        status: String
        customerName: String
        slotLabel: String
        sport: String
        courtName: String
        amount: Float
        timeAgo: String
        reason: String
    }

    type AdminDisputeList {
        total: Int
        disputes(filter: String, limit: Int, offset: Int): [DisputeListItem]
    }

    type DisputeInfo {
        disputeId: String
        disputeRef: String
        title: String
        status: String
        customerName: String
        bookingId: String
        venueName: String
        amount: Float
        sport: String
        courtName: String
        slotLabel: String
    }

    type DisputeEvidence {
        fileId: String
        fileName: String
        fileSize: String
        uploadedBy: String
        fileUrl: String
    }

    type DisputeTimelineItem {
        timelineId: String
        title: String
        description: String
        timeLabel: String
        type: String
        isDone: Boolean
    }

    type AdminDisputeDetail {
        info: DisputeInfo
        evidence: [DisputeEvidence]
        timeline: [DisputeTimelineItem]
    }

    type VenueBasic {
        venueId: String!
        venueName: String!
    }

    type ResolveDisputeResponse {
        success: Boolean
        disputeId: String
        status: String
        message: String
    }

    type SubscriptionResult {
        success: Boolean!
        plan: String!
        message: String!
    }

    type SubscriptionPlan {
        plan: String
        amount: String
    }

    type BillingItem {
        subId: String
        planName: String
        upgradedFrom: String
        billingPeriod: String
        paidOn: String
        amount: Float
        status: String
        payMethod: String
        invoiceUrl: String
    }

    type BillingHistory {
        total: Int
        billings: [BillingItem]
    }

    type UserSubscription {
        activePlan: ActivePlan
        billingHistory(limit: Int, offset: Int): BillingHistory
    }

    type CourtUtilisationSlot {
        fromTime: String
        toTime: String
        label: String
        isBooked: Boolean
    }

    type CourtUtilisation {
        courtId: String
        courtName: String
        supported: Boolean
        slots: [CourtUtilisationSlot]
    }

    type Location {
        uuid: String
        name: String
        state: String
    }

    type Admin {
        _id: String
        name: String
    }

    type AdminSportBooking {
        sport: String
        count: Float
    }

    type AdminOverview {
        merchandValueThisMonth: Float
        merchandValueLastMonth: Float
        bookingsThisMonth: Float
        bookingsLastMonth: Float
        bookingsToday: Float
        commissionThisMonth: Float
        commissionLastMonth: Float
        cancellationThisMonth: Float
        cancellationLastMonth: Float
        bookingBySports: [AdminSportBooking]
    }

    # Slot returned to the user frontend (includes availability & price)
    type CourtSlot {
        fromTime:  String!
        toTime:    String!
        label:     String!
        isPeak:    Boolean!
        isBooked:  Boolean!
        price:     Float!
    }

    type CreateAccountResponse {
        success: Boolean!
        message: String!
        venueId: String!
    }

    type CreateVenueResponse {
        success: Boolean!
        message: String!
        venueId: String!
    }

    type CreateVenuePhotosResponse {
        success: Boolean!
        message: String!
        venueId: String!
    }

    type Plans {
        uuid:String!
        activePlan:String!
        name:String!
        tag:String!
        price:Float!
        booking_commision:String!
        fee:String!
        desc:String!
        cta:String!
        popular:Boolean!
        maxVenues:Float!
        maxCourt:Float!
        everything:String!
        features:[String!]!
        support:String! 
    }

    type LogoutResponse {
        success: Boolean!
        message: String!
    }


    input venueBasicInput {
        venueName: String!
        venueType: String!
        address: String!
        city: String
        locationId: String
        locationUrl: String
        iframeSrc: String
        pincode: String!
        description: String
        venueId: String
    }

    input CourtInput {
        courtName: String!
        courtType: String!
        surface: String!
        sports: [String!]!
        openTime: String!
        closeTime: String!
        openDays: [String!]!
        peakStart: String
        peakEnd: String
        venueId: String!
        courtId: String
    }

    input VenuePhotoInput {
        index: Int!
        url: String!
    }

    input UpdateCourtInput {
        courtId: String!
        status: String
        statusNote: String
        isActive: Boolean
    }

    input BlackoutInput {
        blackoutId: String
        venueId: String
        startDate: String
        endDate: String
        reason: String
        scope: String
        courts: [String]
        type: String
        repeatsYearly: Boolean
    }

    input VenueActionInput {
        venueId: String!
        action: String!
    }

    input SportPriceInput {
        priceId:String
        courtId: String!
        sport: String!
        playersCapacity: Int!
        offPeakRate: Float!
        peakRate: Float!
        slotLength: Int!
        minimumBooking: Int!
        smartPricing: Boolean!
        slots: [SportPriceSlotsInput]
    }

    input SportPriceSlotsInput {
        fromTime: String
        toTime: String
        label: String
    }

    input KycInput {
        bankName: String!
        accountHolderName: String!
        accountNumber: String!
        reEnterAccountNumber: String!
        ifscCode: String!
        accountType: String!
    }

    input KycDocInput {
        panCardUrl: String!
        panCardName: String
        panCardSize: Int
        
        aadharUrl: String!
        aadharName: String
        aadharSize: Int

        propertyProofUrl: String!
        propertyProofName: String
        propertyProofSize: Int

        gstCertificateUrl: String
        gstCertificateName: String
        gstCertificateSize: Int
    }

    input BookingActionInput {
        bookingId: String!
        action: String!
        refundType: String
        notifyCustomer: Boolean
    }

    input CreateWalkInBookingInput {
        venueId: String!
        courtId: String!
        sport: String!
        date: String!
        fromTime: String!
        toTime: String!
        customerName: String!
        customerPhone: String!
        paymentMethod: String!
        slots: [BookingSlotInput!]!,
        totalSlots: Int!
        notifyCustomer: Boolean
    }

    input BookingSlotInput {
        fromTime: String!
        toTime: String!
    }

    input ReplyToReviewInput {
        reviewId: String!
        reply: String!
    }

    input ResolveDisputeInput {
        disputeId: String!
        action: String!
        response: String
    }

    type CancellationPolicyPreview {
        label: String!
        value: String!
        color: String
    }

    type VenuePolicy {
        cancellationPolicy: String
        policyPreview: [CancellationPolicyPreview]
    }

    input CancellationPolicyPreviewInput {
        label: String!
        value: String!
        color: String
    }

    enum PaymentType {
        NEW
        RENEWAL
        UPGRADE
    }

    input CreatePaymentInput {
        type: PaymentType!
        activePlan: String!
        billingPeriod: String!
        customerName: String!
        customerEmail: String!
        customerPhone: String!
        promoCode: String
    }

    type PaymentSessionResponse {
        sessionId: String!
        total: Float!
    }

    # ─── Apply Coupon Input and Response ───────────────────────────────────────────────────────
    type ApplyPromoCodeResponse {
        status: Boolean!
        message: String!
        promoCode: String
        discountAmount: Float
        finalAmount: Float
    }

    input ApplyPromoCodeInput {
        promoCode: String!
    }

    type RenewalPreview {
      activePlan:String!
      planName:String!,
      planAmount:Float!,
      billingPeriod: String!,
      currentPeriodStart: String!,
      currentPeriodEnd: String!,
      overdueDays: String!,
      taxAmount: Float!,
      payable: Float!
    }

    type UpgradePreview {
        currentPlan: String
        currentPlanName: String
        currentPlanSupport:String
        currentPlanCommission:String,
        currentPlanAmount: Float
        currentBillingPeriod:String
        targetPlan: String
        targetPlanName: String
        targetPlanSupport:String
        targetPlanCommission:String
        targetPlanBillingPeriod:String
        targetPlanAmount: Float
        oldPeriodStart: Float
        oldPeriodEnd: Float
        newPeriodStart: Float
        newPeriodEnd: Float
        totalPlanValue: Float
        daysUsed: Int
        daysRemaining: Int
        amountUsed: Float
        unusedCredit: Float
        gst: Float
        totalPayable: Float
        courtsGained: Int
        venuesGained: Int
    } 

     # ─── Tournament Input and Response ───────────────────────────────────────────────────────
     enum TournamentStatus {
            DRAFT
            IN_REVIEW
            PUBLISHED
     }

     input TournamentInput {
        tournamentId: String
        tournamentName: String
        banner: String
        sport: String
        venueId: String
        maxTeams: Int
        format: String
        stages: [TournamentStageInput!]
        schedule: [TournamentScheduleInput!]
        entriesClose: TournamentEntryCloseInput
        courts: [String!]
        overs: Int
        matchMinutes: Int
        rules: [String!]
        pool: String
        awards: [TournamentAwardsInput!]
        entryFee: Float
        gatherFrom: String             
        collect: TournamentCollectInput
        sponsors: [TournamentSponsorInput!]
        status: TournamentStatus
        completed_step: Float
    }

    input TournamentStageInput {
        stage: String!
        title: String!
        startDate: String!
        endDate: String!
        desc: String
    }

    input TournamentScheduleInput {
        date: String!
        startTime: String!
        endTime: String!
        title: String!
    }

    input TournamentEntryCloseInput {
        date: String!
        time: String!
    }

    input TournamentAwardsInput  {
        name: String!
        prize: String!
    }

    input TournamentSponsorInput {
        name: String!
        role: String!
    }

    input TournamentCollectInput {
        names: Boolean!
        phones: Boolean!
        skill: Boolean!
        jersey: Boolean!
        govid: Boolean!
    }

    

    type TournamentStage {
        stage: String!
        title: String!
        startDate: String!
        endDate: String!
        desc: String
    }

    type TournamentSchedule {
        date: String!
        startTime: String!
        endTime: String!
        title: String!
    }

    type TournamentEntryClose {
        date: String!
        time: String!
    }

    type TournamentAwards {
        name: String!
        prize: String!
    }

    type TournamentResponse {
        success: Boolean!
        message: String!
        tournamentId: String!
    }

    type TournamentSponsor {
        name: String!
        role: String!
    }

    type TournamentCollect {
        names: Boolean!
        phones: Boolean!
        skill: Boolean!
        jersey: Boolean!
        govid: Boolean!
    }

    type Tournament {
        userId: String!
        tournamentId: String!
        tournamentName: String!
        banner: String
        sport: String
        venueId: String
        maxTeams: Int
        format: String
        stages: [TournamentStage!]
        schedule: [TournamentSchedule!]
        entriesClose: TournamentEntryClose
        courts: [String!]
        overs: Int
        matchMinutes: Int
        rules: [String!]
        pool: String
        awards: [TournamentAwards!]
        entryFee: Float
        gatherFrom: String
        collect: TournamentCollect
        sponsors: [TournamentSponsor!]
        completed_step:Float
        status: String
        createdAt: Float
        updatedAt: Float
    }
    type KnockoutFormat {
        uuid: String!
        name: String!
        desc: String
        meta: String
        soon: Boolean
        isDefault: Boolean
    }

     # ─── Tournament Input and Response ───────────────────────────────────────────────────────


    type Query {
        getUser: User
        getPlanHistory: [PlanHistory]
        getAllSports: [Sport]
        getCourts(venueId: String!): [Court]
        getVenue: [VenueBasic]
        getOverviewHeatMap(venueId: String!): [OverviewHeatMap]
        getOverviewStat(venueId: String!): OverviewStat
        getVenueSetting(venueId: String!): VenueSetting #settings fPage
        getCalendar(venueId: String!,courtId: String!,sport:String!, date: String!, view: String): Calendar
        getBookingDetail(bookingId: String!): BookingDetail 
        getWalkInSlotInfo(venueId: String!, courtId: String!, date: String!, fromTime: String!, toTime: String!): WalkInSlotInfo
        calculateWalkInPrice(courtId: String!, sport: String!, fromTime: String, toTime: String, customAmount: Float): WalkInPrice
        getBookingStat(venueId: String!): BookingStat
        getOverallBookingStat(venueId: String): OverallBookingStat
        getOverallEarningsStat(venueId: String): OverallEarningsStat
        getBookingFullDetail(bookingId: String!): BookingFullDetail
        getCustomerStat(venueId: String!): CustomerStat # customer stat(today)
        getCustomerBook(venueId: String!): CustomerBook #customer book
        getCustomerProfile(venueId: String!, customerPhone: String!): CustomerProfile  #customer profile(review,account info,last visits)
        getReviewStat(venueId: String!): ReviewStat #review stat(summary,distribution,mentions,reviews)
        getPayoutStat(venueId: String!): PayoutStat # get payout Details or HiStory
        getInsightStat(venueId: String!): InsightStat    # only for insight
        getInsightSportMix(venueId: String!): InsightSportMix
        getInsightRevenueByCourt(venueId: String!, courtId: String): InsightRevenueByCourt
        getInsightRepeatCohort(venueId: String!, courtId: String): InsightRepeatCohort   
        getInsightCancellations(venueId: String!, courtId: String): InsightCancellations
        getAdminStat: AdminStat #over allvenue stat
        getAdminPayouts: AdminPayouts
        getAdminSportMix: AdminSportMix
        getAdminVenueList(filter: String): AdminVenueList
        getAdminBookingStat: AdminBookingStat
        getAdminBookingList(venueId: String, filter: String, limit: Int, offset: Int): AdminBookingList
        getAdminDisputeStat: AdminDisputeStat # Dispute stat for admin dashboard
        getAdminDisputeList: AdminDisputeList
        getAdminDisputeDetail(disputeId: String!): AdminDisputeDetail
        getSubscription: UserSubscription
        getVenueCourtUtilisation(venueId: String! sport: String! date: String!): [CourtUtilisation]
        getCourtSlots(courtId:String!sport:String!date:String!): [CourtSlot!]!
        getLocations:[Location]
        getPlans: [Plans]
        getRenewalPreview: RenewalPreview
        getUpgradePreview(upgradingPlan: String!, billingPeriod: String!): UpgradePreview

        #Tournament
        fetchTournament(tournamentId: String!): Tournament
        getKnockoutFormats:[KnockoutFormat]

        # Admin
        getSuperAdmin: Admin
        getSuperAdminOverview(days: [String]): AdminOverview
        getSuperAdminVenues(status: [String]): [Venue]
        getSuperAdminVenue(id: String): Venue
        getSuperAdminOwners(status: [String]): [User]
        getSuperAdminOwner(id: String): User
        getSuperAdminCustomers: [Customer]
        getSuperAdminCustomer(id: String): Customer
        getSuperAdminBookings(venueId: String, customerId: String): [BookingItem]
        getSuperAdminBooking(id: String): BookingItem
        getSuperAdminSports: [Sport]
        getSuperAdminReviews: [Review]
        getSuperAdminDisputes(status: [String]): [Dispute]
        getSuperAdminDispute(id: String): Dispute
        getSuperAdminPayouts: [Payout]
        getSuperAdminAudits: [Audit]

    }

    type Mutation {
        UploadUrl(fileType: String!): AzureSasToken!
        sendPhoneOTP(phone: String!): OtpResponse!
        verifyPhoneOTP(phone: String!, otp: String): VerifyOtpResponse!
        logout: LogoutResponse!
        createAccount( input: CreateAccountInput! ): CreateAccountResponse!
        createVenue(input: venueBasicInput): CreateVenueResponse
        updateVenuePhotos(photoUrls: [String!]!, venueId: String!): CreateVenuePhotosResponse!
        createCourt(input: CourtInput!): Court!
        deleteCourt(courtId: String!): String!
        createSportPrice(input: SportPriceInput!): SportPrice!
        deleteSportPrice(courtId: String!, priceId: String!): Boolean!
        updateAmenities( courtId: String!, venueId: String!, amenities: [String!]!): Court!
        updateCancellationPolicy(policy: String!, venueId: String!, policy_preview: [CancellationPolicyPreviewInput]!): Venue!
        updateKycDetails(input: KycInput!): User!
        updateKycDoc(input: KycDocInput!): KycDoc!
        reviewVenue(venueId: String!): Venue!
        updateCourt(input: UpdateCourtInput!): CourtItem!  # Toggle court active
        updateManageBlackout(input: BlackoutInput!, action: String!): BlackoutItem  # Add blackout
        updateVenueAction(input: VenueActionInput!): String!  # Pause venue
        bookingAction(input: BookingActionInput!): BookingActionResponse!
        createWalkInBooking(input: CreateWalkInBookingInput!): WalkInBookingResponse!
        replyToReview(input: ReplyToReviewInput!): ReplyToReviewResponse!
        resolveDispute(input: ResolveDisputeInput!): ResolveDisputeResponse!
        updateSubscription(plan: String!): SubscriptionResult
        
        adminLogin(email: String, password: String): String
        adminApproveVenue(venueId: String, status: String, reason: String): String
        adminVerifyOwnerDoc(ownerId: String, doc: String): String
        adminApproveOwner(ownerId: String, status: String, reason: String, docs: [String]): String
        adminUpdateDispute(id: String, status: String): String

        createPaymentSession(input: CreatePaymentInput!): PaymentSessionResponse!
        applyPromoCode(input: ApplyPromoCodeInput!): ApplyPromoCodeResponse!
        savePendingPlan(input: PendingPlanInput!): Boolean!

        # ─── Tournament Mutation ───────────────────────────────────────────────────────
        createUpdateTournament(input: TournamentInput!): TournamentResponse!



        # ─── Tournament Mutation ───────────────────────────────────────────────────────
        

    }
`;