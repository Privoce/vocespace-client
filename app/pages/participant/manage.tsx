import { Button, Drawer, Select } from 'antd';
import { DEFAULT_DRAWER_PROP, DrawerCloser, DrawerHeader } from '../controls/drawer_tools';
import { useI18n } from '@/lib/i18n/i18n';
import { SvgResource } from '@/app/resources/svg';
import { ParticipantList } from './list';
import { Participant, Room, Track } from 'livekit-client';
import styles from '@/styles/controls.module.scss';
import { ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { TrackMutedIndicator } from '@livekit/components-react';
import React from 'react';
import { ControlRKeyMenu, useControlRKeyMenu, UseControlRKeyMenuProps } from './menu';

export interface ParticipantManageProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  space?: Room;
  participantList: [string, ParticipantSettings][];
  setOpenShareModal: (open: boolean) => void;
  spaceInfo: SpaceInfo;
  selectedParticipant: Participant | null;
  setSelectedParticipant: (participant: Participant | null) => void;
  setOpenNameModal: (open: boolean) => void;
  setUsername: (username: string) => void;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  toRenameSettings: () => void;
}

export function ParticipantManage({
  open,
  setOpen,
  space,
  participantList,
  setOpenShareModal,
  spaceInfo,
  setSelectedParticipant,
  selectedParticipant,
  setOpenNameModal,
  setUsername,
  updateSettings,
  toRenameSettings
}: ParticipantManageProps) {
  const { t } = useI18n();

  const { optItems, handleOptClick, optOpen, optSelfItems, handleSelfOptClick } =
    useControlRKeyMenu({
      space,
      spaceInfo,
      selectedParticipant,
      setSelectedParticipant,
      setOpenNameModal,
      setUsername,
      updateSettings,
      toRenameSettings
    } as UseControlRKeyMenuProps);

  return (
    <Drawer
      {...DEFAULT_DRAWER_PROP}
      styles={{
        body: {
          ...DEFAULT_DRAWER_PROP.styles?.body,
          padding: '0 24px 0 24px',
        },
      }}
      title={
        <DrawerHeader
          title={t('more.participant.manage')}
          icon={<SvgResource type="user" svgSize={16}></SvgResource>}
        ></DrawerHeader>
      }
      open={open}
      onClose={() => {
        setOpen(false);
        // closeSetting();
      }}
      extra={DrawerCloser({
        on_clicked: () => {
          setOpen(false);
          // closeSetting();
        },
      })}
    >
      <div className={styles.setting_container}>
        <div className={styles.setting_container_more}>
          <div className={styles.setting_container_more_header}>
            <Select
              showSearch
              placeholder={t('more.participant.search')}
              allowClear
              style={{ width: 'calc(100% - 60px)' }}
              optionFilterProp="label"
              filterSort={(optionA, optionB) =>
                (optionA?.label ?? '')
                  .toLowerCase()
                  .localeCompare((optionB?.label ?? '').toLowerCase())
              }
              options={participantList.map((item) => ({
                label: item[1].name,
                value: item[0],
              }))}
            ></Select>
            <Button type="primary" onClick={() => setOpenShareModal(true)}>
              <SvgResource type="user_add" svgSize={16}></SvgResource>
            </Button>
          </div>
          {space && (
            <ParticipantList
              space={space}
              participants={participantList}
              ownerId={spaceInfo.ownerId}
              menu={{
                items: optItems,
                onClick: handleOptClick,
              }}
              selfMenu={{
                items: optSelfItems,
                onClick: handleSelfOptClick,
              }}
              onOpenMenu={(open, pid) => {
                optOpen(open, space.getParticipantByIdentity(pid)!);
              }}
              suffix={(item, _index) => (
                <>
                  {space.getParticipantByIdentity(item[0]) && (
                    <div className={styles.particepant_item_right}>
                      <TrackMutedIndicator
                        trackRef={{
                          participant: space.getParticipantByIdentity(item[0])!,
                          source: Track.Source.Microphone,
                        }}
                        show={'always'}
                      ></TrackMutedIndicator>
                      <TrackMutedIndicator
                        trackRef={{
                          participant: space.getParticipantByIdentity(item[0])!,
                          source: Track.Source.Camera,
                        }}
                        show={'always'}
                      ></TrackMutedIndicator>
                      {space.localParticipant.identity !== item[0] && (
                        <ControlRKeyMenu
                          menu={{
                            items: optItems,
                            onClick: handleOptClick,
                          }}
                          onOpenChange={(open) => {
                            optOpen(open, space.getParticipantByIdentity(item[0])!);
                          }}
                          children={
                            <Button shape="circle" type="text">
                              <SvgResource type="more2" svgSize={16}></SvgResource>
                            </Button>
                          }
                        ></ControlRKeyMenu>
                      )}
                    </div>
                  )}
                </>
              )}
            ></ParticipantList>
          )}
        </div>
      </div>
    </Drawer>
  );
}
