import { AICutAnalysisRes, AICutAnalysisResLine } from '@/lib/ai/analysis';
import { Button, Empty, Image, Tag, Tooltip } from 'antd';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '@/styles/apps.module.scss';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/i18n';
import { AICutParticipantConf, SpaceInfo } from '@/lib/std/space';
import { useLocalParticipant } from '@livekit/components-react';
import { CopyButton, CopyButtonExports } from '../controls/widgets/copy';
import { MessageInstance } from 'antd/es/message/interface';
import { AICutService } from '@/lib/ai/cut';

export interface AICutAnalysisMdTabsProps {
  result?: AICutAnalysisRes;
  reloadResult?: () => Promise<void>;
  style: React.CSSProperties;
  showSettings?: (open: boolean) => void;
  setFlotAppOpen?: (open: boolean) => void;
  startOrStopAICutAnalysis?: (
    freq: number,
    conf: AICutParticipantConf,
    reload?: boolean,
  ) => Promise<void>;
  openAIServiceAskNote?: () => void;
  spaceInfo: SpaceInfo;
  userId: string;
  messageApi: MessageInstance;
  isSelf: boolean;
  // 需要裁剪服务的实例
  cutInstance: AICutService;
  isAuthed: boolean;
}

const storageUrl = (path: string) => {
  return `https://ngzobewgavfuvkrhhnou.supabase.co/storage/v1/object/public/ai_analysis/public/${path}.jpg`;
};

interface Section {
  name: string;
  timestamp: number;
  content: string;
  screenshot?: string;
  sameshot?: string;
  duration?: number;
}

export interface AICutAnalysisMdTabsExports {
  downloadMdReport: () => Promise<void>;
}

