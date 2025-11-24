import * as React from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Button, Drawer, Image, Input, Popover, Upload } from 'antd';
import { pictureCallback, SvgResource } from '@/app/resources/svg';
import styles from '@/styles/chat.module.scss';
import { useI18n } from '@/lib/i18n/i18n';
import { ulid } from 'ulid';
import { Room } from 'livekit-client';
import { chatMsgState, socket } from '@/app/[spaceName]/PageClientImpl';
import { MessageInstance } from 'antd/es/message/interface';
import { useLinkPreview } from './link_preview';
import Dragger from 'antd/es/upload/Dragger';
import { useRecoilState } from 'recoil';
import { ChatMsgItem } from '@/lib/std/chat';
import { DEFAULT_DRAWER_PROP, DrawerCloser } from '../controls/drawer_tools';
import { SnippetsOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { FileType } from '@/lib/std';

export interface EnhancedChatProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onClose: () => void;
  space: Room;
  sendFileConfirm: (onOk: (abortController?: AbortController) => Promise<ChatMsgItem>) => void;
  messageApi: MessageInstance;
}

export interface EnhancedChatExports {}

export const EnhancedChat = React.forwardRef<EnhancedChatExports, EnhancedChatProps>(
  ({ open, setOpen, onClose, space, sendFileConfirm, messageApi }: EnhancedChatProps, ref) => {
    const { t } = useI18n();
    const ulRef = React.useRef<HTMLUListElement>(null);
    const bottomRef = React.useRef<HTMLDivElement>(null);
    const [chatMsg, setChatMsg] = useRecoilState(chatMsgState);
    // const [messages, setMessages] = React.useState<ChatMsgItem[]>([]);
    const [value, setValue] = React.useState('');
    const [unhandleMsgCount, setUnhandleMsgCount] = React.useState(0);
    // 添加输入法组合状态跟踪
    const [isComposing, setIsComposing] = React.useState(false);
    const [dragOver, setDragOver] = React.useState(false);
    const dragCounterRef = React.useRef(0);

    // 处理拖拽事件
    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;

      // 检查是否拖拽的是文件
      if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        setDragOver(true);
      }
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;

      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setDragOver(false);
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragOver(false);
    };

    React.useEffect(() => {
      if (open) {
        setChatMsg((prev) => ({
          unhandled: 0,
          msgs: prev.msgs,
        }));

        if (bottomRef.current) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              scrollToBottom();
            });
          });
        }
      }
    }, [open, bottomRef]);

    // [send methods] ----------------------------------------------------------------------------
    const sendMsg = async () => {
      const msg = value.trim();
      if (msg === '') {
        return;
      }

      const newMsg: ChatMsgItem = {
        sender: {
          id: space.localParticipant.identity,
          name: space.localParticipant.name || space.localParticipant.identity,
        },
        message: msg,
        type: 'text',
        roomName: space.name,
        file: null,
        timestamp: Date.now(),
      };

      setChatMsg((prev) => ({
        unhandled: prev.unhandled,
        msgs: [...prev.msgs, newMsg],
      }));
      setValue('');
      socket.emit('chat_msg', newMsg);
    };

    // [upload] ----------------------------------------------------------------------------------
    const handleBeforeUpload = (file: FileType) => {
      // 检查文件大小限制（建议限制为 10MB）
      const maxFileSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxFileSize) {
        messageApi.error({
          content: t('msg.error.file.too_large') + ' 100MB',
          duration: 3,
        });
        return false;
      }

      sendFileConfirm(async (abortController?: AbortController): Promise<ChatMsgItem> => {
        try {
          // 对于大文件，使用分块上传或直接上传到服务器
          if (file.size > 1 * 1024 * 1024) {
            // 大于1MB的文件
            return await handleLargeFileUpload(file, abortController);
          } else {
            // 小文件直接通过 Socket 发送
            return await handleSmallFileUpload(file);
          }
        } catch (e) {
          messageApi.error({
            content: `${t('msg.error.file.upload')}: ${e}`,
            duration: 3,
          });
          console.error('Error uploading file:', e);
          return Promise.reject(e);
        }
      });
      return false; // 阻止自动上传
    };

    // 处理小文件上传（通过 Socket）
    const handleSmallFileUpload = async (file: FileType): Promise<ChatMsgItem> => {
      return new Promise<ChatMsgItem>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData = e.target?.result;
          console.log('Small file upload:', file.size, file.name, file.type);

          const fileMessage: ChatMsgItem = {
            sender: {
              id: localParticipant.identity,
              name: localParticipant.name || localParticipant.identity,
            },
            message: null,
            type: 'file',
            roomName: space.name,
            file: {
              name: file.name,
              size: file.size,
              type: file.type,
              data: fileData,
            },
            timestamp: Date.now(),
          };

          // 发送文件消息
          // socket.emit('chat_file', fileMessage);
          resolve(fileMessage);
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
      });
    };

    // 处理大文件上传（通过 HTTP API）
    const handleLargeFileUpload = async (file: FileType, abortController?: AbortController): Promise<ChatMsgItem> => {
      try {
        const response = await api.uploadFile(file, space.name, localParticipant, abortController);

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Large file upload success:', result);

        // 创建文件消息，使用服务器返回的 URL
        let timestamp = Date.now();
        const fileMessage: ChatMsgItem = {
          id: timestamp.toString(),
          sender: {
            id: localParticipant.identity,
            name: localParticipant.name || localParticipant.identity,
          },
          message: `file: ${file.name}`,
          type: 'file',
          roomName: space.name,
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            url: result.fileUrl, // 使用文件服务 API
          },
          timestamp,
        };
        return fileMessage;
      } catch (error) {
        console.error('Large file upload failed:', error);
        throw error;
      }
    };

    const scrollToBottom = () => {
      // 使用 scrollIntoView，更可靠
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest',
      });
    };

    // 处理回车键事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 只有在不处于输入法组合状态且按下回车键时才发送消息
      if (e.key === 'Enter' && !isComposing) {
        e.preventDefault();
        sendMsg();
      }
    };

    const { localParticipant } = useLocalParticipant();
    const isLocal = (identity?: string): boolean => {
      if (identity) {
        console.log('localParticipant', identity, localParticipant.identity);
        return localParticipant.identity === identity;
      } else {
        return false;
      }
    };

    const isImg = (type: string) => {
      return type.startsWith('image/');
    };

    const downloadFile = async (url?: string) => {
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = url.split('/').pop() || 'file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        messageApi.error({
          content: t('msg.error.file.download'),
          duration: 1,
        });
      }
    };

    React.useLayoutEffect(() => {
      scrollToBottom();
    }, [chatMsg.msgs]);

    const msgList = React.useMemo(() => {
      // return chatMsg.msgs.map((msg) => (
      //   <ChatMsgItemCmp
      //     key={msg.id || ulid()}
      //     isLocal={isLocal(msg.sender.id)}
      //     msg={msg}
      //     downloadFile={downloadFile}
      //     isImg={isImg}
      //   ></ChatMsgItemCmp>
      // ));

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
              <ChatMsgTimeSplit key={`time-split-${msg.id || ulid()}`} timestamp={msg.timestamp} />,
            );
          }
        }

        msgItemNodes.push(
          <ChatMsgItemCmp
            key={msg.id || ulid()}
            isLocal={isLocal(msg.sender.id)}
            msg={msg}
            downloadFile={downloadFile}
            isImg={isImg}
          ></ChatMsgItemCmp>,
        );
      });

      return msgItemNodes;
    }, [chatMsg.msgs]);

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
        <div
          className={styles.msg}
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
              <div ref={bottomRef} style={{ height: '1px', visibility: 'hidden' }} />
            </ul>
          </Dragger>
        </div>

        <div className={styles.tool}>
          <Upload beforeUpload={handleBeforeUpload} showUploadList={false} accept="*">
            <Button shape="circle" style={{ background: 'transparent', border: 'none' }}>
              <SvgResource type="add" svgSize={18} color="#fff" />
            </Button>
          </Upload>
          <div className={styles.tool_input}>
            <Input
              value={value}
              placeholder={t('common.chat_placeholder')}
              onChange={(e) => setValue(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={handleKeyDown}
              style={{ paddingRight: 0, backgroundColor: '#333' }}
            />
          </div>
          <Button style={{ border: 'none' }} type="primary" onClick={sendMsg}>
            {t('common.send')}
          </Button>
        </div>
      </Drawer>
    );
  },
);

