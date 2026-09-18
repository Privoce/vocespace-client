'use client';

import { LayoutEntity } from '@/app/pages/layout/unified';
import type { TilePlayerItem } from '@/app/pages/participant/player';
import { ReadableConf } from '@/lib/std/conf';
import {
  isTrackReference,
  TrackReference,
  VideoConferenceProps
} from '@livekit/components-react';
import { MessageInstance } from 'antd/es/message/interface';
import { NotificationInstance } from 'antd/es/notification/interface';
import {
  Participant,
  Track
} from 'livekit-client';

export interface VideoContainerProps extends VideoConferenceProps {
  messageApi: MessageInstance;
  noteApi: NotificationInstance;
  setPermissionDevice: (device: Track.Source) => void;
  config: ReadableConf;
}

export interface VideoContainerExports {
  clearRoom: () => Promise<void>;
}

export type VideoLayoutEntity = LayoutEntity<TrackReferenceOrPlaceholder | TilePlayerItem | null> & {
  category: 'track' | 'tile-player' | 'tile-player-add';
};

export function isEqualTrackRef(
  a?: TrackReferenceOrPlaceholder,
  b?: TrackReferenceOrPlaceholder,
): boolean {
  try {
    if (a === undefined || b === undefined) {
      return false;
    }

    if (isTrackReference(a) && isTrackReference(b)) {
      // publication may be undefined in some edge cases
      return (a.publication?.trackSid ?? '') === (b.publication?.trackSid ?? '');
    }

    const ida = getTrackReferenceIdSafe(a);
    const idb = getTrackReferenceIdSafe(b);
    if (!ida || !idb) return false;
    return ida === idb;
  } catch (e) {
    console.warn('isEqualTrackRef error', e);
    return false;
  }
}

export function getTrackReferenceIdSafe(
  trackReference?: TrackReferenceOrPlaceholder | number,
): string | undefined {
  if (trackReference === undefined || trackReference === null) return undefined;
  try {
    if (typeof trackReference === 'string' || typeof trackReference === 'number') {
      return `${trackReference}`;
    }

    if (isTrackReferencePlaceholder(trackReference)) {
      return `${trackReference.participant.identity}_${trackReference.source}_placeholder`;
    }

    if (isTrackReference(trackReference)) {
      const pid = trackReference.participant?.identity;
      const src = trackReference.publication?.source;
      const sid = trackReference.publication?.trackSid;
      if (!pid || !src || !sid) return undefined;
      return `${pid}_${src}_${sid}`;
    }
  } catch (e) {
    console.warn('getTrackReferenceIdSafe error', e);
    return undefined;
  }

  return undefined;
}

export function getTrackReferenceId(trackReference: TrackReferenceOrPlaceholder | number) {
  return getTrackReferenceIdSafe(trackReference) || `${trackReference}`;
}

export function isTrackReferencePlaceholder(
  trackReference?: TrackReferenceOrPlaceholder,
): trackReference is TrackReferencePlaceholder {
  if (!trackReference) return false;
  return (
    trackReference.hasOwnProperty('participant') &&
    trackReference.hasOwnProperty('source') &&
    typeof trackReference.publication === 'undefined'
  );
}

export type TrackReferenceOrPlaceholder = TrackReference | TrackReferencePlaceholder;

export type TrackReferencePlaceholder = {
  participant: Participant;
  publication?: never;
  source: Track.Source;
};

export const newPlayerTrack = (space: string, playerId: string): TrackReferenceOrPlaceholder => {
  const nameOrId = `${space}_player_${playerId}`;
  return {
    participant: new Participant(nameOrId, nameOrId, nameOrId),
    source: Track.Source.Unknown,
  } as TrackReferencePlaceholder;
};
