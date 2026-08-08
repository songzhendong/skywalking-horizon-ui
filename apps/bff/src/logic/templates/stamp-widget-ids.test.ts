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
import {
  NODEJS_RUNTIME_METERS_V2_INSERT_IDS,
  stampWidgetIdsOntoOverlay,
} from './stamp-widget-ids.js';

describe('stampWidgetIdsOntoOverlay', () => {
  it('stamps ids by index when lengths match and preserves custom titles', () => {
    const source = {
      dashboards: {
        instance: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
        ],
      },
    };
    const overlay = {
      dashboards: {
        instance: [{ title: '定制 A' }, { title: '定制 B' }],
      },
    };
    const { content, stamped } = stampWidgetIdsOntoOverlay(source, overlay);
    expect(stamped).toBe(true);
    const inst = (content as typeof overlay).dashboards.instance;
    expect(inst[0]).toEqual({ title: '定制 A', id: 'a' });
    expect(inst[1]).toEqual({ title: '定制 B', id: 'b' });
  });

  it('maps short overlays across the Node.js v2 insert without moving JVM titles', () => {
    const insertIds = [...NODEJS_RUNTIME_METERS_V2_INSERT_IDS];
    const source = {
      dashboards: {
        instance: [
          { id: 'nodejs_external_memory', title: 'External' },
          ...insertIds.map((id) => ({ id, title: id })),
          { id: 'jvm_cpu', title: 'JVM CPU' },
        ],
      },
    };
    const overlay = {
      dashboards: {
        instance: [
          { title: '外部内存' },
          { title: '定制 JVM CPU' },
        ],
      },
    };
    const { content, stamped } = stampWidgetIdsOntoOverlay(source, overlay);
    expect(stamped).toBe(true);
    const inst = (content as typeof overlay).dashboards.instance as Array<{
      id: string;
      title: string;
    }>;
    expect(inst).toHaveLength(2);
    expect(inst[0]).toEqual({ title: '外部内存', id: 'nodejs_external_memory' });
    expect(inst[1]).toEqual({ title: '定制 JVM CPU', id: 'jvm_cpu' });
  });

  it('is a no-op when ids already match', () => {
    const source = { dashboards: { instance: [{ id: 'a', title: 'A' }] } };
    const overlay = { dashboards: { instance: [{ id: 'a', title: '甲' }] } };
    const { stamped } = stampWidgetIdsOntoOverlay(source, overlay);
    expect(stamped).toBe(false);
  });
});
