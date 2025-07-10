'use client';

import { forwardRef, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from '@/styles/channel.module.scss';
import { useI18n } from '@/lib/i18n/i18n';
import { SvgResource } from '@/app/resources/svg';
import {
  Badge,
  Button,
  Collapse,
  CollapseProps,
  Dropdown,
  Input,
  MenuProps,
  Modal,
  Popover,
  Radio,
  Tag,
  theme,
} from 'antd';

import {
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { GridLayout, TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { MessageInstance } from 'antd/es/message/interface';
import { ChildRoom, RoomSettings } from '@/lib/std/room';
import { ParticipantTileMini } from '../participant/mini';
import { GLayout } from '../layout/grid';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import {
  createRoom,
  deleteRoom,
  joinRoom,
  leaveRoom,
  updateRoom,
  UpdateRoomParam,
  UpdateRoomType,
} from '@/lib/hooks/channel';
import { socket } from '@/app/[roomName]/PageClientImpl';
import { WsJoinRoom, WsRemove, WsSender, WsTo } from '@/lib/std/device';
import { PaginationInfo } from './pagination';

interface ChannelProps {
  roomName: string;
  messageApi: MessageInstance;
  participantId: string;
  onUpdate: () => Promise<void>;
  tracks: TrackReferenceOrPlaceholder[];
  settings: RoomSettings;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isActive?: boolean;
}

export interface ChannelExports {}

type RoomPrivacy = 'public' | 'private';

export const Channel = forwardRef<ChannelExports, ChannelProps>(
  (
    {
      roomName,
      settings,
      messageApi,
      participantId,
      onUpdate,
      tracks,
      collapsed,
      setCollapsed,
      isActive = false,
    }: ChannelProps,
    ref,
  ) => {
    const { t } = useI18n();

    const { token } = theme.useToken();
    const [selected, setSelected] = useState<'main' | 'sub'>('main');
    const [roomCreateModalOpen, setRoomCreateModalOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<ChildRoom | null>(null);
    const [mainJoinVis, setMainJoinVis] = useState<'hidden' | 'visible'>('hidden');
    const [roomJoinVis, setRoomJoinVis] = useState<number | null>(null);
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameRoomName, setRenameRoomName] = useState('');
    const [joinParticipant, setJoinParticipant] = useState<{
      id: string;
      name: string;
      targetRoom: string;
    } | null>(null);
    const [selfRoomName, setSelfRoomName] = useState<string>(roomName);
    const [subActiveKey, setSubActiveKey] = useState<string[]>([]);
    // 用于存储子房间的名称，在其他用户创建房间后通过这个变量来控制到底那些新的子房间需要展开
    const [subRoomsTmp, setSubRoomsTmp] = useState<string[]>([]);
    const [mainActiveKey, setMainActiveKey] = useState<string[]>(['main', 'sub']);
    const [roomPrivacy, setRoomPrivacy] = useState<RoomPrivacy>('public');
    const roomPrivacyOptions: CheckboxGroupProps<string>['options'] = [
      {
        label: t('channel.modal.privacy.public.title'),
        value: 'public',
      },
      {
        label: t('channel.modal.privacy.private.title'),
        value: 'private',
      },
    ];

    useEffect(() => {
      // 设置默认展开的子房间的Collapse body基于subRoomsTmp
      let currentRooms = settings.children.map((room) => room.name);
      let isSameAsSubTmp = subRoomsTmp.every((room) => currentRooms.includes(room));
      if (settings.children.length > 0 && !isSameAsSubTmp) {
        let newRooms: string[] = [];
        settings.children.forEach((child) => {
          newRooms.push(child.name);
          if (!subRoomsTmp.includes(child.name)) {
            setSubActiveKey((prev) => [...prev, child.name]);
          }
          // 如果当前这个本地用户在子房间中，需要展开这个子房间
          if (child.participants.includes(participantId)) {
            setSubActiveKey((prev) => [...prev, child.name]);
          }
        });
        setSubRoomsTmp(newRooms);
      }
    }, [settings.children, participantId, subRoomsTmp]);

    const allParticipants = useMemo(() => {
      console.warn(Object.keys(settings.participants).length, settings.participants);
      return Object.keys(settings.participants);
    }, [settings]);

    const wsSender = useMemo(() => {
      if (settings && roomName && participantId && settings.participants[participantId]) {
        const senderName = settings.participants[participantId].name;
        return {
          room: roomName,
          senderName,
          senderId: participantId,
        } as WsSender;
      } else {
        return null;
      }
    }, [roomName, participantId, settings]);

    useEffect(() => {
      // 监听加入私密房间的socket事件 --------------------------------------------------------------------------
      socket.on('join_privacy_room_response', (msg: WsJoinRoom) => {
        if (msg.room === roomName && msg.receiverId === participantId) {
          if (!joinModalOpen) {
            if (msg.confirm === false) {
              // 说明对方拒绝了加入请求
              messageApi.warning({
                content: t('channel.modal.join.reject'),
              });
              setJoinModalOpen(false);
            } else {
              setJoinParticipant({
                id: msg.senderId,
                name: msg.senderName,
                targetRoom: msg.childRoom,
              });
              setJoinModalOpen(true);
            }
          }
        }
      });
      // 监听从私密房间移除的socket事件 -----------------------------------------------------------------------
      socket.on('removed_from_privacy_room_response', (msg: WsRemove) => {
        if (msg.room === roomName && msg.participants.includes(participantId)) {
          messageApi.info({
            content: `${t('channel.modal.remove.before')}${msg.childRoom}${t(
              'channel.modal.remove.after',
            )}`,
          });
        }
      });

      return () => {
        socket.off('join_privacy_room_response');
        socket.off('removed_from_privacy_room_response');
      };
    }, [socket, roomName, participantId, joinModalOpen]);

    const childRooms = useMemo(() => {
      return settings.children || [];
    }, [settings.children]);
    const toggleCollapse = () => {
      setCollapsed(!collapsed);
    };
    const [childRoomName, setChildRoomName] = useState('');

    const createChildRoom = async () => {
      if (childRoomName.trim() === '') {
        messageApi.error({
          content: t('channel.create.empty_name'),
          duration: 2,
        });
        return;
      }

      const response = await createRoom({
        hostRoom: roomName,
        roomName: childRoomName,
        ownerId: participantId,
        isPrivate: roomPrivacy === 'private',
      });

      if (!response.ok) {
        messageApi.error({
          content: t('channel.create.error'),
          duration: 2,
        });
        return;
      } else {
        messageApi.success({
          content: t('channel.create.success'),
          duration: 2,
        });
        setRoomCreateModalOpen(false);
      }
      await onUpdate();
    };

    const deleteChildRoom = async () => {
      if (!selectedRoom) return;

      if (selectedRoom.participants.length > 0) {
        let socketIds = selectedRoom.participants.map((pid) => {
          return settings.participants[pid].socketId;
        });

        // socket通知用户移除
        socket.emit('removed_from_privacy_room', {
          room: roomName,
          participants: selectedRoom.participants,
          socketIds,
          childRoom: selectedRoom.name,
        } as WsRemove);
      }

      const response = await deleteRoom({
        hostRoom: roomName,
        roomName: selectedRoom.name,
      });

      if (!response.ok) {
        messageApi.error({
          content: t('channel.delete.error'),
          duration: 2,
        });
        return;
      } else {
        setSelectedRoom(null);
        await onUpdate();
        messageApi.success({
          content: t('channel.delete.success'),
          duration: 2,
        });
      }
    };

    const leaveChildRoom = async (room?: string) => {
      if (!selectedRoom && !room) return;

      const response = await leaveRoom({
        hostRoom: roomName,
        roomName: room || selectedRoom!.name,
        participantId,
      });

      if (!response.ok) {
        const { error } = await response.json();
        messageApi.error({
          content: error,
          duration: 2,
        });
      } else {
        setSelfRoomName(roomName);
        // setMainActiveKey(['main', 'sub']);
        setSubActiveKey([]);
        setSelectedRoom(null);
        await onUpdate();
        messageApi.success({
          content: t('channel.leave.success'),
          duration: 2,
        });
      }
    };

    const joinChildRoom = async (room: ChildRoom, participantId: string) => {
      const response = await joinRoom({
        hostRoom: roomName,
        roomName: room.name,
        participantId,
      });

      if (!response.ok) {
        const { error } = await response.json();
        messageApi.error({
          content: error,
          duration: 2,
        });
        return;
      } else {
        // 进入子房间后 subActiveKey 就是当前子房间的key
        setSelfRoomName(room.name);
        setSubActiveKey((prev) => {
          const newSubActiveKey = [...prev];
          if (!prev.includes(room.name)) {
            newSubActiveKey.push(room.name);
          }
          return newSubActiveKey;
        });
        // setMainActiveKey(['sub']);
        await onUpdate();
        messageApi.success({
          content: t('channel.join.success'),
          duration: 2,
        });
      }
    };

    const addIntoRoom = async (room: ChildRoom) => {
      // 判断是否为私密房间，如果是则需要使用socket通知拥有者
      if (room.isPrivate && room.ownerId !== participantId) {
        socket.emit('join_privacy_room', {
          receiverId: room.ownerId,
          socketId: settings.participants[room.ownerId].socketId,
          childRoom: room.name,
          ...wsSender,
        } as WsJoinRoom);
        return;
      }
      await joinChildRoom(room, participantId);
    };

    const confirmJoinRoom = async (confirm: boolean) => {
      if (!joinParticipant) {
        messageApi.error({
          content: t('channel.modal.join.missing_data'),
        });
        return;
      }

      if (confirm) {
        // 同意加入
        const childRoom = settings.children.find((c) => c.name === joinParticipant?.targetRoom);
        if (childRoom) {
          await joinChildRoom(childRoom, joinParticipant.id);
        } else {
          messageApi.error({
            content: t('channel.modal.join.missing_data'),
          });
        }
      } else {
        // 拒绝加入，使用socket回复发起者
        socket.emit('join_privacy_room', {
          receiverId: joinParticipant.id,
          socketId: settings.participants[joinParticipant.id].socketId,
          childRoom: joinParticipant.targetRoom,
          confirm: false,
          ...wsSender,
        } as WsJoinRoom);
      }

      setJoinParticipant(null);
      setJoinModalOpen(false);
    };

    const joinMainRoom = async () => {
      // 设置为当前自己所在的房间
      await leaveChildRoom(selfRoomName);
    };

    const updateChildRoom = async (ty: UpdateRoomType) => {
      if (!selectedRoom) return;
      let isRename = ty === 'name';
      let param = {
        ty,
        hostRoom: roomName,
        roomName: selectedRoom.name,
      } as UpdateRoomParam;
      if (isRename) {
        if (renameRoomName.trim() === '') {
          messageApi.error({
            content: t('channel.modal.rename.empty_name'),
          });
          return;
        }

        if (settings.children.some((room) => room.name === renameRoomName.trim())) {
          messageApi.error({
            content: t('channel.modal.rename.repeat'),
          });
          return;
        }
        setRenameModalOpen(false);
        param.newRoomName = renameRoomName.trim();
        setRenameRoomName('');
      } else {
        // 切换隐私性
        param.isPrivate = !selectedRoom.isPrivate;
      }

      const response = await updateRoom(param);

      if (response.ok) {
        await onUpdate();
        messageApi.success({
          content: isRename
            ? t('channel.modal.rename.success')
            : `${t('channel.modal.privacy.success')}: ${
                param.isPrivate
                  ? t('channel.modal.privacy.private.title')
                  : t('channel.modal.privacy.public.title')
              }`,
        });
      }
    };
    const authDisabled = useMemo(() => {
      if (participantId === settings.ownerId) {
        return false;
      } else {
        return selectedRoom?.ownerId !== participantId;
      }
    }, [settings.ownerId, selectedRoom, participantId]);

    const subContextItems: MenuProps['items'] = [
      {
        key: 'rename',
        label: t('channel.menu.rename'),
        disabled: authDisabled,
        onClick: () => {
          console.warn('rename', selectedRoom);
          setRenameModalOpen(true);
        },
      },
      {
        key: 'privacy',
        label: `${t('channel.menu.switch_privacy')}${
          !selectedRoom?.isPrivate
            ? t('channel.modal.privacy.private.title')
            : t('channel.modal.privacy.public.title')
        }`,
        disabled: authDisabled,
        onClick: async () => updateChildRoom('privacy'),
      },
      {
        key: 'delete',
        label: t('channel.menu.delete'),
        onClick: deleteChildRoom,
        disabled: authDisabled,
      },
      {
        key: 'leave',
        label: t('channel.menu.leave'),
        onClick: async () => await leaveChildRoom(),
      },
    ];

    const panelStyle: React.CSSProperties = {
      marginBottom: 0,
      background: '#1e1e1e',
      borderRadius: 0,
      border: 'none',
      padding: '0px',
    };

    const subStyle: React.CSSProperties = {
      marginBottom: 0,
      background: selected == 'sub' ? '#2a2a2a' : '#1e1e1e',
      borderRadius: 0,
      border: 'none',
    };

    const mainContext: ReactNode = useMemo(() => {
      let allChildParticipants = childRooms.reduce((acc, room) => {
        return acc.concat(room.participants);
      }, [] as string[]);

      // let allParticipants = Object.keys(settings.participants);

      // 从tracks中将所有子房间的参与者过滤掉, 并且这些参与着必须要在当前房间中
      let mainTracks = tracks.filter(
        (track) =>
          !allChildParticipants.includes(track.participant.identity) &&
          allParticipants.includes(track.participant.identity),
      );

      return (
        <GLayout tracks={mainTracks} style={{ height: '120px', position: 'relative' }}>
          <ParticipantTileMini settings={settings} room={roomName}></ParticipantTileMini>
        </GLayout>
      );
    }, [tracks, childRooms, settings, allParticipants]);

    const subContext = useCallback(
      (name: string, length: number): ReactNode => {
        let childRoom = childRooms.find((room) => room.name === name);

        if (!childRoom) {
          return <></>;
        }

        if (length === 0) {
          return <></>;
        }

        // let allParticipants = Object.keys(settings.participants);

        let subTracks = tracks.filter((track) =>
          childRoom.participants.includes(track.participant.identity) && allParticipants.includes(track.participant.identity),
        );

        return (
          <GLayout tracks={subTracks} style={{ height: '120px', position: 'relative' }}>
            <ParticipantTileMini settings={settings} room={roomName}></ParticipantTileMini>
          </GLayout>
        );
      },
      [tracks, childRooms, settings, roomName, allParticipants],
    );

    const subChildren: CollapseProps['items'] = useMemo(() => {
      return childRooms.map((room, index) => ({
        key: room.name,
        label: (
          <div
            className={styles.room_header_wrapper}
            onMouseEnter={() => {
              setRoomJoinVis(index);
            }}
            onMouseLeave={() => {
              setRoomJoinVis(null);
            }}
          >
            <Dropdown
              trigger={['contextMenu']}
              menu={{ items: subContextItems }}
              onOpenChange={(open) => {
                if (open) {
                  setSelectedRoom(room);
                }
              }}
            >
              <div className={styles.room_header_wrapper_title}>
                <div
                  className={styles.room_header_wrapper_title}
                  onClick={() => {
                    setSubActiveKey((prev) => {
                      const newActiveKey = [...prev];
                      if (newActiveKey.includes(room.name)) {
                        return newActiveKey.filter((r) => r !== room.name);
                      } else {
                        newActiveKey.push(room.name);
                      }
                      return newActiveKey;
                    });
                  }}
                >
                  {room.isPrivate ? (
                    <LockOutlined />
                  ) : (
                    <SvgResource type="public" svgSize={16} color="#aaa"></SvgResource>
                  )}
                  {room.name}
                </div>
                {room.participants.length > 0 && (
                  <Tag
                    color="transparent"
                    style={{
                      fontSize: '0.8em',
                      padding: '2px 4px',
                      lineHeight: '1.2em',
                      color: '#8c8c8c',
                    }}
                    bordered={false}
                  >
                    {room.participants.length}&nbsp;
                    {t('channel.menu.active')}
                  </Tag>
                )}
              </div>
            </Dropdown>
            <div
              className={styles.room_header_extra}
              style={{ visibility: roomJoinVis === index ? 'visible' : 'hidden' }}
            >
              <button onClick={() => addIntoRoom(room)} className="vocespace_button">
                <PlusCircleOutlined />
                {t('channel.menu.join')}
              </button>
            </div>
          </div>
        ),
        children: subContext(room.name, room.participants.length),
        style: subStyle,
      }));
    }, [subContext, childRooms, selectedRoom, selfRoomName, roomJoinVis]);

    const mainItems: CollapseProps['items'] = useMemo(() => {
      return [
        {
          key: 'main',
          label: (
            <div
              className={styles.room_header_wrapper}
              onMouseEnter={() => {
                setMainJoinVis('visible');
              }}
              onMouseLeave={() => {
                setMainJoinVis('hidden');
              }}
            >
              <div
                className={styles.room_header_wrapper_title}
                onClick={() => {
                  setMainActiveKey((prev) => {
                    if (prev.includes('main')) {
                      return [];
                    }
                    return ['main', 'sub'];
                  });
                }}
              >
                <SvgResource type="space" svgSize={16} color="#aaa"></SvgResource>
                <span>{t('channel.menu.main')}</span>
              </div>

              <div className={styles.room_header_extra} style={{ visibility: mainJoinVis }}>
                <button onClick={joinMainRoom} className="vocespace_button">
                  <PlusCircleOutlined />
                  {t('channel.menu.join')}
                </button>
              </div>
            </div>
          ),
          children: mainContext,
          style: panelStyle,
        },
        {
          key: 'sub',
          label: (
            <div className={styles.room_header_wrapper}>
              <div className={styles.room_header_wrapper_title}>
                <SvgResource type="room" svgSize={16} color="#aaa"></SvgResource>
                <span>{t('channel.menu.sub')}</span>
              </div>
              <div className={styles.room_header_extra} style={{ height: '30px' }}>
                <button
                  className="vocespace_button_text"
                  style={{ height: '100%' }}
                  onClick={() => {
                    setRoomCreateModalOpen(true);
                  }}
                >
                  <PlusCircleOutlined></PlusCircleOutlined>
                </button>
              </div>
            </div>
          ),
          children: (
            <Collapse
              bordered={false}
              defaultActiveKey={subActiveKey}
              activeKey={subActiveKey}
              expandIcon={() => undefined}
              style={{ background: token.colorBgContainer }}
              items={subChildren}
            />
          ),
          style: panelStyle,
        },
      ];
    }, [mainContext, subChildren, childRooms, subActiveKey, mainJoinVis]);

    if (collapsed) {
      return (
        <div
          className={`${styles.container} ${styles.collapsed}`}
          style={{
            width: isActive ? 'fit-content' : '0px',
          }}
        >
          <Button
            type="text"
            onClick={toggleCollapse}
            icon={<MenuUnfoldOutlined />}
            style={{
              backgroundColor: '#1a1a1a',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              paddingTop: 20,
            }}
          ></Button>
        </div>
      );
    }

    return (
      <>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div className={styles.roomInfo}>
                {/* <SvgResource.Hash className={styles.roomIcon} /> */}
                <span className={styles.roomName}>{roomName}</span>
              </div>
              <div className={styles.headerActions}>
                <Tag color="#22CCEE">
                  {allParticipants.length} {t('channel.menu.active')}
                </Tag>
                <Button
                  className={styles.collapseButton}
                  onClick={toggleCollapse}
                  icon={<MenuFoldOutlined />}
                  type="text"
                ></Button>
              </div>
            </div>
          </div>
          <div className={styles.main}>
            {/* Main Room */}
            <div>
              <Collapse
                bordered={false}
                defaultActiveKey={['main', 'sub']}
                activeKey={mainActiveKey}
                expandIcon={() => undefined}
                style={{ background: token.colorBgContainer }}
                items={mainItems}
              />
            </div>
          </div>
        </div>
        <Modal
          open={roomCreateModalOpen}
          title={t('channel.modal.title')}
          onCancel={() => {
            setRoomCreateModalOpen(false);
          }}
          onOk={createChildRoom}
          okText={t('channel.modal.ok')}
          cancelText={t('channel.modal.cancel')}
        >
          <p>{t('channel.modal.desc.0')}</p>
          <p>{t('channel.modal.desc.1')}</p>
          <Input
            placeholder={t('channel.modal.placeholder')}
            style={{
              outline: '1px solid #22CCEE',
            }}
            value={childRoomName}
            onChange={(e) => {
              setChildRoomName(e.target.value);
            }}
          ></Input>
          <div className={styles.modal_item}>
            <Popover
              content={
                <div style={{ maxWidth: 200 }}>
                  <p>{t('channel.modal.privacy.public.desc')}</p>
                  <p>{t('channel.modal.privacy.private.desc')}</p>
                </div>
              }
              title={t('channel.modal.privacy.title')}
            >
              <span className={styles.modal_item_label}>
                <LockOutlined />
                {t('channel.modal.privacy.title')}:
              </span>
            </Popover>
            <Radio.Group
              options={roomPrivacyOptions}
              defaultValue={roomPrivacy}
              value={roomPrivacy}
              onChange={(e) => {
                setRoomPrivacy(e.target.value as RoomPrivacy);
              }}
            />
          </div>
        </Modal>
        <Modal
          open={joinModalOpen}
          title={t('channel.modal.join.title')}
          onCancel={async () => await confirmJoinRoom(false)}
          onOk={async () => await confirmJoinRoom(true)}
          okText={t('channel.modal.join.ok')}
          cancelText={t('channel.modal.join.cancel')}
        >
          <p>
            {joinParticipant && joinParticipant.name} &nbsp; {t('channel.modal.join.want')}
          </p>
        </Modal>
        <Modal
          open={renameModalOpen}
          title={t('channel.menu.rename')}
          onCancel={() => setRenameModalOpen(false)}
          onOk={async () => await updateChildRoom('name')}
          okText={t('channel.modal.rename.ok')}
          cancelText={t('channel.modal.rename.cancel')}
        >
          <p>{t('channel.modal.rename.desc')}</p>
          <Input
            placeholder={t('channel.modal.rename.placeholder')}
            style={{
              outline: '1px solid #22CCEE',
            }}
            value={renameRoomName}
            onChange={(e) => {
              setRenameRoomName(e.target.value);
            }}
          ></Input>
        </Modal>
      </>
    );
  },
);
