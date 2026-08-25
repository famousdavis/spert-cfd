// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Normalizes a Firestore `updatedAt` value to an ISO 8601 string.
 *
 * WHY THIS EXISTS
 * ---------------
 * `Project.updatedAt` is typed `string`, and `project-row.tsx` formats it with
 * date-fns `format(new Date(value))`. `format()` throws `RangeError` on an
 * Invalid Date, so every shape that is not a parseable date CRASHES the project
 * row rather than degrading. Measured against the installed date-fns 4.1.0,
 * six shapes throw: a client `Timestamp`, both plain map spellings, the
 * unresolved `serverTimestamp()` sentinel, `undefined`, and any string
 * `Date.parse` rejects (`''` included).
 *
 * Suite writers do not agree on a type. Until Brief 19 the invitation Cloud
 * Functions wrote `Date.now()` and `FieldValue.serverTimestamp()` into
 * `spertcfd_projects` regardless of what this app stores, so the crash was
 * reachable through an ordinary invite-add.
 *
 * ⚠️ THIS IS NOT A PORT OF `spert-admin-tool`'s `normalizeUpdatedAt`.
 * That one carries `import 'server-only'` and matches `instanceof Timestamp`
 * against **firebase-admin**, which does not match a **firebase/firestore**
 * client Timestamp and cannot be bundled for the browser at all. This is a
 * client-side equivalent that duck-types instead. Its CLASSIFICATION is
 * deliberately identical, so that a document rendered here and the same
 * document scanned by the admin tool agree about whether an instant exists.
 *
 * ⚠️ RETURNS `undefined`, NEVER `''` AND NEVER `null`, for a shape carrying no
 * recoverable instant. `''` is itself a crashing shape, and `null` would reach
 * the document through write paths that strip only `undefined`. The caller
 * renders a fallback for `undefined`; it must never substitute the current date
 * or `createdAt`, both of which manufacture data with the wrong meaning.
 */
export function normalizeUpdatedAt(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  // The unresolved serverTimestamp() sentinel, persisted as data. MUST precede
  // the object handling below, which would otherwise reach it by a less
  // explicit route — and this shape is the only one that has ever leaked to
  // production in this suite (Scheduler Q#32).
  if (isServerTimestampSentinel(value)) return undefined;

  if (typeof value === 'number') return fromMillis(value);
  if (typeof value === 'string') return fromDateString(value);
  if (typeof value === 'object') return fromTimestampLike(value);
  return undefined;
}

/**
 * Row 1 vs row 8 is exactly this test. A string `Date.parse` rejects has no
 * instant to encode and must take the fallback, not pass through — it is the
 * only crashing shape `Project.updatedAt`'s own type still admits.
 */
function fromDateString(value: string): string | undefined {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : fromMillis(ms);
}

/** The three object spellings that carry a real instant. */
function fromTimestampLike(value: object): string | undefined {
  // A client `Timestamp` — duck-typed, because `instanceof` against the
  // firebase/firestore class would not match an admin-SDK-shaped object and
  // pulls a bundle dependency into a pure function for no gain.
  const withToDate = value as { toDate?: unknown };
  if (typeof withToDate.toDate === 'function') {
    const d = (withToDate.toDate as () => Date)();
    return d instanceof Date && !Number.isNaN(d.getTime())
      ? d.toISOString()
      : undefined;
  }

  // The two plain-map spellings, checked in SEPARATE branches because they have
  // distinct producers and either can be independently forgotten: `_seconds` is
  // the Admin SDK's serialization; `seconds` is what the client SDK's recursive
  // sanitizers rebuild a Timestamp into via Object.entries. Both carry a real
  // instant and must NOT take the fallback.
  const m = value as {
    _seconds?: unknown; _nanoseconds?: unknown;
    seconds?: unknown; nanoseconds?: unknown;
  };
  if (typeof m._seconds === 'number') return fromSeconds(m._seconds, m._nanoseconds);
  if (typeof m.seconds === 'number') return fromSeconds(m.seconds, m.nanoseconds);
  return undefined;
}

/** The `{ _methodName: 'serverTimestamp' }` map an unresolved sentinel leaves behind. */
function isServerTimestampSentinel(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)['_methodName'] === 'serverTimestamp'
  );
}

/** Guarded — `new Date(NaN).toISOString()` throws, which would defeat the point. */
function fromMillis(ms: number): string | undefined {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

function fromSeconds(seconds: number, nanoseconds: unknown): string | undefined {
  const nanos = typeof nanoseconds === 'number' && Number.isFinite(nanoseconds)
    ? nanoseconds
    : 0;
  return fromMillis(seconds * 1000 + Math.floor(nanos / 1e6));
}
