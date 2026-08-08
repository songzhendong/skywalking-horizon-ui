/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Stamp source widget `id`s onto index-aligned translation overlays so
 * runtime merge can resolve by id (see `mergeLocalizedNode`).
 *
 * Existing overlay entries are preserved; only the structural `id`
 * field is added/updated. When the overlay is shorter because widgets
 * were inserted mid-array, a known insert (Node.js runtime meters
 * 6→12) is used to map overlay indices onto the correct source ids
 * without shifting customized translations onto the new panels.
 */

/** Widget ids inserted by the Node.js 6→12 meters UI change, in order. */
export const NODEJS_RUNTIME_METERS_V2_INSERT_IDS = [
  'nodejs_array_buffers',
  'nodejs_uptime',
  'nodejs_peak_malloced_memory',
  'nodejs_malloced_memory',
  'nodejs_old_space_used',
  'nodejs_new_space_used',
] as const;

function entryId(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const id = (entry as Record<string, unknown>).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function instanceWidgets(content: unknown): unknown[] | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const dashboards = (content as Record<string, unknown>).dashboards;
  if (!dashboards || typeof dashboards !== 'object' || Array.isArray(dashboards)) return null;
  const instance = (dashboards as Record<string, unknown>).instance;
  return Array.isArray(instance) ? instance : null;
}

/** Index in `source` where the v2 Node.js insert starts, or -1. */
export function nodejsRuntimeMetersV2InsertAt(sourceContent: unknown): number {
  const widgets = instanceWidgets(sourceContent);
  if (!widgets) return -1;
  const insertAt = widgets.findIndex((w) => entryId(w) === NODEJS_RUNTIME_METERS_V2_INSERT_IDS[0]);
  if (insertAt < 0) return -1;
  for (let i = 0; i < NODEJS_RUNTIME_METERS_V2_INSERT_IDS.length; i++) {
    if (entryId(widgets[insertAt + i]) !== NODEJS_RUNTIME_METERS_V2_INSERT_IDS[i]) return -1;
  }
  return insertAt;
}

/**
 * Map each overlay index to the source widget id it should carry.
 * Equal lengths → identity. Short overlays with the known Node.js v2
 * insert → skip the inserted ids so the JVM/… tail keeps its translations.
 */
export function sourceIdsForOverlayIndices(
  sourceWidgets: unknown[],
  overlayLen: number,
): (string | null)[] | null {
  if (overlayLen === sourceWidgets.length) {
    return sourceWidgets.map((w) => entryId(w));
  }
  const insertAt = (() => {
    // Reconstruct insertAt from source ids (same helper as above, but we
    // only have the widget array here).
    const at = sourceWidgets.findIndex((w) => entryId(w) === NODEJS_RUNTIME_METERS_V2_INSERT_IDS[0]);
    if (at < 0) return -1;
    for (let i = 0; i < NODEJS_RUNTIME_METERS_V2_INSERT_IDS.length; i++) {
      if (entryId(sourceWidgets[at + i]) !== NODEJS_RUNTIME_METERS_V2_INSERT_IDS[i]) return -1;
    }
    return at;
  })();
  const gap = NODEJS_RUNTIME_METERS_V2_INSERT_IDS.length;
  if (insertAt < 0 || overlayLen !== sourceWidgets.length - gap) return null;
  if (overlayLen < insertAt) return null;

  const ids: (string | null)[] = [];
  for (let i = 0; i < overlayLen; i++) {
    const srcIndex = i < insertAt ? i : i + gap;
    ids.push(entryId(sourceWidgets[srcIndex]));
  }
  return ids;
}

function stampArray(sourceArr: unknown[], overlayArr: unknown[]): { next: unknown[]; changed: boolean } {
  // If every non-null overlay object already has an id, nothing to do
  // for equal-length catalogs. Short catalogs may still need remapping.
  const ids = sourceIdsForOverlayIndices(sourceArr, overlayArr.length);
  if (!ids) {
    // Unknown shortfall — leave untouched (legacy index merge still applies).
    return { next: overlayArr, changed: false };
  }

  let changed = false;
  const next = overlayArr.map((entry, i) => {
    const want = ids[i];
    if (!want) return entry;
    if (entry === null || entry === undefined) {
      changed = true;
      return { id: want };
    }
    if (typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const rec = entry as Record<string, unknown>;
    if (rec.id === want) return entry;
    changed = true;
    return { ...rec, id: want };
  });
  return { next, changed };
}

/**
 * Deep-walk `overlay`, stamping `id` onto array entries that parallel
 * source widget arrays. Returns the original overlay reference when
 * nothing changed.
 */
export function stampWidgetIdsOntoOverlay(
  sourceContent: unknown,
  overlayContent: unknown,
): { content: unknown; stamped: boolean } {
  const walk = (source: unknown, overlay: unknown): { next: unknown; changed: boolean } => {
    if (Array.isArray(source) && Array.isArray(overlay)) {
      // Only stamp when source entries look like widgets (have string ids).
      const sourceHasIds = source.some((e) => entryId(e) !== null);
      if (sourceHasIds) {
        // Widget arrays: stamp ids only. Entries are translation leaves
        // (title/tip/…); do not recurse with index pairing — short
        // overlays are intentionally not 1:1 with source indices.
        return stampArray(source, overlay);
      }
      let changed = false;
      const next = source.map((item, i) => {
        const r = walk(item, overlay[i]);
        if (r.changed) changed = true;
        return r.next;
      });
      // Preserve overlay-only tail length without inventing source rows.
      for (let i = source.length; i < overlay.length; i++) next.push(overlay[i]);
      return { next, changed };
    }
    if (
      source !== null &&
      typeof source === 'object' &&
      !Array.isArray(source) &&
      overlay !== null &&
      typeof overlay === 'object' &&
      !Array.isArray(overlay)
    ) {
      const src = source as Record<string, unknown>;
      const ovl = overlay as Record<string, unknown>;
      let changed = false;
      const out: Record<string, unknown> = { ...ovl };
      for (const [k, v] of Object.entries(src)) {
        if (!(k in ovl)) continue;
        const r = walk(v, ovl[k]);
        if (r.changed) {
          out[k] = r.next;
          changed = true;
        }
      }
      return { next: changed ? out : overlay, changed };
    }
    return { next: overlay, changed: false };
  };

  const { next, changed } = walk(sourceContent, overlayContent);
  return { content: next, stamped: changed };
}
