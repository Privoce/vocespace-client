'use client';

import { useLayoutDevice } from '@/lib/hooks/use-layout-device';

import { ChatPanel } from '@/app/pages/chat/chat';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from '@/app/pages/controls/drawer_tools';
import { pictureCallback, SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { ChatMsgItem } from '@/lib/std/chat';
import { SpaceInfo } from '@/lib/std/space';
import { useRoomStore } from '@/lib/store';
import styles from '@/styles/chat.module.scss';
import { Button, Drawer, Image, Popover } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import { Room } from 'livekit-client';
import * as React from 'react';
export interface EnhancedChatProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onClose: () => void;
  space: Room;
  sendFileConfirm: (onOk: (abortController?: AbortController) => Promise<ChatMsgItem>) => void;
  messageApi: MessageInstance;
  spaceInfo: SpaceInfo;
}

export interface ChatPanelProps {
  space: Room;
  sendFileConfirm: (onOk: (abortController?: AbortController) => Promise<ChatMsgItem>) => void;
  messageApi: MessageInstance;
  spaceInfo: SpaceInfo;
  onClose?: () => void;
}

export interface EnhancedChatExports { }

export const EnhancedChat = React.forwardRef<EnhancedChatExports, EnhancedChatProps>(
  function EnhancedChat(
    { open, setOpen, onClose, space, sendFileConfirm, messageApi, spaceInfo }: EnhancedChatProps,
    ref,
  ) {
    const { t } = useI18n();
    const device = useLayoutDevice();
    const chatMsg = useRoomStore((s) => s.chatMsg);

    React.useEffect(() => {
      if (open) {
        useRoomStore.getState().setChatMsg((prev) => ({
          unhandled: 0,
          msgs: prev.msgs,
        }));
      }
    }, [open]);

    if (device === 'phone') return open ? <ChatPanel ref={ref} space={space} sendFileConfirm={sendFileConfirm} messageApi={messageApi} spaceInfo={spaceInfo} onClose={() => { setOpen(false); onClose(); }} /> : null;
    return (
      <Drawer
        {...DEFAULT_DRAWER_PROP}
        title={t('common.chat')}
        onClose={onClose}
        open={open}
        extra={DrawerCloser({
          on_clicked: () => setOpen(false),
        })}
        styles={{
          body: {
            ...DEFAULT_DRAWER_PROP.styles?.body,
            padding: 0,
          },
        }}
      >
        <ChatPanel
          ref={ref}
          space={space}
          sendFileConfirm={sendFileConfirm}
          messageApi={messageApi}
          spaceInfo={spaceInfo}
        />
      </Drawer>
    );
  },
);

export interface ChatMsgItemProps {
  isLocal: boolean;
  msg: ChatMsgItem;
  downloadFile: (url?: string) => Promise<void>;
  isImg: (type: string) => boolean;
}

export function ChatMsgItemCmp({ isLocal, msg, downloadFile, isImg }: ChatMsgItemProps) {
  const liClass = isLocal ? styles.msg_item : styles.msg_item__remote;
  const flexEnd = isLocal ? { justifyContent: 'flex-end' } : {};
  const textAlignPos = isLocal ? 'end' : 'left';
  const itemClass = isLocal ? styles.msg_item_wrapper : styles.msg_item__remote_wrapper;

  const mixLinkText = (originText: string, previewLink?: string) => {
    // URL 正则表达式，匹配 http 和 https 链接
    const urlRegex =
      /https?:\/\/[\w\-_]+(\.[\w\-_]+)+(?:[\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/gi;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let linkIndex = 0;

    // 重置正则表达式的 lastIndex
    urlRegex.lastIndex = 0;

    while ((match = urlRegex.exec(originText)) !== null) {
      const url = match[0];
      const startIndex = match.index;

      // 添加链接前的普通文本
      if (startIndex > lastIndex) {
        const textBefore = originText.substring(lastIndex, startIndex);
        // 处理文本中的换行符
        const textWithBreaks = textBefore.split('\n').map((line, idx, arr) => (
          <React.Fragment key={`text-${linkIndex}-before-${idx}`}>
            {line}
            {idx < arr.length - 1 && <br />}
          </React.Fragment>
        ));
        parts.push(<span key={`text-${linkIndex}-before`}>{textWithBreaks}</span>);
      }

      // 添加链接
      parts.push(
        <a
          key={`link-${linkIndex}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#22CCEE',
            textDecoration: 'underline',
          }}
          onClick={(e) => {
            e.stopPropagation(); // 防止冒泡
          }}
        >
          {url}
        </a>,
      );

      lastIndex = startIndex + url.length;
      linkIndex++;
    }

    // 添加最后剩余的普通文本
    if (lastIndex < originText.length) {
      const textAfter = originText.substring(lastIndex);
      // 处理文本中的换行符
      const textWithBreaks = textAfter.split('\n').map((line, idx, arr) => (
        <React.Fragment key={`text-${linkIndex}-after-${idx}`}>
          {line}
          {idx < arr.length - 1 && <br />}
        </React.Fragment>
      ));
      parts.push(<span key={`text-${linkIndex}-after`}>{textWithBreaks}</span>);
    }

    // 如果没有找到任何链接，返回原始文本并处理换行符
    if (parts.length === 0) {
      return originText.split('\n').map((line, idx, arr) => (
        <React.Fragment key={`text-${idx}`}>
          {line}
          {idx < arr.length - 1 && <br />}
        </React.Fragment>
      ));
    }

    return <>{parts}</>;
  };

  return (
    <li data-local={isLocal} className={liClass}>
      <div className={itemClass}>
        <div className={styles.msg_item_content} style={flexEnd}>
          <h4 className={styles.msg_item_content_name} style={{ textAlign: textAlignPos }}>
            {msg.sender.name || 'unknown'}
          </h4>
          {msg.type === 'text' ? (
            <div className={styles.msg_item_content_wrapper} style={flexEnd}>
              <div
                data-message="true" className={styles.msg_item_content_msg}
                style={{
                  textAlign: 'left',
                }}
              >
                {mixLinkText(msg.message || '')}
              </div>
              {/* {msg.message && containsUrl(msg.message) && linkPreview} */}
            </div>
          ) : (
            <Popover
              placement="right"
              style={{ background: '#1E1E1E' }}
              content={
                <Button shape="circle" type="text" onClick={() => downloadFile(msg?.file?.url)}>
                  <SvgResource type="download" svgSize={16} color="#22CCEE"></SvgResource>
                </Button>
              }
            >
              {msg.file && (
                <div data-message="true" className={styles.msg_item_content_msg}>
                  {isImg(msg.file.type) ? (
                    <Image alt={msg.file?.name || ""}
                      src={msg.file.url}
                      width={'100%'}
                      fallback={pictureCallback}
                      height={160}
                    ></Image>
                  ) : (
                    <div className={styles.msg_item_content_msg_file}>
                      <a href={msg.file.url} target="_blank" rel="noopener noreferrer">
                        <SvgResource type="file" color="#22CCEE" svgSize={42}></SvgResource>
                      </a>
                      <div className={styles.msg_item_content_msg_file_info}>
                        <h4>{msg.file.name}</h4>
                        <div>{Math.round(msg.file.size / 1024)}KB</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Popover>
          )}
        </div>
      </div>
    </li>
  );
}

export function ChatMsgTimeSplit({ timestamp }: { timestamp: number }) {
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return <li className={styles.msg_time_split}>{time}</li>;
}