export const AICutAnalysisMdTabs = forwardRef<AICutAnalysisMdTabsExports, AICutAnalysisMdTabsProps>(
  (
    {
      style,
      showSettings,
      result,
      reloadResult,
      setFlotAppOpen,
      startOrStopAICutAnalysis,
      spaceInfo,
      userId,
      openAIServiceAskNote,
      messageApi,
      isSelf,
      cutInstance,
      isAuthed,
    }: AICutAnalysisMdTabsProps,
    ref,
  ) => {
    const { t } = useI18n();
    const { localParticipant } = useLocalParticipant();
    const CopyButtonRef = useRef<CopyButtonExports>(null);
    // 生成结构化的内容，而不是纯 markdown 字符串
    const contentSections: Section[] = useMemo(() => {
      if (!result) return [];

      const flattenedLines = result.lines.flat();
      return flattenedLines.map((line: AICutAnalysisResLine) => {
        const screenShots = cutInstance.getScreenshots();
        const cutScreenShot = screenShots.find((shot) => shot.timestamp === line.timestamp);
        const sameScreenShot = line.same
          ? screenShots.find((shot) => shot.timestamp === line.same)?.data || line.same.toString()
          : undefined;

        return {
          name: line.name,
          timestamp: line.timestamp,
          content: line.content,
          screenshot: cutScreenShot?.data,
          sameshot: sameScreenShot,
          duration: line.duration, // 如果用户启用了时间统计功能，需要显示
        };
      });
    }, [result, cutInstance]);

    const showTime = useMemo(() => {
      return {
        spent: spaceInfo.participants[userId]?.ai.cut.spent,
      };
    }, [spaceInfo, userId]);

    // 纯文本 markdown，用于复制
    const md = useMemo(() => {
      // 复制就不需要考虑图片问题，采用纯文本方式，图片则使用download方式下载到用户Downloads目录中即可，但需要修改图片的命名
      if (contentSections.length === 0) return 'empty';

      let mdRes = contentSections
        .map((section) => {
          const title =
            (section.name ? `## ${section.name}` : '') +
            ` (start: ${new Date(section.timestamp).toLocaleString()} duration: ${
              section.duration
            })\n\n`;
          return (
            title +
            section.content +
            (section.screenshot
              ? `\n\n![${section.timestamp}](replace/to/download/screenshot_${section.timestamp}.jpg)`
              : '')
          );
        })
        .join('\n\n---\n\n');

      return mdRes;
    }, [contentSections]);

    const downloadFromUrl = async (url: string, filename: string) => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) {
          // fallback: open in new tab
          window.open(url, '_blank');
          return;
        }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      } catch (e) {
        console.error('downloadFromUrl failed:', e);
        window.open(url, '_blank');
      }
    };

    const downloadImgs = () => {
      contentSections.forEach((section) => {
        if (section.screenshot && section.screenshot.startsWith('data:')) {
          cutInstance.downloadTargetScreenshot(section.timestamp);
        } else {
          console.warn("doiwnload from url because it's not data url");
          // 说明是来自云端的图片
          downloadFromUrl(
            storageUrl(`${userId}_${section.timestamp}`),
            `screenshot_${section.timestamp}.jpg`,
          );
        }
        if (section.sameshot && section.sameshot.startsWith('data:')) {
          cutInstance.downloadTargetScreenshot(section.sameshot as unknown as number);
        } else {
          downloadFromUrl(
            storageUrl(`${userId}_${section.sameshot}`),
            `screenshot_${section.sameshot}.jpg`,
          );
        }
      });
    };

    const cutParams = useMemo(() => {
      let realUserId = !userId ? localParticipant.identity : userId;

      const { todo, spent, enabled, extraction, blur } = spaceInfo.participants[realUserId]?.ai.cut;
      return {
        freq: spaceInfo.ai.cut.freq,
        spent: spent || false,
        todo: todo || false,
        extraction,
        isSelf,
        enabled: enabled || false,
        blur,
      };
    }, [spaceInfo, userId, localParticipant, isSelf]);

    useImperativeHandle(ref, () => ({
      downloadMdReport: async () => {
        if (CopyButtonRef.current) {
          await CopyButtonRef.current.copyToClipboard();
        } else {
          // 手动实现复制逻辑
          try {
            await navigator.clipboard.writeText(md);
            messageApi.success(t('common.copy.success'));
          } catch (e) {
            messageApi.error(t('common.copy.error'));
          }
        }

        // 下载图片
        downloadImgs();
      },
    }));

    return (
      <div
        style={{
          ...style,
          marginBottom: 8,
          backgroundColor: '#F59346',
          minHeight: '420px',
          maxHeight: 'calc(100vh - 60px)',
        }}
      >
        <div className={styles.ai_analysis_md_header}>
          <div>{t('ai.cut.report')}</div>
          {cutParams.isSelf && (
            <div className={styles.ai_analysis_md_icons}>
              <Tooltip title={t('ai.cut.reload')}>
                <ReloadOutlined
                  className={styles.ai_analysis_md_header_icon}
                  onClick={() => {
                    reloadResult && reloadResult();
                  }}
                />
              </Tooltip>
              <Tooltip title={t('ai.cut.title')}>
                <SettingOutlined
                  className={styles.ai_analysis_md_header_icon}
                  onClick={() => {
                    setFlotAppOpen && setFlotAppOpen(false);
                    showSettings && showSettings(true);
                  }}
                />
              </Tooltip>
              <CopyButton
                text={md}
                messageApi={messageApi}
                onExtraCopy={downloadImgs}
                ref={CopyButtonRef}
              ></CopyButton>
            </div>
          )}
        </div>
        {isSelf && (
          <div className={styles.ai_analysis_md_subheader}>
            <div>
              <Tag>Today</Tag>: {new Date().toLocaleDateString()}
            </div>
            <Button
              type="primary"
              icon={
                cutParams.enabled ? (
                  <PauseCircleOutlined className={styles.ai_analysis_md_header_icon} />
                ) : (
                  <PlayCircleOutlined className={styles.ai_analysis_md_header_icon} />
                )
              }
              onClick={() => {
                if (cutParams.enabled) {
                  startOrStopAICutAnalysis &&
                    startOrStopAICutAnalysis(cutParams.freq, {
                      enabled: false,
                      spent: cutParams.spent,
                      todo: cutParams.todo,
                      extraction: cutParams.extraction,
                      blur: cutParams.blur,
                    });
                } else {
                  if (!localParticipant.isScreenShareEnabled) {
                    openAIServiceAskNote && openAIServiceAskNote();
                    return;
                  }
                  if (localParticipant.isScreenShareEnabled) {
                    startOrStopAICutAnalysis &&
                      startOrStopAICutAnalysis(cutParams.freq, {
                        enabled: true,
                        spent: cutParams.spent,
                        todo: cutParams.todo,
                        extraction: cutParams.extraction,
                        blur: cutParams.blur,
                      });
                  }
                }
              }}
            >
              {t(cutParams.enabled ? 'ai.cut.stop' : 'ai.cut.start')}
            </Button>
          </div>
        )}
        <div className={styles.ai_analysis_md_content}>
          {contentSections.length === 0 ? (
            <div className={styles.ai_analysis_md_empty}>
              <Empty description={t('ai.cut.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <div>
              {contentSections.map((section, index) => (
                <div key={index} style={{ marginBottom: '32px' }}>
                  {/* 标题和时间戳 */}
                  {section.name && (
                    <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '8px' }}>
                      {section.name}
                    </h2>
                  )}
                  {showTime.spent && (
                    <p
                      style={{
                        color: '#888',
                        fontSize: '12px',
                        marginBottom: '8px',
                        display: 'flex',
                        gap: '12px',
                      }}
                    >
                      <span>
                        {`${t('ai.cut.time.start')}: ${new Date(
                          section.timestamp,
                        ).toLocaleString()}`}
                      </span>
                      <span>{`${t('ai.cut.time.duration')}: ${section.duration}`}</span>
                    </p>
                  )}
                  {/* 内容（markdown 渲染） */}
                  <div style={{ marginBottom: '16px' }}>
                    <ReactMarkdown>{section.content}</ReactMarkdown>
                  </div>

                  {/* 截图（直接渲染 img 标签） */}
                  <ScreenShot
                    section={section}
                    isAuthed={isAuthed}
                    userId={userId}
                    blur={spaceInfo.participants[userId]?.ai.cut.blur || false}
                  />
                  {/* 分隔线 */}
                  {index < contentSections.length - 1 && (
                    <hr style={{ border: 'none', borderTop: '1px solid #333', margin: '24px 0' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

function ScreenShot({
  section,
  isAuthed,
  userId,
  blur,
}: {
  section: Section;
  isAuthed: boolean;
  userId: string;
  blur: boolean;
}) {
  return (
    <div className={styles.ai_analysis_md_screenshot}>
      {section.screenshot ? (
        <ScreenShotImage src={section.screenshot} blur={blur}></ScreenShotImage>
      ) : isAuthed ? (
        <ScreenShotImage src={storageUrl(`${userId}_${section.timestamp}`)}></ScreenShotImage>
      ) : (
        <></>
      )}

      {section.sameshot ? (
        section.sameshot.startsWith('data:') ? (
          <ScreenShotImage src={section.sameshot} blur={blur}></ScreenShotImage>
        ) : isAuthed ? (
          <ScreenShotImage src={storageUrl(`${userId}_${section.sameshot}`)}></ScreenShotImage>
        ) : (
          <></>
        )
      ) : (
        <></>
      )}
    </div>
  );
}

function ScreenShotImage({ src, blur = false }: { src?: string; blur?: boolean }) {
  // blur是true就是5%的模糊效果
  const blurValue = useMemo(() => {
    if (!blur) {
      return 0;
    } else {
      return 32 * 0.05; // 通过像素计算得到模糊值
    }
  }, [blur]);

  if (!src) {
    return <></>;
  }
  return (
    <Image
      src={src}
      alt="screenshot"
      style={{
        flex: '1',
        maxWidth: '320px',
        height: 'auto',
        borderRadius: '8px',
        border: '1px solid #444',
        filter: blur ? `blur(${blurValue}px)` : 'none',
      }}
      preview={{
        imageRender: (originImg) => (
          <div
            style={{
              filter: blur ? `blur(${blurValue}px)` : 'none',
            }}
          >
            {originImg}
          </div>
        ),
      }}
    />
  );
}
