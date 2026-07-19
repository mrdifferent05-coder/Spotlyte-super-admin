// fake-mongo.mjs — in-memory MongoDB driver fake backed by mingo.
// Implements exactly the surface the spotlyte API uses.
import { Aggregator, Query } from 'mingo';

function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
let oid = 1;

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}

function applyUpdate(doc, update) {
  for (const [op, fields] of Object.entries(update)) {
    if (op === '$set') for (const [k, v] of Object.entries(fields)) setPath(doc, k, clone(v));
    else if (op === '$inc') for (const [k, v] of Object.entries(fields)) setPath(doc, k, (getPath(doc, k) || 0) + v);
    else if (op === '$push') for (const [k, v] of Object.entries(fields)) {
      const arr = getPath(doc, k) || [];
      arr.push(clone(v));
      setPath(doc, k, arr);
    }
    else if (op === '$unset') for (const k of Object.keys(fields)) setPath(doc, k, undefined);
    else if (op === '$setOnInsert') { /* handled at insert time */ }
    else throw new Error(`fake-mongo: unsupported update op ${op}`);
  }
}

class Cursor {
  constructor(docs) { this.docs = docs; }
  sort(spec) {
    const keys = Object.entries(spec || {});
    this.docs = [...this.docs].sort((a, b) => {
      for (const [k, dir] of keys) {
        const x = getPath(a, k), y = getPath(b, k);
        if (x == null && y == null) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        if (x < y) return dir >= 0 ? -1 : 1;
        if (x > y) return dir >= 0 ? 1 : -1;
      }
      return 0;
    });
    return this;
  }
  skip(n) { this.docs = this.docs.slice(n || 0); return this; }
  limit(n) { if (n != null) this.docs = this.docs.slice(0, n); return this; }
  async toArray() { return this.docs.map(clone); }
}

class FakeCollection {
  constructor(db, name) {
    this.db = db;
    this.name = name;
    if (!db.__store[name]) db.__store[name] = [];
  }
  get docs() { return this.db.__store[this.name]; }
  set docs(v) { this.db.__store[this.name] = v; }

  _match(filter = {}) {
    if (!Object.keys(filter).length) return [...this.docs];
    const q = new Query(filter);
    return this.docs.filter((d) => q.test(d));
  }

  find(filter = {}) { return new Cursor(this._match(filter)); }
  async findOne(filter = {}, _opts) {
    const hit = this._match(filter)[0];
    return hit ? clone(hit) : null;
  }
  async countDocuments(filter = {}) { return this._match(filter).length; }
  async insertOne(doc) {
    const d = clone(doc);
    if (d._id === undefined) d._id = `oid_${oid++}`;
    this.docs.push(d);
    return { insertedId: d._id };
  }
  async insertMany(docsIn) {
    for (const doc of docsIn) await this.insertOne(doc);
    return { insertedCount: docsIn.length };
  }
  async updateOne(filter, update, opts = {}) {
    const hits = this._match(filter);
    if (!hits.length) {
      if (opts.upsert) {
        const base = {};
        for (const [k, v] of Object.entries(filter)) if (typeof v !== 'object' || v === null) base[k] = v;
        if (update.$setOnInsert) Object.assign(base, clone(update.$setOnInsert));
        const idx = this.docs.length;
        await this.insertOne(base);
        applyUpdate(this.docs[idx], update);
        return { matchedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }
    const target = this.docs.find((d) => d === hits[0] || (hits[0]._id !== undefined && d._id === hits[0]._id));
    applyUpdate(target, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async updateMany(filter, update) {
    const q = new Query(filter);
    let n = 0;
    for (const d of this.docs) if (q.test(d)) { applyUpdate(d, update); n++; }
    return { matchedCount: n, modifiedCount: n };
  }
  async deleteMany(filter = {}) {
    const before = this.docs.length;
    if (!Object.keys(filter).length) this.docs = [];
    else {
      const q = new Query(filter);
      this.docs = this.docs.filter((d) => !q.test(d));
    }
    return { deletedCount: before - this.docs.length };
  }
  async findOneAndUpdate(filter, update, opts = {}) {
    let target = this.docs.find((d) => new Query(filter).test(d));
    if (!target && opts.upsert) {
      const base = {};
      for (const [k, v] of Object.entries(filter)) if (typeof v !== 'object' || v === null) base[k] = v;
      if (update.$setOnInsert) Object.assign(base, clone(update.$setOnInsert));
      await this.insertOne(base);
      target = this.docs[this.docs.length - 1];
    }
    if (!target) return null;
    applyUpdate(target, update);
    return opts.returnDocument === 'after' ? clone(target) : clone(target);
  }
  aggregate(pipeline) {
    const agg = new Aggregator(pipeline, {
      collectionResolver: (name) => this.db.__store[name] || [],
    });
    const out = agg.run(this.docs.map(clone));
    return { async toArray() { return out; } };
  }
  async createIndexes() { return []; }
  async createIndex() { return 'ok'; }
}

export function createFakeDb() {
  const db = {
    __store: {},
    collection(name) { return new FakeCollection(db, name); },
    async command() { return { ok: 1 }; },
  };
  return db;
}
