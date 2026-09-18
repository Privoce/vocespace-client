'use client';

import { TabKey } from '@/app/pages/controls/settings/settings';
import { UserStatus } from '@/lib/std';
import { ReadableConf } from '@/lib/std/conf';
import { AICutParticipantConf, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { Track } from 'livekit-client';
import * as React from 'react';
export type ControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
  settings?: boolean;
};

export interface ControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  variation?: 'minimal' | 'verbose' | 'textOnly';
  controls?: ControlBarControls;
  /**
   * If `true`, the user's device choices will be persisted.
   * This will enable the user to have the same device choices when they rejoin the space.
   * @defaultValue true
   * @alpha
   */
  saveUserChoices?: boolean;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  spaceInfo: SpaceInfo;
  fetchSettings: () => Promise<void>;
  updateRecord: (active: boolean, egressId?: string, filePath?: string) => Promise<boolean>;
  setPermissionDevice: (device: Track.Source) => void;
  openApp: boolean;
  setOpenApp: (open: boolean) => void;
  toRenameSettings: () => void;
  startOrStopAICutAnalysis: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote: () => void;
  downloadAIMdReport?: () => Promise<void>;
  config: ReadableConf;
}

export interface ControlBarExport {
  openSettings: (key: TabKey, isDefineStatus?: boolean) => void;
  showAICutAnalysisSettings: (open: boolean) => void;
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

export function useMediaQuery(query: string): boolean {
  const getMatches = (query: string): boolean => {
    // Prevents SSR issues
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = React.useState<boolean>(getMatches(query));

  function handleChange() {
    setMatches(getMatches(query));
  }

  React.useEffect(() => {
    const matchMedia = window.matchMedia(query);

    // Triggered at the first client-side load and if query changes
    handleChange();

    // Listen matchMedia
    if (matchMedia.addListener) {
      matchMedia.addListener(handleChange);
    } else {
      matchMedia.addEventListener('change', handleChange);
    }

    return () => {
      if (matchMedia.removeListener) {
        matchMedia.removeListener(handleChange);
      } else {
        matchMedia.removeEventListener('change', handleChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return matches;
}

export function supportsScreenSharing(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    !!navigator.mediaDevices.getDisplayMedia
  );
}

export function renderDeviceMenuTrigger() { return <button className="lk-button lk-button-menu" type="button" aria-label="devices" />; }
