'use client';

import {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from '@/styles/channel.module.scss';
import { useI18n } from '@/lib/i18n/i18n';
import { SvgResource } from '@/app/resources/svg';
import {
  Badge,
  Button,
  Collapse,
  CollapseProps,
  Drawer,
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
import { AppKey, ChildRoom, ParticipantSettings, SpaceInfo } from '@/lib/std/space';
import { ParticipantTileMini } from '../participant/mini';
import { GLayout } from '../layout/grid';
import { CheckboxGroupProps } from 'antd/es/checkbox';
import { socket } from '@/app/[spaceName]/PageClientImpl';
import { WsJoinRoom, WsRemove, WsSender } from '@/lib/std/device';
import { api } from '@/lib/api';
import { UpdateRoomParam, UpdateRoomType } from '@/lib/api/channel';
import { Room } from 'livekit-client';
import { isMobile as is_mobile, UserStatus } from '@/lib/std';
import { DEFAULT_DRAWER_PROP } from './drawer_tools';

interface ChannelProps {
  // roomName: string;
  space: Room;
  messageApi: MessageInstance;
  localParticipantId: string;
  onUpdate: () => Promise<void>;
  tracks: TrackReferenceOrPlaceholder[];
  settings: SpaceInfo;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isActive?: boolean;
  updateSettings: (newSettings: Partial<ParticipantSettings>) => Promise<boolean | undefined>;
  toRenameSettings: () => void;
  setUserStatus: (status: UserStatus | string) => Promise<void>;
  showSingleFlotApp: (appKey: AppKey) => void;
}

export interface ChannelExports {
  join: (room: ChildRoom, participantId: string) => Promise<void>;
  joinMain: () => Promise<void>;
}

type RoomPrivacy = 'public' | 'private';

export const Channel = forwardRef<ChannelExports, ChannelProps>(
  (
    {
      space,
      settings,
      messageApi,
      localParticipantId,
      onUpdate,
      tracks,
      collapsed,
      setCollapsed,
      isActive = false,
      updateSettings,
      toRenameSettings,
      setUserStatus,
      showSingleFlotApp,
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
    const [selfRoomName, setSelfRoomName] = useState<string>(space.name);
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
    const isMobile = useMemo(() => {
      return is_mobile();
    }, []);

    // 用于清除延迟隐藏的 timeout
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mainHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
      // 设置默认展开的子房间的Collapse body基于subRoomsTmp
      let currentRooms = settings.children.map((room) => room.name);
      let isSameAsSubTmp =
        subRoomsTmp.length > 0 ? subRoomsTmp.every((room) => currentRooms.includes(room)) : false;
      if (settings.children.length > 0 && !isSameAsSubTmp) {
        let newRooms: string[] = [];
        // 同时如果子房间是公开的，默认展开
        for (const child of settings.children) {
          newRooms.push(child.name);
          if (!child.isPrivate) {
            console.warn('public room auto expand', child.name);
            setSubActiveKey((prev) => [...prev, child.name]);
            continue;
          }
          if (!subRoomsTmp.includes(child.name) && child.participants.length > 0) {
            setSubActiveKey((prev) => [...prev, child.name]);
            continue;
          }
          // 如果当前这个本地用户在子房间中，需要展开这个子房间
          if (child.participants.includes(localParticipantId)) {
            setSubActiveKey((prev) => [...prev, child.name]);
            continue;
          }
        }
        setSubRoomsTmp(newRooms);
      }
    }, [settings.children, localParticipantId, subRoomsTmp]);

    const allParticipants = useMemo(() => {
      // console.warn(Object.keys(settings.participants).length, settings.participants);
      return Object.keys(settings.participants);
    }, [settings]);

    const wsSender = useMemo(() => {
      if (
        settings &&
        space.name &&
        localParticipantId &&
        settings.participants[localParticipantId]
      ) {
        const senderName = settings.participants[localParticipantId].name;
        return {
          space: space.name,
          senderName,
          senderId: localParticipantId,
        } as WsSender;
      } else {
        return null;
      }
    }, [space.name, localParticipantId, settings]);

    const agreeJoinRoom = async (room: string) => {
      setSelfRoomName(room);
      setSubActiveKey((prev) => {
        const newSubActiveKey = [...prev];
        if (!prev.includes(room)) {
          newSubActiveKey.push(room);
        }
        return newSubActiveKey;
      });
      // setMainActiveKey(['sub']);
      await onUpdate();
      messageApi.success({
        content: t('channel.join.success'),
        duration: 2,
      });
    };

    useEffect(() => {
      // 监听加入私密房间的socket事件 --------------------------------------------------------------------------
      socket.on('join_privacy_room_response', (msg: WsJoinRoom) => {
        if (msg.space === space.name && msg.receiverId === localParticipantId) {
          if (!joinModalOpen) {
            if (msg.confirm === false) {
              // 说明对方拒绝了加入请求
              messageApi.warning({
                content: t('channel.modal.join.reject'),
              });
              setJoinModalOpen(false);
            } else if (msg.confirm) {
              //同意加入
              agreeJoinRoom(msg.childRoom);
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
        if (msg.space === space.name && msg.participants.includes(localParticipantId)) {
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

        // 清理延迟隐藏的 timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        if (mainHideTimeoutRef.current) {
          clearTimeout(mainHideTimeoutRef.current);
        }
      };
    }, [socket, space.name, localParticipantId, joinModalOpen]);

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

      const response = await api.createRoom({
        spaceName: space.name,
        roomName: childRoomName,
        ownerId: localParticipantId,
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
          space: space.name,
          participants: selectedRoom.participants,
          socketIds,
          childRoom: selectedRoom.name,
        } as WsRemove);
      }

      const response = await api.deleteRoom({
        spaceName: space.name,
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

      const response = await api.leaveRoom({
        spaceName: space.name,
        roomName: room || selectedRoom!.name,
        participantId: localParticipantId,
      });

      if (!response.ok) {
        const { error } = await response.json();
        messageApi.error({
          content: error,
          duration: 2,
        });
      } else {
        setSelfRoomName(space.name);
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
      const response = await api.joinRoom({
        spaceName: space.name,
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
        await agreeJoinRoom(room.name);
      }
    };

    const addIntoRoom = async (room: ChildRoom) => {
      // 判断是否为私密房间，如果是则需要使用socket通知拥有者
      if (room.isPrivate && room.ownerId !== localParticipantId) {
        // 只有当前房间的拥有者在Space中才能发送这个请求
        if (settings.participants[room.ownerId]) {
          socket.emit('join_privacy_room', {
            receiverId: room.ownerId,
            socketId: settings.participants[room.ownerId].socketId,
            childRoom: room.name,
            ...wsSender,
          } as WsJoinRoom);
        } else {
          messageApi.warning(t('channel.modal.join.missing_owner'));
        }

        return;
      }
      await joinChildRoom(room, localParticipantId);
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
      }
      socket.emit('join_privacy_room', {
        receiverId: joinParticipant.id,
        socketId: settings.participants[joinParticipant.id].socketId,
        childRoom: joinParticipant.targetRoom,
        confirm,
        ...wsSender,
      } as WsJoinRoom);
      setJoinParticipant(null);
      setJoinModalOpen(false);
    };

    const joinMainRoom = async () => {
      // 设置为当前自己所在的房间
      console.warn('selfRoomName', selfRoomName);
      await leaveChildRoom(selfRoomName);
    };

    const updateChildRoom = async (ty: UpdateRoomType) => {
      if (!selectedRoom) return;
      let isRename = ty === 'name';
      let param = {
        ty,
        spaceName: space.name,
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

      const response = await api.updateRoom(param);

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
      if (localParticipantId === settings.ownerId) {
        return false;
      } else {
        return selectedRoom?.ownerId !== localParticipantId;
      }
    }, [settings.ownerId, selectedRoom, localParticipantId]);

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
          <ParticipantTileMini
            settings={settings}
            space={space}
            updateSettings={updateSettings}
            toRenameSettings={toRenameSettings}
            setUserStatus={setUserStatus}
            showSingleFlotApp={showSingleFlotApp}
          ></ParticipantTileMini>
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

        let subTracks = tracks.filter(
          (track) =>
            childRoom.participants.includes(track.participant.identity) &&
            allParticipants.includes(track.participant.identity),
        );

        return (
          <GLayout tracks={subTracks} style={{ height: '120px', position: 'relative' }}>
            <ParticipantTileMini
              settings={settings}
              space={space}
              updateSettings={updateSettings}
              toRenameSettings={toRenameSettings}
              setUserStatus={setUserStatus}
              showSingleFlotApp={showSingleFlotApp}
            ></ParticipantTileMini>
          </GLayout>
        );
      },
      [tracks, childRooms, settings, space, allParticipants],
    );

    const subChildren: CollapseProps['items'] = useMemo(() => {
      return childRooms.map((room, index) => ({
        key: room.name,
        label: (
          <div
            className={styles.room_header_wrapper}
            onMouseEnter={() => {
              if (!isMobile) setRoomJoinVis(index);
            }}
            onMouseLeave={() => {
              if (!isMobile) setRoomJoinVis(null);
            }}
            onTouchStart={() => {
              if (isMobile) {
                // 清除之前的延迟隐藏
                if (hideTimeoutRef.current) {
                  clearTimeout(hideTimeoutRef.current);
                }
                setRoomJoinVis(index);
              }
            }}
            onTouchEnd={() => {
              if (isMobile) {
                // 延迟隐藏，给用户时间点击按钮
                hideTimeoutRef.current = setTimeout(() => setRoomJoinVis(null), 3000);
              }
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
              style={{
                visibility: roomJoinVis === index ? 'visible' : 'hidden',
              }}
            >
              <button
                onClick={() => {
                  addIntoRoom(room);
                  // 移动设备上点击后立即隐藏按钮并清除延迟
                  if (isMobile) {
                    if (hideTimeoutRef.current) {
                      clearTimeout(hideTimeoutRef.current);
                    }
                    setRoomJoinVis(null);
                  }
                }}
                className="vocespace_button"
              >
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
                if (!isMobile) setMainJoinVis('visible');
              }}
              onMouseLeave={() => {
                if (!isMobile) setMainJoinVis('hidden');
              }}
              onTouchStart={() => {
                if (isMobile) {
                  // 清除之前的延迟隐藏
                  if (mainHideTimeoutRef.current) {
                    clearTimeout(mainHideTimeoutRef.current);
                  }
                  setMainJoinVis('visible');
                }
              }}
              onTouchEnd={() => {
                if (isMobile) {
                  // 延迟隐藏，给用户时间点击按钮
                  mainHideTimeoutRef.current = setTimeout(() => setMainJoinVis('hidden'), 3000);
                }
              }}
            >
              <div
                className={styles.room_header_wrapper_title}
                onClick={() => {
                  setMainActiveKey((prev) => {
                    if (prev.includes('main')) {
                      return ['sub'];
                    }
                    return ['main', 'sub'];
                  });
                }}
              >
                <SvgResource type="space" svgSize={16} color="#aaa"></SvgResource>
                <span>{t('channel.menu.main')}</span>
              </div>

              <div
                className={styles.room_header_extra}
                style={{
                  visibility: mainJoinVis,
                }}
              >
                <button
                  onClick={() => {
                    joinMainRoom();
                    // 移动设备上点击后立即隐藏按钮并清除延迟
                    if (isMobile) {
                      if (mainHideTimeoutRef.current) {
                        clearTimeout(mainHideTimeoutRef.current);
                      }
                      setMainJoinVis('hidden');
                    }
                  }}
                  className="vocespace_button"
                >
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

    useImperativeHandle(ref, () => ({
      join: joinChildRoom,
      joinMain: joinMainRoom,
    }));

    // 将重复的 Modal 组件提取为公共组件
    const renderModals = () => (
      <>
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
            value={renameRoomName}
            onChange={(e) => {
              setRenameRoomName(e.target.value);
            }}
          ></Input>
        </Modal>
      </>
    );

    if (isMobile) {
      // 手机上侧边栏需要做成Drawer的形式
      return (
        <>
          {collapsed && (
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
          )}
          <Drawer
            {...DEFAULT_DRAWER_PROP}
            placement="left"
            styles={{
              header: {
                backgroundColor: '#1e1e1e',
              },
              body: {
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                overflow: 'hidden',
                backgroundColor: '#1e1e1e',
              },
            }}
            width={'100%'}
            title={
              <div className={styles.header_mobile}>
                <span className={styles.roomName}>{space.name}</span>
                <Tag color="#22CCEE">
                  {allParticipants.length} {t('channel.menu.active')}
                </Tag>
              </div>
            }
            open={!collapsed}
            extra={
              <Button
                className={styles.collapseButton}
                onClick={toggleCollapse}
                icon={<MenuFoldOutlined />}
                type="text"
              ></Button>
            }
          >
            <div className={styles.main_mobile}>
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
          </Drawer>
          {renderModals()}
        </>
      );
    } else {
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
                  <span className={styles.roomName}>{space.name}</span>
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
          {renderModals()}
        </>
      );
    }
  },
);
