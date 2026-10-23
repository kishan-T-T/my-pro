import { AppError } from './AppError.js';

/**
 * Converts a Supabase/PostgREST error into an AppError and throws it.
 * Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const handleSupabaseError = (error) => {
  if (!error) return;

  let appError;
  switch (error.code) {
    case '22P02': // invalid_text_representation (e.g. malformed uuid)
      appError = new AppError('Invalid ID format provided.', 400);
      break;
    case '23503': // foreign_key_violation
      appError = new AppError(
        'A referenced record does not exist or is still in use.',
        400
      );
      break;
    case '23505': // unique_violation (handled by errorController as duplicate)
      appError = new AppError(error.message, 400);
      break;
    case '23514': // check_violation
    case '23502': // not_null_violation
      appError = new AppError(`Invalid input data. ${error.message}`, 400);
      break;
    default:
      // Unexpected database error: don't leak details to clients in production.
      appError = new AppError(error.message || 'Database error', 500);
      appError.isOperational = false;
  }
  appError.code = error.code;
  throw appError;
};

/**
 * Applies a Mongoose-style select spec ('a b' or '-a -b' or {a:1}) to a result.
 */
const applySelect = (result, spec) => {
  if (!spec || result === null || result === undefined) return result;

  const tokens =
    typeof spec === 'string'
      ? spec.split(/\s+/).filter(Boolean)
      : Object.entries(spec).map(([k, v]) => (v ? k : `-${k}`));
  if (!tokens.length) return result;

  const excludes = tokens.filter((t) => t.startsWith('-')).map((t) => t.slice(1));
  const includes = tokens.filter((t) => !t.startsWith('-') && !t.startsWith('+'));

  const shape = (doc) => {
    if (!doc || typeof doc !== 'object') return doc;
    if (includes.length) {
      const picked = {};
      ['_id', 'id', ...includes].forEach((key) => {
        if (key in doc) picked[key] = doc[key];
      });
      return picked;
    }
    const copy = { ...doc };
    excludes.forEach((key) => delete copy[key]);
    return copy;
  };

  return Array.isArray(result) ? result.map(shape) : shape(result);
};

/**
 * Returns a lazy, Mongoose-like query: supports .sort() .select() .populate()
 * .lean() .exec() and can be awaited. The executor receives the chain state.
 */
export const createChainableQuery = (executor) => {
  const state = { sortSpec: null, selectSpec: null, populateSpecs: [] };
  let promise = null;

  const run = () => {
    if (!promise) {
      promise = (async () => {
        const result = await executor(state);
        return applySelect(result, state.selectSpec);
      })();
    }
    return promise;
  };

  const chain = {
    sort(spec) {
      state.sortSpec = spec;
      return chain;
    },
    select(spec) {
      state.selectSpec = spec;
      return chain;
    },
    populate(spec) {
      state.populateSpecs.push(spec);
      return chain;
    },
    lean() {
      return chain;
    },
    exec() {
      return run();
    },
    then(onFulfilled, onRejected) {
      return run().then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return run().catch(onRejected);
    },
    finally(onFinally) {
      return run().finally(onFinally);
    },
  };
  return chain;
};

const isIdValue = (value) =>
  typeof value === 'string' || typeof value === 'number';

// Walks `segments` down from `node`, collecting every object that owns the leaf.
const collectHolders = (node, segments, out) => {
  if (node === null || node === undefined || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectHolders(item, segments, out));
    return;
  }
  if (!segments.length) {
    out.push(node);
    return;
  }
  collectHolders(node[segments[0]], segments.slice(1), out);
};

/**
 * Mongoose-style populate. Replaces id references with full documents.
 *
 *   populateByPath(docs, 'user extraDetails.user', fetchByIds)
 *   populateByPath(docs, { path: 'author.user assignee.user' }, fetchByIds)
 *
 * `docs` may be one document or an array. `fetchByIds(ids)` must resolve to a
 * Map of id -> formatted document. Missing references become null (as in Mongoose).
 */
export const populateByPath = async (docs, optionsOrPath, fetchByIds) => {
  if (!docs) return docs;

  const pathSpec =
    typeof optionsOrPath === 'string' ? optionsOrPath : optionsOrPath?.path;
  if (!pathSpec) return docs;

  const roots = Array.isArray(docs) ? docs : [docs];

  for (const path of pathSpec.split(/\s+/).filter(Boolean)) {
    const segments = path.split('.');
    const leaf = segments.pop();

    const holders = [];
    roots.forEach((root) => collectHolders(root, segments, holders));

    const ids = [
      ...new Set(
        holders.map((h) => h[leaf]).filter(isIdValue).map((v) => String(v))
      ),
    ];
    if (!ids.length) continue;

    const map = await fetchByIds(ids);
    holders.forEach((holder) => {
      const value = holder[leaf];
      if (isIdValue(value)) {
        holder[leaf] = map.get(String(value)) ?? null;
      }
    });
  }

  return docs;
};
