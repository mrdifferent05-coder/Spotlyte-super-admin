// autoflag.js — review auto-flag rules (Section 8.9). Applied whenever a
// review enters the system (seed / consumer app ingestion path).
const PHONE_RX = /(?:\+?91[\s-]?)?[6-9]\d{9}/;
const URL_RX = /https?:\/\/|www\.|bit\.ly|t\.co\//i;
const SPAM_WORDS = ['spam', 'fake', 'scam', 'scammer', 'fraud', 'call me', 'whatsapp me'];
const PROFANITY = ['bloody', 'damn', 'stupid', 'idiot', 'bastard'];

export const DEFAULT_RULES = { phoneNumbers: true, urls: true, spamWords: true, profanity: true };

export async function getRules(db) {
  const doc = await db.collection('settings').findOne({ _id: 'autoflag' });
  return doc?.rules || DEFAULT_RULES;
}

// Returns { flagged, flags, reasons } for a review text under the given rules.
export function checkReview(text = '', rules = DEFAULT_RULES) {
  const t = text.toLowerCase();
  const reasons = [];
  if (rules.phoneNumbers && PHONE_RX.test(text)) reasons.push('phone number');
  if (rules.urls && URL_RX.test(text)) reasons.push('URL');
  if (rules.spamWords) {
    const hits = SPAM_WORDS.filter((w) => t.includes(w));
    if (hits.length) reasons.push('spam wording');
    // repetition: same word ≥3 times in a row reads as spam
    if (/\b(\w{3,})\b(?:\W+\1\b){2,}/i.test(text)) reasons.push('repetition');
  }
  if (rules.profanity && PROFANITY.some((w) => t.includes(w))) reasons.push('profanity');
  return { flagged: reasons.length > 0, flags: reasons.length * 2 + (reasons.length ? 1 : 0), reasons };
}
