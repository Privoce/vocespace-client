import { basePath as configuredBasePath } from '@/lib/runtime-config';
import { ensureWebSession } from '@/lib/api/client';
import { createRealtimeClient } from '@vocespace/client-sdk';

// Importing a view or rendering on the server must never open a connection.
export const socket = createRealtimeClient(undefined, { path: `${configuredBasePath}/socket.io` });

let owners = 0;
export function retainSocket() {
  owners += 1;
  void ensureWebSession().then((response) => { if (response.ok && owners > 0) socket.connect(); }).catch(() => undefined);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owners -= 1;
    if (owners === 0) socket.disconnect();
  };
}
