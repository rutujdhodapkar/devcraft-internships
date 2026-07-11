import { CosmosClient } from '@azure/cosmos';

let _client = null;
let _db = null;
let _container = null;
let _syncContainer = null; // dedicated SyncVersions container, partition key /userId
let _initPromise = null;

function cleanDoc(doc) {
  if (!doc) return undefined;
  const { entityType, _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
}

function setNested(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object') current[k] = {};
    current = current[k];
  }
  current[keys[keys.length - 1]] = value;
}

// ── Firestore-compatible FieldValue ──
export const FieldValue = {
  increment(n) {
    return { __increment: n };
  },
};

// ── DocumentSnapshot ──
class DocumentSnapshot {
  constructor(resource) {
    this._resource = resource;
    this.exists = !!resource;
    this.id = resource?.id || null;
  }
  data() {
    return this._resource ? cleanDoc(this._resource) : undefined;
  }
}

// ── QuerySnapshot ──
class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  forEach(cb) { this.docs.forEach(cb); }
}

// ── DocumentReference ──
class DocumentReference {
  constructor(container, collection, id) {
    this.container = container;
    this.collection = collection;
    this.id = id;
  }

  // options may carry a Cosmos request option such as { consistencyLevel: "Eventual" }.
  // Non-critical reads (badges, task templates, sync version stamps) intentionally use
  // Eventual consistency to save RU and latency; transactional writes go through set/update
  // which default to Session+ so a subsequent read sees its own write.
  async get(options = {}) {
    try {
      const { resource } = await this.container.item(this.id, this.collection).read(options);
      return new DocumentSnapshot(resource);
    } catch (e) {
      if (e.code === 404) return new DocumentSnapshot(null);
      throw e;
    }
  }

  async set(data, options = {}) {
    const merge = options && options.merge === true;
    if (merge) {
      try {
        const { resource } = await this.container.item(this.id, this.collection).read();
        if (resource) {
          const merged = { ...resource };
          for (const [key, value] of Object.entries(data)) {
            if (key.includes('.')) {
              setNested(merged, key, value);
            } else {
              merged[key] = value;
            }
          }
          merged.id = this.id;
          merged.entityType = this.collection;
          await this.container.items.upsert(merged);
          return;
        }
      } catch (e) {
        if (e.code !== 404) throw e;
      }
    }
    const doc = { ...data, id: this.id, entityType: this.collection };
    await this.container.items.upsert(doc);
  }

  async update(data) {
    try {
      const { resource } = await this.container.item(this.id, this.collection).read();
      const merged = resource ? { ...resource } : {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && value.__increment !== undefined) {
          if (key.includes('.')) {
            const keys = key.split('.');
            const leaf = keys.pop();
            let obj = merged;
            for (const k of keys) {
              if (!(k in obj) || typeof obj[k] !== 'object') obj[k] = {};
              obj = obj[k];
            }
            obj[leaf] = (Number(obj[leaf] || 0)) + value.__increment;
          } else {
            merged[key] = (Number(merged[key] || 0)) + value.__increment;
          }
        } else if (key.includes('.')) {
          setNested(merged, key, value);
        } else {
          merged[key] = value;
        }
      }
      merged.id = this.id;
      merged.entityType = this.collection;
      await this.container.items.upsert(merged);
    } catch (e) {
      if (e.code === 404) {
        await this.set(data);
      } else throw e;
    }
  }

  async delete() {
    try {
      await this.container.item(this.id, this.collection).delete();
    } catch (e) {
      if (e.code !== 404) throw e;
    }
  }
}

// ── QueryBuilder (chainable .where / .orderBy / .limit) ──
class QueryBuilder {
  constructor(container, collection, filters = [], orderField = null, orderDir = 'asc', limitCount = null) {
    this.container = container;
    this.collection = collection;
    this.filters = filters;
    this.orderField = orderField;
    this.orderDir = orderDir;
    this.limitCount = limitCount;
  }

  where(field, op, value) {
    return new QueryBuilder(this.container, this.collection,
      [...this.filters, { field, op, value }],
      this.orderField, this.orderDir, this.limitCount);
  }

  orderBy(field, dir = 'asc') {
    return new QueryBuilder(this.container, this.collection,
      this.filters, field, dir, this.limitCount);
  }

  limit(n) {
    return new QueryBuilder(this.container, this.collection,
      this.filters, this.orderField, this.orderDir, n);
  }

