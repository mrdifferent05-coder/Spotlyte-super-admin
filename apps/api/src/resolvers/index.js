// resolvers/index.js — merge all resolver maps.
import { JSONScalar, UploadScalar } from './scalars.js';
import { authResolvers } from './auth.js';
import { overviewResolvers } from './overview.js';
import { ownersResolvers } from './owners.js';
import { venuesResolvers } from './venues.js';
import { bookingsResolvers } from './bookings.js';
import { usersResolvers } from './users.js';
import { reviewsResolvers } from './reviews.js';
import { payoutsResolvers } from './payouts.js';
import { invoicesResolvers } from './invoices.js';
import { promosResolvers } from './promos.js';
import { advertisingResolvers } from './advertising.js';
import { disputesResolvers } from './disputes.js';
import { auditResolvers } from './audit.js';
import { legacyResolvers } from './legacy.js';

const maps = [
  authResolvers,
  overviewResolvers,
  ownersResolvers,
  venuesResolvers,
  bookingsResolvers,
  usersResolvers,
  reviewsResolvers,
  payoutsResolvers,
  invoicesResolvers,
  promosResolvers,
  advertisingResolvers,
  disputesResolvers,
  auditResolvers,
  legacyResolvers,
];

export const resolvers = {
  JSON: JSONScalar,
  Upload: UploadScalar,
  Query: Object.assign({}, ...maps.map((m) => m.Query || {})),
  Mutation: Object.assign({}, ...maps.map((m) => m.Mutation || {})),
};
