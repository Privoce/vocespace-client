import { reconcilePreviews } from '../preview/source';
import { randomUUID } from 'node:crypto';
import { getSpaceRedisClient } from '../lib/server/space-redis';
import { userHeartbeat } from '../handlers/space';
import { runDueCleanTasks } from '../lib/s3-clean';

/** One API deployment owns local files. Redis lease prevents duplicate recurring work. */
export function startWorker() {
  const owner = randomUUID();
  let stopped = false;
  let busy = false;
  let lastMaintenance = 0;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    const redis = getSpaceRedisClient();
    let renew: ReturnType<typeof setInterval> | undefined;
    try {
      if (!redis || !await redis.set('v1:worker:lease', owner, 'EX', 90, 'NX')) return;
      renew = setInterval(() => {
        void redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],90) end return 0", 1, 'v1:worker:lease', owner)
          .then((renewed) => { if (renewed !== 1) stopped = true; })
          .catch(() => { stopped = true; });
      }, 30_000);
      await reconcilePreviews();
      if (!stopped && Date.now() - lastMaintenance >= 5 * 60_000) {
        await userHeartbeat();
        if (!stopped) await runDueCleanTasks();
        lastMaintenance = Date.now();
      }
    } catch { console.error('Worker reconciliation failed; pending work will retry'); }
    finally {
      if (renew) clearInterval(renew);
      await redis?.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", 1, 'v1:worker:lease', owner).catch(() => undefined);
      busy = false;
    }
  };
  const timer = setInterval(() => { void tick(); }, 15_000);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
