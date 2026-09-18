'use client';

import { useEffect } from 'react';
import { retainSocket } from '../realtime/socket';

/** Own this at the session boundary, never inside Phone/PC views. */
export function useSocketSession() {
  useEffect(() => retainSocket(), []);
}
