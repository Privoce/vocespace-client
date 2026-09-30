import { useMemo, useCallback } from 'react';
import type { Room } from 'livekit-client';
import { api } from '@/lib/api';
import { MessageInstance } from 'antd/es/message/interface';
import { ReadableConf } from '@/lib/std/conf';

export function useRoomLicense(config: ReadableConf, space: Room | null | undefined, messageApi: MessageInstance) {
  const hasRoomLicense = useMemo(() => {
    if (!config.roomLicenses || !space?.name) return false;
    const entry = config.roomLicenses.find((r) => r.name === space.name);
    if (!entry) return false;
    try {
      const parts = entry.license.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const now = Math.floor(Date.now() / 1000);
      return payload.expires_at > now;
    } catch {
      return false;
    }
  }, [config.roomLicenses, space?.name]);

  const toBuyRoomLicense = useCallback(async () => {
    const isCircleIp =
      config.serverUrl === 'localhost' ||
      config.serverUrl.startsWith('192.168.') ||
      config.serverUrl === '127.0.0.1';
    if (isCircleIp) {
      window.open('https://buy.stripe.com/fZu3cveyR76afv6bPi6c01m', '_blank');
    } else {
      const response = await api.getLicenseByIP(config.serverUrl, 'room');
      if (response.ok) {
        const { url } = await response.json();
        if (url) {
          window.open(url, '_blank');
        }
      } else {
        messageApi.warning({
          content: 'Failed to get session url',
          duration: 2,
        });
        window.open('https://buy.stripe.com/fZu3cveyR76afv6bPi6c01m', '_blank');
      }
    }
  }, [config.serverUrl, messageApi]);

  return { hasRoomLicense, toBuyRoomLicense };
}
