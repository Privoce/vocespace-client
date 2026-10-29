import { useEffect, useRef } from 'react';
import type { AnalyticsPage } from '@vocespace/contracts';
import { analytics } from '../index';
const visible = new Map<object, { page: AnalyticsPage; priority: number }>();
let scheduled = false;
function refresh() {
  if (scheduled) return;
  scheduled = true;
  void Promise.resolve().then(() => {
    scheduled = false;
    const top = [...visible.values()].sort((a, b) => b.priority - a.priority)[0];
    if (top) analytics.page(top.page);
  });
}
/** Hidden tab children never compete with the visible route; legal pages have highest priority. */
export function useAnalyticsPage(page: AnalyticsPage | undefined, active = true, priority = 0) {
  const owner = useRef({}).current;
  useEffect(() => {
    if (!active || !page) return;
    visible.set(owner, { page, priority });
    refresh();
    return () => {
      visible.delete(owner);
      refresh();
    };
  }, [owner, page, active, priority]);
}
