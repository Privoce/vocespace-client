"use client";

import { api } from '@/lib/api';
import { generateRoomId } from '@/lib/client_utils';
import { PlatformUser } from '@/lib/std';
import { AllowGuest, VOCESPACE_PLATFORM_USER } from '@/lib/std/space';
import { LocalUserChoices } from '@livekit/components-react';
import { Button, Result } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import React, { useCallback, useEffect } from 'react';

export function WaitRoom({
  onSubmit,
  data,
  messageApi,
}: {
  onSubmit?: (values: LocalUserChoices) => void;
  data?: PlatformUser;
  messageApi: MessageInstance;
}) {
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const [user, setUser] = React.useState<PlatformUser | undefined>(data);

  // refs to avoid stale closures and to prevent multiple submissions
  const userRef = React.useRef<PlatformUser | undefined>(data);
  const submittedRef = React.useRef(false);

  const getUserFromStore = () => {
    if (typeof window === 'undefined') return;
    const storedUserInfo = localStorage.getItem(VOCESPACE_PLATFORM_USER);
    if (storedUserInfo) {
      try {
        const parsed = JSON.parse(storedUserInfo) as PlatformUser;
        console.warn(storedUserInfo);
        setUser(parsed);
        userRef.current = parsed;
      } catch (e) {
        console.error('Failed to parse stored user info', e);
      }
    }
  };

  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  const tryEnterSpace = useCallback(async () => {
    if (submittedRef.current) return;

    const currentUser = userRef.current;

    try {
      const response = await api.spaceAllowEnter(
        currentUser?.space || generateRoomId(),
        currentUser?.id || '',
        currentUser,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      const {
        exist,
        allowGuest,
        allowCustomer,
      }: { allowGuest: AllowGuest; exist: boolean; allowCustomer: boolean } = await response.json();
      if (exist) {
        return;
      } else {
        if (allowGuest !== 'allow') return;
        if (!allowCustomer) return;
      }
    } catch (error) {
      console.error('Error checking space entry:', error);
      return;
    }

    // Provide a safe fallback for username to avoid undefined participant names
    const usernameFallback = currentUser?.username ?? (currentUser as any)?.name ?? `guest_${currentUser?.id ?? Date.now()}`;

    submittedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    onSubmit?.({
      videoEnabled: false,
      audioEnabled: false,
      videoDeviceId: 'default',
      audioDeviceId: 'default',
      username: usernameFallback,
    } as LocalUserChoices);
  }, [onSubmit]);

  useEffect(() => {
    getUserFromStore();

    // call immediately, then poll
    tryEnterSpace().catch((e) => console.error(e));
    intervalRef.current = setInterval(() => {
      tryEnterSpace().catch((error) => {
        console.error(error);
      });
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tryEnterSpace]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        justifyContent: "center"
      }}
    >
      <Result
        status="warning"
        title="Please wait a moment while we search for available rooms for you."
      />
    </div>
  );
}
