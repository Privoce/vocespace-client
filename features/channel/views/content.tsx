import { GLayout } from '@/app/pages/layout/grid';
import { ParticipantTileMini } from '@/app/pages/participant/mini';
import { SvgResource } from '@/app/resources/svg';
import { FeedbackType, RoomPrivacy } from '@/features/channel/shared';
import {
  encodeChildRoomEnter
} from '@/lib/std';
import styles from '@/styles/channel.module.scss';
import {
  LockOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import {
  Button,
  Collapse,
  CollapseProps,
  Dropdown,
  Form,
  Input,
  Modal,
  Popover,
  Radio,
  Tag,
  Upload
} from 'antd';
import TextArea from 'antd/es/input/TextArea';
import {
  ReactNode
} from 'react';
import type { useChannel } from '../hooks/useChannel';
export type ChannelModel = ReturnType<typeof useChannel>;
export function getChannelContent(model: ChannelModel) {
  const {
    space,
    config,
    settings,
    messageApi,
    tracks,
    updateSettings,
    toRenameSettings,
    toSettings,
    setUserStatus,
    showFlotApp,
    t,
    token,
    roomCreateModalOpen,
    setRoomCreateModalOpen,
    selectedRoom,
    setSelectedRoom,
    mainJoinVis,
    setMainJoinVis,
    roomJoinVis,
    setRoomJoinVis,
    joinModalOpen,
    renameModalOpen,
    setRenameModalOpen,
    shareRoomOpen,
    setShareRoomOpen,
    feedbackOpen,
    feedbackType,
    setFeedbackType,
    feedbackUploading,
    feedbackSubmitting,
    feedbackUploads,
    renameRoomName,
    setRenameRoomName,
    joinParticipant,
    subActiveKey,
    setSubActiveKey,
    setMainActiveKey,
    roomPrivacy,
    setRoomPrivacy,
    feedbackForm,
    createRoom,
    roomPrivacyOptions,
    isMobile,
    feedbackTypeOptions,
    hideTimeoutRef,
    mainHideTimeoutRef,
    allParticipants,
    childRooms,
    childRoomName,
    setChildRoomName,
    createChildRoom,
    addIntoRoom,
    confirmJoinRoom,
    joinMainRoom,
    updateChildRoom,
    subContextItems,
    panelStyle,
    subStyle,
    shareRoomToClipboard,
    closeFeedbackModal,
    handleFeedbackUpload,
    submitFeedback,
  } = model;
  const mainContext: ReactNode = (() => {
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
          toSettings={toSettings}
          setUserStatus={setUserStatus}
          showFlotApp={showFlotApp}
          messageApi={messageApi}
        ></ParticipantTileMini>
      </GLayout>
    );
  })();
  const subContext = (name: string, length: number): ReactNode => {
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
          toSettings={toSettings}
          setUserStatus={setUserStatus}
          showFlotApp={showFlotApp}
          messageApi={messageApi}
        ></ParticipantTileMini>
      </GLayout>
    );
  };
  const subChildren: CollapseProps['items'] = (() => {
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
                className={styles.room_header_wrapper_title_name}
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
                  <LockOutlined style={{ fontSize: 16 }} />
                ) : (
                  <SvgResource type="public" svgSize={16} color="#aaa"></SvgResource>
                )}
                <Popover
                  content={
                    <button
                      className="vocespace_button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        shareRoomToClipboard(room.name, space.name);
                      }}
                    >
                      <SvgResource type={'add_user'} svgSize={16}></SvgResource>
                      {t('channel.menu.share')} {room.name}
                    </button>
                  }
                  placement="topRight"
                >
                  <div
                    className={styles.room_header_wrapper_title_name_title}
                    style={{
                      width: room.participants.length > 0 ? '100px' : '160px',
                      maxWidth: '160px',
                    }}
                  >
                    {room.name}
                  </div>
                </Popover>
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
  })();
  const mainItems: CollapseProps['items'] = (() => {
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
            {createRoom && (
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
            )}
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
  })();
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

      {selectedRoom && (
        <Modal
          open={shareRoomOpen}
          title={t('channel.menu.share_room')}
          onCancel={() => setShareRoomOpen(false)}
          okText={t('recording.copy.title')}
          cancelText={t('common.cancel')}
          onOk={() => shareRoomToClipboard()}
        >
          <p>
            {`https://${config.serverUrl}/${space.name}?childRoomEnter=${encodeChildRoomEnter(
              space.name,
              selectedRoom.name,
              space.localParticipant.identity,
            )}`}
          </p>
        </Modal>
      )}

      <Modal
        open={feedbackOpen}
        title={t('channel.feedback.title')}
        onCancel={closeFeedbackModal}
        onOk={submitFeedback}
        confirmLoading={feedbackSubmitting}
        okText={t('channel.feedback.submit')}
        cancelText={t('common.cancel')}
      >
        <Form
          form={feedbackForm}
          layout="vertical"
          initialValues={{ email: '', content: '', otherType: '' }}
        >
          <Form.Item
            label={t('channel.feedback.email')}
            name="email"
            rules={[
              { required: true, message: t('channel.feedback.validation.email_required') },
              { type: 'email', message: t('channel.feedback.validation.email_invalid') },
            ]}
          >
            <Input placeholder={t('channel.feedback.email_placeholder')} />
          </Form.Item>
          <Form.Item label={t('channel.feedback.type')}>
            <Radio.Group
              options={feedbackTypeOptions}
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
            />
          </Form.Item>
          {feedbackType === 'other' && (
            <Form.Item
              name="otherType"
              rules={[
                { required: true, message: t('channel.feedback.validation.type_required') },
              ]}
            >
              <Input placeholder={t('channel.feedback.other_placeholder')} />
            </Form.Item>
          )}
          <Form.Item
            label={t('channel.feedback.content')}
            name="content"
            rules={[
              { required: true, message: t('channel.feedback.validation.content_required') },
            ]}
          >
            <TextArea rows={5} placeholder={t('channel.feedback.content_placeholder')} />
          </Form.Item>
          <Form.Item label={t('channel.feedback.attachments')}>
            <Upload beforeUpload={handleFeedbackUpload} showUploadList={false} multiple>
              <Button loading={feedbackUploading}>{t('channel.feedback.upload_action')}</Button>
            </Upload>
            <div className={styles.feedback_hint}>{t('channel.feedback.upload_hint')}</div>
            <div className={styles.feedback_upload_list}>
              {feedbackUploads.map((item) => (
                <div key={item.uid} className={styles.feedback_upload_item}>
                  <span>{item.name}</span>
                  <span>
                    {item.status === 'uploading'
                      ? t('channel.feedback.uploading')
                      : item.status === 'done'
                        ? t('channel.feedback.upload_done')
                        : t('channel.feedback.upload_failed')}
                  </span>
                </div>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
  return { mainItems, modals: renderModals() };
}
