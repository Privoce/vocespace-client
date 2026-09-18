'use client';

import { FS } from '@/app/pages/chat/fs';
import { SvgResource } from '@/app/resources/svg';
import { ChatMsgItemCmp, ChatMsgTimeSplit } from '@/features/chat/shared';
import styles from '@/styles/chat.module.scss';
import {
  CloseOutlined,
  FolderOpenOutlined,
  SendOutlined,
  SnippetsOutlined,
} from '@ant-design/icons';
import { Button, Input, Modal, Tooltip, Upload } from 'antd';
import Dragger from 'antd/es/upload/Dragger';
import * as React from 'react';
import type { useChat } from '../hooks/useChat';
import { chatMessageKey } from '../message-key';

export type ChatPanelModel = ReturnType<typeof useChat>;
export function ChatContent({ model }: { model: ChatPanelModel }) {
  const {
    space,
    onClose,
    ref,
    t,
    ulRef,
    bottomRef,
    chatMsg,
    value,
    setValue,
    setIsComposing,
    dragOver,
    fsModal,
    setFsModal,
    files,
    canDeleteRBAC,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    sendMsg,
    handleBeforeUpload,
    handleKeyDown,
    isLocal,
    isImg,
    downloadFile,
    openLocalFileSystem,
  } = model;
  const msgList = (() => {
    let msgItemNodes: React.ReactNode[] = [];

    chatMsg.msgs.forEach((msg, index) => {
      // 判断是否需要添加时间分割线
      if (
        index !== 0 &&
        msg.timestamp &&
        chatMsg.msgs[index - 1] &&
        chatMsg.msgs[index - 1].timestamp
      ) {
        if (msg.timestamp - chatMsg.msgs[index - 1].timestamp > 5 * 60 * 1000) {
          msgItemNodes.push(
            <ChatMsgTimeSplit key={`time-split-${chatMessageKey(msg)}`} timestamp={msg.timestamp} />,
          );
        }
      }

      msgItemNodes.push(
        <ChatMsgItemCmp
          key={chatMessageKey(msg)}
          isLocal={isLocal(msg.sender.id)}
          msg={msg}
          downloadFile={downloadFile}
          isImg={isImg}
        ></ChatMsgItemCmp>,
      );
    });

    return msgItemNodes;
  })();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: model.device === 'phone' ? '#0c0f14' : '#1a1a1a',
      }}
    >
      {true && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t('common.chat')}</span>
          {onClose && (
            <Button
              type="text"
              aria-label={t('common.close')}
              size="small"
              icon={<CloseOutlined style={{ fontSize: 14, color: '#888' }} />}
              onClick={onClose}
              style={{ width: 28, height: 28 }}
            />
          )}
        </div>
      )}
      <div
        className={styles.msg}
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.msg_drag_area} style={{ display: dragOver ? 'flex' : 'none' }}>
          <SnippetsOutlined />
          <span>{t('common.chat_drag_file_here')}</span>
        </div>
        <Dragger
          style={{
            cursor: 'default',
            border: dragOver ? '1px dashed #22ccee' : '1px dashed transparent',
          }}
          multiple={false}
          name="file"
          beforeUpload={handleBeforeUpload}
          showUploadList={false}
          openFileDialogOnClick={false}
        >
          <ul ref={ulRef} className={styles.msg_list}>
            {msgList}
            <li ref={bottomRef} style={{ height: '1px', visibility: 'hidden', listStyle: 'none' }} />
          </ul>
        </Dragger>
      </div>

      <div
        style={{
          padding: '8px 8px 4px 8px',
          background: '#202020',
        }}
      >
        <Input.TextArea
          value={value}
          placeholder={t('common.chat_placeholder')}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoSize={{ minRows: 2, maxRows: 3 }}
          style={{
            background: '#202020',
            resize: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 14,
            padding: '0px 0',
            width: '100%',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Upload beforeUpload={handleBeforeUpload} showUploadList={false} accept="*">
              <Tooltip title={t('common.upload')}>
                <Button type="text" size="small" style={{ color: '#888', width: 32, height: 32 }}>
                  <SvgResource type="add" svgSize={14} color="#888" />
                </Button>
              </Tooltip>
            </Upload>
            <Tooltip title={t('common.files')}>
              <Button
                type="text"
                size="small"
                style={{ color: '#888', width: 32, height: 32 }}
                onClick={async () => await openLocalFileSystem()}
              >
                <FolderOpenOutlined style={{ fontSize: 14 }} />
              </Button>
            </Tooltip>
          </div>
          <Button type="primary" aria-label={t('common.send')} disabled={!value.trim()} onClick={sendMsg} icon={<SendOutlined></SendOutlined>}></Button>
        </div>
      </div>
      <Modal
        open={fsModal}
        title={t('common.files')}
        footer={null}
        onCancel={() => setFsModal(false)}
        width={640}
      >
        <FS
          space={space}
          files={files}
          onFresh={openLocalFileSystem}
          canDeleteRBAC={canDeleteRBAC}
        ></FS>
      </Modal>
    </div>
  );
}