  async get() {
    const conditions = [`c.entityType = @type`];
    const params = [{ name: '@type', value: this.collection }];

    this.filters.forEach((f, i) => {
      const pName = `@p${i}`;
      conditions.push(`c["${f.field}"] ${f.op === '==' ? '=' : f.op} ${pName}`);
      params.push({ name: pName, value: f.value });
    });

    let query = `SELECT * FROM c WHERE ${conditions.join(' AND ')}`;
    if (this.orderField) {
      query += ` ORDER BY c["${this.orderField}"] ${this.orderDir.toUpperCase()}`;
    }
    if (this.limitCount) {
      query += ` OFFSET 0 LIMIT ${this.limitCount}`;
    }

    const { resources } = await this.container.items.query({ query, parameters: params }).fetchAll();
    return new QuerySnapshot(resources.map(r => new DocumentSnapshot(r)));
  }
}

// ── CollectionReference ──
class CollectionReference {
  constructor(container, name) {
    this.container = container;
    this.name = name;
  }

  doc(id) {
    return new DocumentReference(this.container, this.name, id);
  }

  async get() {
    return new QueryBuilder(this.container, this.name).get();
  }

  async add(data) {
    const id = `${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.doc(id).set(data);
    return { id };
  }

  where(field, op, value) {
    return new QueryBuilder(this.container, this.name, [{ field, op, value }]);
  }

  orderBy(field, dir = 'asc') {
    return new QueryBuilder(this.container, this.name, [], field, dir);
  }

  limit(n) {
    return new QueryBuilder(this.container, this.name, [], null, 'asc', n);
  }

  async listDocuments() {
    const { resources } = await this.container.items.query({
      query: 'SELECT c.id FROM c WHERE c.entityType = @type',
      parameters: [{ name: '@type', value: this.name }],
    }).fetchAll();
    return resources.map(r => new DocumentReference(this.container, this.name, r.id));
  }
}

// ── Batch ──
class BatchWrapper {
  constructor(db) {
    this.db = db;
    this.ops = [];
  }
  update(ref, data) { this.ops.push({ type: 'update', ref, data }); }
  set(ref, data, opts) { this.ops.push({ type: 'set', ref, data, opts }); }
  delete(ref) { this.ops.push({ type: 'delete', ref }); }
  async commit() {
    for (const op of this.ops) {
      try {
        if (op.type === 'update') await op.ref.update(op.data);
        else if (op.type === 'set') await op.ref.set(op.data, op.opts);
        else if (op.type === 'delete') await op.ref.delete();
      } catch (e) {
        console.error('[Cosmos Batch]', e.message);
      }
    }
  }
}

// ── FirestoreWrapper (main db object) ──
class FirestoreWrapper {
  constructor(container) {
    this.container = container;
  }
  collection(name) {
    return new CollectionReference(this.container, name);
  }
  batch() {
    return new BatchWrapper(this);
  }
}

// ── SyncVersions container (partition key /userId) ──────────────────────────
// Holds one small doc per user: { id: "versions:<userId>", userId, tasks,
// badges_combined, certs, computedAt }. Reads are POINT READS by id + partition
// key (never a cross-partition query), which is what makes the version check O(1)
// and cheap. The container is created on first init if it doesn't exist.
export const SYNC_CONTAINER_ID = process.env.COSMOS_DB_SYNC_CONTAINER || 'syncversions';
const SYNC_PK = '/userId';

export function syncContainer() {
  return _syncContainer;
}

// POINT READ by id + partition key /userId. Returns the doc or null. This is the
// only Cosmos operation the per-load version check performs.
export async function getSyncVersion(userId) {
  if (!_syncContainer || !userId) return null;
  try {
    const { resource } = await _syncContainer
      .item(`versions:${userId}`, userId)
      .read();
    return resource || null;
  } catch (e) {
    if (e.code === 404) return null;
    throw e;
  }
}

export async function putSyncVersion(doc) {
  if (!_syncContainer) return;
  await _syncContainer.items.upsert(doc);
}

// ── Init ──
export async function initCosmosDb() {
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) {
    console.warn('[Cosmos] COSMOS_DB_CONNECTION_STRING not configured');
    return null;
  }
  if (_container) return new FirestoreWrapper(_container);
  if (_initPromise) {
    await _initPromise;
    return _container ? new FirestoreWrapper(_container) : null;
  }
  _initPromise = (async () => {
    try {
      _client = new CosmosClient(connStr);
      _db = _client.database(process.env.COSMOS_DB_DATABASE || 'devcraft');
      _container = _db.container(process.env.COSMOS_DB_CONTAINER || 'main');
      // Dedicated SyncVersions container with /userId partition key.
      const { container: syncC } = await _db.containers.createIfNotExists({
        id: SYNC_CONTAINER_ID,
        partitionKey: SYNC_PK,
      });
      _syncContainer = syncC;
      console.log('[Cosmos] Connected');
      return _container;
    } catch (e) {
      console.error('[Cosmos] Init failed:', e.message);
      return null;
    }
  })();
  await _initPromise;
  return _container ? new FirestoreWrapper(_container) : null;
}
