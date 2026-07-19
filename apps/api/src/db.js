// db.js — the ONLY place a MongoClient is created. Native driver, no ODM.
import { MongoClient } from 'mongodb';

let client;
let db;
let indexesEnsured = false;
let testMode = false;

// Test seam: lets the offline test harness inject an in-memory driver fake.
// Never used in production paths.
export function __setTestDb(instance) {
  db = instance;
  testMode = true;
}

export async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  // Fail fast with a clear error when MongoDB isn't reachable instead of the
  // driver's 30s server-selection hang.
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  db = client.db('spotlyte');
  if (!indexesEnsured) {
    await ensureIndexes(db);
    indexesEnsured = true;
  }
  return db;
}

export async function closeDb() {
  if (testMode) return; // harness owns the fake instance's lifecycle
  if (client) await client.close();
  client = undefined;
  db = undefined;
  indexesEnsured = false;
}

// Idempotent index creation, run once on boot (and by the seed script).
export async function ensureIndexes(db) {
  await Promise.all([
    db.collection('owners').createIndexes([
      { key: { ownerId: 1 }, unique: true },
      { key: { kyc: 1 } },
      { key: { city: 1 } },
      { key: { name: 'text', biz: 'text' } },
    ]),
    db.collection('venues').createIndexes([
      { key: { venueId: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { ownerId: 1 } },
      { key: { city: 1 } },
    ]),
    db.collection('bookings').createIndexes([
      { key: { bookingId: 1 }, unique: true },
      { key: { venueId: 1 } },
      { key: { customerId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
      { key: { payoutId: 1 } },
    ]),
    db.collection('customers').createIndexes([
      { key: { userId: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { email: 1 } },
    ]),
    db.collection('reviews').createIndexes([
      { key: { reviewId: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { venueId: 1 } },
    ]),
    db.collection('payouts').createIndexes([
      { key: { payoutId: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { ownerId: 1 } },
      { key: { periodTo: -1 } },
    ]),
    db.collection('invoices').createIndexes([
      { key: { invoiceId: 1 }, unique: true },
      { key: { audience: 1, status: 1 } },
      { key: { partyId: 1 } },
    ]),
    db.collection('promos').createIndexes([{ key: { code: 1 }, unique: true }]),
    db.collection('adPlacements').createIndexes([
      { key: { adId: 1 }, unique: true },
      { key: { status: 1 } },
    ]),
    db.collection('disputes').createIndexes([
      { key: { disputeId: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { venueId: 1 } },
    ]),
    db.collection('auditLogs').createIndexes([
      { key: { createdAt: -1 } },
      { key: { type: 1 } },
      { key: { actor: 'text', action: 'text', target: 'text', ref: 'text' } },
    ]),
    db.collection('admins').createIndexes([{ key: { email: 1 }, unique: true }]),
    db.collection('counters').createIndexes([{ key: { _id: 1 } }]),
  ]);
}