interface ChatMsgItemProps {
  isLocal: boolean;
  msg: ChatMsgItem;
  downloadFile: (url?: string) => Promise<void>;
  isImg: (type: string) => boolean;
}

function ChatMsgItemCmp({ isLocal, msg, downloadFile, isImg }: ChatMsgItemProps) {
  const liClass = isLocal ? styles.msg_item : styles.msg_item__remote;
  const flexEnd = isLocal ? { justifyContent: 'flex-end' } : {};
  const textAlignPos = isLocal ? 'end' : 'left';
  const itemClass = isLocal ? styles.msg_item_wrapper : styles.msg_item__remote_wrapper;

  // 判断是否有URL，这里只需要判断URL的基本格式(http/https)
  const containsUrl = (text: string) => {
    // 正则表达式：匹配常见的 URL 格式
    const urlRegex =
      /https?:\/\/[\w\-_]+(\.[\w\-_]+)+(?:[\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/i;
    return urlRegex.test(text);
  };

  const { link, linkPreview } = useLinkPreview({
    text: msg.message || undefined,
    isLocal,
  });

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
        parts.push(<span key={`text-${linkIndex}-before`}>{textBefore}</span>);
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
      parts.push(<span key={`text-${linkIndex}-after`}>{textAfter}</span>);
    }

    // 如果没有找到任何链接，返回原始文本
    if (parts.length === 0) {
      return originText;
    }

    return <>{parts}</>;
  };

  return (
    <li className={liClass}>
      <div className={itemClass}>
        <div className={styles.msg_item_content} style={flexEnd}>
          <h4 className={styles.msg_item_content_name} style={{ textAlign: textAlignPos }}>
            {msg.sender.name || 'unknown'}
          </h4>
          {msg.type === 'text' ? (
            <div className={styles.msg_item_content_wrapper} style={flexEnd}>
              <div
                className={styles.msg_item_content_msg}
                style={{
                  textAlign: 'left',
                }}
              >
                {mixLinkText(msg.message || '')}
              </div>
              {msg.message && containsUrl(msg.message) && linkPreview}
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
                <div className={styles.msg_item_content_msg}>
                  {isImg(msg.file.type) ? (
                    <Image
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

function ChatMsgTimeSplit({ timestamp }: { timestamp: number }) {
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return <li className={styles.msg_time_split}>{time}</li>;
}
