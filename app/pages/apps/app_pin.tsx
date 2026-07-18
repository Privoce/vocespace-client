'use client';

import React, { useCallback, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '@/lib/i18n/i18n';
import { useSpaceStore, useUserStore } from '@/lib/store';
import { AppKey, ParticipantAvoParams, ParticipantSettings } from '@/lib/std/space';
import { AppstoreOutlined, BgColorsOutlined } from '@ant-design/icons';
import {
  LayoutContext,
  TrackReferenceOrPlaceholder,
  useLocalParticipant,
} from '@livekit/components-react';
import { Tooltip } from 'antd';
import { FullScreenBtn } from '../controls/widgets/full_screen';
import { Track } from 'livekit-client';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsBase } from '@/lib/std/device';
import { normalizeAvoParams } from '../participant/avo';
import { ParticipantAvoEditorModal } from '../participant/avo_conf';

export interface AppPinProps {
  appKey: AppKey;
  pin: () => void;
  style?: CSSProperties;
}

export interface AppFlotIconProps extends AppPinProps {
  contextUndefined?: boolean;
}

export function AppFlotIcon({ style, pin, appKey, contextUndefined = true }: AppFlotIconProps) {
  if (contextUndefined) {
    return (
      <LayoutContext.Consumer>
        {(layoutContext) =>
          layoutContext !== undefined && (
            <AppFlotPin appKey={appKey} pin={pin} style={style}></AppFlotPin>
          )
        }
      </LayoutContext.Consumer>
    );
  } else {
    return <AppFlotPin appKey={appKey} pin={pin} style={style}></AppFlotPin>;
  }
}

export const APP_FLOT_PIN_STYLE: CSSProperties = {
  width: 'fit-content',
  padding: 4,
  backgroundColor: '#00000080',
  margin: '0 4px',
  borderRadius: 4,
};

export function AppFlotPin({ pin, style = APP_FLOT_PIN_STYLE }: AppPinProps) {
  const { t } = useI18n();
  return (
    <Tooltip placement="bottom" title={t(`more.app.title`)}>
      <button className="lk-button" style={style} onClick={pin}>
        <AppstoreOutlined />
      </button>
    </Tooltip>
  );
}

export interface AppFlotIconCollectProps {
  showApp: () => void;
  participant?: ParticipantSettings;
  style?: CSSProperties;
  contextUndefined?: boolean;
  trackReference?: TrackReferenceOrPlaceholder;
  spaceName?: string;
  updateSettings?: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
}

export function AppFlotIconCollect({
  showApp,
  participant,
  contextUndefined,
  style = { right: '32px', backgroundColor: 'transparent', padding: 0 },
  trackReference,
  spaceName,
  updateSettings,
}: AppFlotIconCollectProps) {
  const isFullScreen = useSpaceStore((s) => s.isFullScreen);
  const { localParticipant } = useLocalParticipant();
  const [avoModalOpen, setAvoModalOpen] = useState(false);
  const [avoSaving, setAvoSaving] = useState(false);
  const isLocalTrack =
    !!trackReference && trackReference.participant.identity === localParticipant.identity;
  const canCustomizeAvo =
    !!participant &&
    !!updateSettings &&
    !!spaceName &&
    isLocalTrack &&
    trackReference?.source === Track.Source.Camera;

  const handleSaveAvo = useCallback(
    async (avoParams: ParticipantAvoParams) => {
      if (!participant || !updateSettings || !spaceName) {
        return;
      }

      setAvoSaving(true);
      try {
        const normalized = normalizeAvoParams(
          avoParams,
          participant.name || localParticipant.name || 'guest',
        );
        const success = await updateSettings({ avo: normalized });
        if (success !== false) {
          useUserStore.setState({ avo: normalized });
          socket.emit('update_user_status', {
            space: spaceName,
          } as WsBase);
          setAvoModalOpen(false);
        }
      } finally {
        setAvoSaving(false);
      }
    },
    [localParticipant.name, participant, spaceName, updateSettings],
  );

  return participant && participant.sync ? (
    <div className="lk-focus-toggle-button" style={style}>
      {participant.sync.length > 0 && trackReference?.source !== Track.Source.ScreenShare && (
        <AppFlotIcon
          appKey="todo"
          pin={() => showApp()}
          contextUndefined={contextUndefined}
        ></AppFlotIcon>
      )}
      {canCustomizeAvo && (
        <Tooltip placement="bottom" title="Design AVO">
          <button
            className="lk-button"
            style={APP_FLOT_PIN_STYLE}
            onClick={() => setAvoModalOpen(true)}
          >
            <BgColorsOutlined />
          </button>
        </Tooltip>
      )}
      {trackReference?.source === Track.Source.ScreenShare && !isFullScreen && (
        <FullScreenBtn trackReference={trackReference}></FullScreenBtn>
      )}
      {participant && (
        <ParticipantAvoEditorModal
          open={avoModalOpen}
          name={participant.name || localParticipant.name || 'guest'}
          avo={participant.avo}
          saving={avoSaving}
          onCancel={() => setAvoModalOpen(false)}
          onSave={handleSaveAvo}
        />
      )}
    </div>
  ) : (
    <div>
      {canCustomizeAvo && (
        <>
          <Tooltip placement="bottom" title="Design AVO">
            <button
              className="lk-button"
              style={APP_FLOT_PIN_STYLE}
              onClick={() => setAvoModalOpen(true)}
            >
              <BgColorsOutlined />
            </button>
          </Tooltip>
          {participant && (
            <ParticipantAvoEditorModal
              open={avoModalOpen}
              name={participant.name || localParticipant.name || 'guest'}
              avo={participant.avo}
              saving={avoSaving}
              onCancel={() => setAvoModalOpen(false)}
              onSave={handleSaveAvo}
            />
          )}
        </>
      )}
      {trackReference?.source === Track.Source.ScreenShare && !isFullScreen && (
        <FullScreenBtn trackReference={trackReference}></FullScreenBtn>
      )}
    </div>
  );
}
