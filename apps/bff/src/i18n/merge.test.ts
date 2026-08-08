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

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localizeContent, mergeLocalizedNode } from './merge.js';
import {
  NODEJS_RUNTIME_METERS_V2_INSERT_IDS,
  nodejsRuntimeMetersV2InsertAt,
  stampWidgetIdsOntoOverlay,
} from '../logic/templates/stamp-widget-ids.js';

const here = dirname(fileURLToPath(import.meta.url));
const layersDir = join(here, '../bundled_templates/layers');

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(layersDir, name), 'utf8'));
}

function stripV2Slots(overlay: unknown, insertAt: number): unknown {
  const o = structuredClone(overlay) as { dashboards: { instance: unknown[] } };
  // Drop ids so this simulates a pre-migration OAP overlay.
  for (const e of o.dashboards.instance) {
    if (e && typeof e === 'object' && !Array.isArray(e)) {
      delete (e as Record<string, unknown>).id;
    }
  }
  o.dashboards.instance.splice(insertAt, NODEJS_RUNTIME_METERS_V2_INSERT_IDS.length);
  return o;
}

describe('mergeLocalizedNode — dual-read by widget id', () => {
  it('falls back to index pairing when the overlay has no ids', () => {
    const source = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const overlay = [{ title: '甲' }, { title: '乙' }];
    const out = mergeLocalizedNode(source, overlay) as Array<{ id: string; title: string }>;
    expect(out.map((w) => w.title)).toEqual(['甲', '乙']);
    expect(out.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('matches by id when overlay entries carry ids, even if order differs', () => {
    const source = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const overlay = [
      { id: 'b', title: '乙' },
      { id: 'a', title: '甲' },
    ];
    const out = mergeLocalizedNode(source, overlay) as Array<{ id: string; title: string }>;
    expect(out.map((w) => w.title)).toEqual(['甲', '乙']);
  });

  it('regression: stamped short overlay × new source does not paint JVM tips on new Node panels', () => {
    const source = loadJson('general.json');
    const bundledZh = loadJson('general.i18n.zh-CN.json');
    const insertAt = nodejsRuntimeMetersV2InsertAt(source);
    expect(insertAt).toBeGreaterThan(0);

    const oldOverlay = stripV2Slots(bundledZh, insertAt);
    const broken = localizeContent(source, oldOverlay, 'zh-CN') as {
      dashboards: { instance: Array<{ id: string; title: string; tip: string }> };
    };
    expect(broken.dashboards.instance[insertAt]?.id).toBe('nodejs_array_buffers');
    expect(broken.dashboards.instance[insertAt]?.title).toBe('JVM CPU');

    const { content: stamped, stamped: did } = stampWidgetIdsOntoOverlay(source, oldOverlay);
    expect(did).toBe(true);
    const fixed = localizeContent(source, stamped, 'zh-CN') as typeof broken;
    // New panels have no overlay entry → English source titles.
    expect(fixed.dashboards.instance[insertAt]?.title).toBe('Array Buffers');
    expect(
      fixed.dashboards.instance[insertAt + NODEJS_RUNTIME_METERS_V2_INSERT_IDS.length]?.title,
    ).toBe('JVM CPU');
  });
});
