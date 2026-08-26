import React from 'react';
import { createPortal } from 'react-dom';
import { MouseMove } from '@/lib/std/device';
import { HandWritingStroke, ParticipantHandWriting } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import { Button, Tooltip, Divider, Slider } from 'antd';
import { useRoomStore } from '@/lib/store';
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  RollbackOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import styles from '@/styles/controls.module.scss';

export type PointerMappingTarget = 'screen-share' | 'avo';

interface PointerMappingRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface ParticipantMouseEffectProps {
  enabled?: boolean;
  mappingTarget?: PointerMappingTarget;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  remoteCursors: Record<string, MouseMove>;
}

type WhiteboardTool = 'pen' | 'eraser';

const DEFAULT_WHITEBOARD_STROKE_WIDTH = 0.006;
const MIN_WHITEBOARD_STROKE_WIDTH = 0.002;
const MAX_WHITEBOARD_STROKE_WIDTH = 0.02;

interface TileWhiteboardOverlayProps {
  enabled?: boolean;
  mappingTarget?: PointerMappingTarget;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  toolbarHost?: HTMLElement | null;
  overlayId?: string;
  localParticipantId: string;
  localColor: string;
  canClearAll?: boolean;
  handWritingByParticipant: Record<string, ParticipantHandWriting | undefined>;
  onSave: (nextValue: ParticipantHandWriting) => Promise<void> | void;
  onClearAll?: () => Promise<void> | void;
}

function getMidPoint(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
  };
}

function getWhiteboardCursor(tool: WhiteboardTool, color: string): string {
  if (tool === 'eraser') {
    return 'cell';
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <g fill="none" fill-rule="evenodd">
        <path d="M7 24 22.5 8.5l4 4L11 28H7z" fill="${color}" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="m21.5 7.5 2.8-2.8a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L24.5 10.5" fill="#ffd48a" stroke="white" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M7 24h4l-1.2 4H5.8z" fill="#2b2b2b" stroke="white" stroke-width="1.2" stroke-linejoin="round"/>
      </g>
    </svg>
  `;

  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 6 26, crosshair`;
}

function buildStrokePath(points: HandWritingStroke['points']): string {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} L ${point.x + 0.0001} ${point.y + 0.0001}`;
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const path: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const nextPoint = points[index + 1];
    const midPoint = getMidPoint(point, nextPoint);
    path.push(`Q ${point.x} ${point.y} ${midPoint.x} ${midPoint.y}`);
  }

  const penultimatePoint = points[points.length - 2];
  const lastPoint = points[points.length - 1];
  path.push(`Q ${penultimatePoint.x} ${penultimatePoint.y} ${lastPoint.x} ${lastPoint.y}`);

  return path.join(' ');
}

function distanceBetweenPoints(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
): number {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function distanceToSegment(
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
): number {
  const deltaX = segmentEnd.x - segmentStart.x;
  const deltaY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (segmentLengthSquared === 0) {
    return distanceBetweenPoints(point, segmentStart);
  }

  const projection =
    ((point.x - segmentStart.x) * deltaX + (point.y - segmentStart.y) * deltaY) /
    segmentLengthSquared;
  const clampedProjection = Math.min(1, Math.max(0, projection));
  const closestPoint = {
    x: segmentStart.x + deltaX * clampedProjection,
    y: segmentStart.y + deltaY * clampedProjection,
  };

  return distanceBetweenPoints(point, closestPoint);
}

function strokeTouchesPoint(
  stroke: HandWritingStroke,
  point: { x: number; y: number },
  radius: number,
) {
  if (!stroke.points.length) {
    return false;
  }

  if (stroke.points.length === 1) {
    return distanceBetweenPoints(stroke.points[0], point) <= radius;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= radius) {
      return true;
    }
  }

  return false;
}

const ERASER_RADIUS = 0.018;

function getStrokeWidth(stroke?: HandWritingStroke | null): number {
  if (!stroke?.width) {
    return DEFAULT_WHITEBOARD_STROKE_WIDTH;
  }

  return Math.min(MAX_WHITEBOARD_STROKE_WIDTH, Math.max(MIN_WHITEBOARD_STROKE_WIDTH, stroke.width));
}

function normalizeHandWriting(handWriting?: ParticipantHandWriting): ParticipantHandWriting {
  return {
    activeStrokeId: handWriting?.activeStrokeId,
    strokes: handWriting?.strokes || [],
    undoneStrokes: handWriting?.undoneStrokes || [],
  };
}

function getRenderedVideoRect(videoElement: HTMLVideoElement): PointerMappingRect | null {
  const containerRect = videoElement.getBoundingClientRect();
  if (!containerRect.width || !containerRect.height) {
    return null;
  }

  // 当视频元数据还未加载时，使用容器尺寸作为 fallback
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    return {
      width: containerRect.width,
      height: containerRect.height,
      left: 0,
      top: 0,
    };
  }

  const actualVideoRect = {
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  };

  const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
  const computedHeight = containerRect.width / videoRatio;

  if (computedHeight <= containerRect.height) {
    actualVideoRect.width = containerRect.width;
    actualVideoRect.height = computedHeight;
    actualVideoRect.left = 0;
    actualVideoRect.top = (containerRect.height - actualVideoRect.height) / 2;
  } else {
    actualVideoRect.height = containerRect.height;
    actualVideoRect.width = containerRect.height * videoRatio;
    actualVideoRect.left = (containerRect.width - actualVideoRect.width) / 2;
    actualVideoRect.top = 0;
  }

  return actualVideoRect;
}

function getContainerRect(containerElement: HTMLElement): PointerMappingRect | null {
  const containerRect = containerElement.getBoundingClientRect();
  if (!containerRect.width || !containerRect.height) {
    return null;
  }

  return {
    width: containerRect.width,
    height: containerRect.height,
    left: 0,
    top: 0,
  };
}

export function getPointerMappingRect({
  mappingTarget,
  videoElement,
  containerElement,
}: {
  mappingTarget: PointerMappingTarget;
  videoElement?: HTMLVideoElement | null;
  containerElement?: HTMLElement | null;
}): PointerMappingRect | null {
  if (mappingTarget === 'avo') {
    return containerElement ? getContainerRect(containerElement) : null;
  }

  return videoElement ? getRenderedVideoRect(videoElement) : null;
}

function usePointerMappingRectState({
  mappingTarget,
  videoRef,
  containerRef,
}: {
  mappingTarget: PointerMappingTarget;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  const [rect, setRect] = React.useState<PointerMappingRect | null>(null);
  const retryCountRef = React.useRef(0);
  const maxRetries = 20;

  React.useEffect(() => {
    let animationFrameId: number | null = null;
    let observer: ResizeObserver | null = null;
    let videoElement: HTMLVideoElement | null = null;
    
    const measure = () => {
      const videoEl = videoRef?.current;
      const containerEl = containerRef?.current;
      
      const newRect = getPointerMappingRect({
        mappingTarget,
        videoElement: videoEl,
        containerElement: containerEl,
      });
      
      setRect(newRect);
      
      // 如果 rect 为 null 且还有重试次数，继续重试
      if (!newRect && retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        animationFrameId = requestAnimationFrame(measure);
      } else if (newRect) {
        retryCountRef.current = 0;
      }
    };

    // 立即测量一次
    measure();

    // 延迟设置 observer 和事件监听，等待元素渲染
    const setupListeners = () => {
      const resizeTarget =
        mappingTarget === 'screen-share' ? videoRef?.current : containerRef?.current;
      
      if (!resizeTarget) {
        // 元素还没渲染，延迟重试
        setTimeout(setupListeners, 100);
        return;
      }

      observer = new ResizeObserver(() => {
        retryCountRef.current = 0;
        measure();
      });
      observer.observe(resizeTarget);

      videoElement = videoRef?.current ?? null;
      const handleVideoReady = () => {
        retryCountRef.current = 0;
        measure();
      };

      videoElement?.addEventListener('loadedmetadata', handleVideoReady);
      videoElement?.addEventListener('loadeddata', handleVideoReady);
      videoElement?.addEventListener('resize', handleVideoReady);
      window.addEventListener('resize', handleVideoReady);
    };

    setupListeners();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      observer?.disconnect();
      videoElement?.removeEventListener('loadedmetadata', () => {});
      videoElement?.removeEventListener('loadeddata', () => {});
      videoElement?.removeEventListener('resize', () => {});
      window.removeEventListener('resize', () => {});
    };
  }, [containerRef, mappingTarget, videoRef]);

  return rect;
}

export function TileWhiteboardOverlay({
  enabled = true,
  mappingTarget = 'screen-share',
  videoRef,
  containerRef,
  toolbarHost,
  overlayId,
  localParticipantId,
  localColor,
  canClearAll = false,
  handWritingByParticipant,
  onSave,
  onClearAll,
}: TileWhiteboardOverlayProps) {
  const { t } = useI18n();
  const [tool, setTool] = React.useState<WhiteboardTool>('pen');
  const [strokeWidth, setStrokeWidth] = React.useState(DEFAULT_WHITEBOARD_STROKE_WIDTH);
  const [drawing, setDrawing] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(true);
  const [draftStroke, setDraftStroke] = React.useState<HandWritingStroke | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const draftStrokeRef = React.useRef<HandWritingStroke | null>(null);
  const whiteboardActiveOverlayId = useRoomStore((state) => state.whiteboardActiveOverlayId);
  const setWhiteboardActiveOverlayId = useRoomStore((state) => state.setWhiteboardActiveOverlayId);
  const localHandWriting = normalizeHandWriting(handWritingByParticipant[localParticipantId]);

  const actualVideoRect = usePointerMappingRectState({
    mappingTarget,
    videoRef,
    containerRef,
  });

  React.useEffect(() => {
    if (!enabled || !toolbarHost || !overlayId || whiteboardActiveOverlayId) {
      return;
    }

    setWhiteboardActiveOverlayId(overlayId);
  }, [enabled, overlayId, setWhiteboardActiveOverlayId, toolbarHost, whiteboardActiveOverlayId]);

  const allStrokes = React.useMemo(
    () =>
      Object.values(handWritingByParticipant)
        .filter((value): value is ParticipantHandWriting => Boolean(value))
        .flatMap((value) => normalizeHandWriting(value).strokes),
    [handWritingByParticipant],
  );
  const renderedStrokes = React.useMemo(
    () => (draftStroke ? [...allStrokes, draftStroke] : allStrokes),
    [allStrokes, draftStroke],
  );

  React.useEffect(() => {
    draftStrokeRef.current = draftStroke;
  }, [draftStroke]);

  React.useEffect(() => {
    if (!overlayId || whiteboardActiveOverlayId !== overlayId) {
      return;
    }

    return () => {
      if (whiteboardActiveOverlayId === overlayId) {
        setWhiteboardActiveOverlayId(null);
      }
    };
  }, [overlayId, setWhiteboardActiveOverlayId, whiteboardActiveOverlayId]);

  const saveLocal = React.useCallback(
    async (updater: (current: ParticipantHandWriting) => ParticipantHandWriting) => {
      const nextValue = updater(normalizeHandWriting(handWritingByParticipant[localParticipantId]));
      await onSave(nextValue);
    },
    [handWritingByParticipant, localParticipantId, onSave],
  );

  const getRelativePoint = React.useCallback(
    (event: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      if (!overlayRef.current || !actualVideoRect) {
        return null;
      }

      const overlayRect = overlayRef.current.getBoundingClientRect();
      const relativeX = event.clientX - overlayRect.left;
      const relativeY = event.clientY - overlayRect.top;

      if (
        relativeX < actualVideoRect.left ||
        relativeX > actualVideoRect.left + actualVideoRect.width ||
        relativeY < actualVideoRect.top ||
        relativeY > actualVideoRect.top + actualVideoRect.height
      ) {
        return null;
      }

      return {
        x: (relativeX - actualVideoRect.left) / actualVideoRect.width,
        y: (relativeY - actualVideoRect.top) / actualVideoRect.height,
      };
    },
    [actualVideoRect],
  );

  const eraseAtPoint = React.useCallback(
    async (point: { x: number; y: number }) => {
      await saveLocal((current) => {
        const removedStrokes = current.strokes.filter((stroke) =>
          strokeTouchesPoint(stroke, point, Math.max(ERASER_RADIUS, getStrokeWidth(stroke) * 1.5)),
        );

        if (!removedStrokes.length) {
          return current;
        }

        return {
          activeStrokeId: undefined,
          strokes: current.strokes.filter(
            (stroke) => !removedStrokes.some((removedStroke) => removedStroke.id === stroke.id),
          ),
          undoneStrokes: [...current.undoneStrokes, ...removedStrokes],
        };
      });
    },
    [saveLocal],
  );

  const handlePointerDown = React.useCallback(
    async (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !actualVideoRect) {
        console.warn('[Whiteboard] Cannot draw:', { enabled, actualVideoRect, overlayId });
        return;
      }

      const point = getRelativePoint(event);
      if (!point) {
        return;
      }

      event.preventDefault();
      overlayRef.current?.setPointerCapture(event.pointerId);
      setDrawing(true);
      if (overlayId) {
        setWhiteboardActiveOverlayId(overlayId);
      }

      if (tool === 'eraser') {
        setDraftStroke(null);
        await eraseAtPoint(point);
        return;
      }

      const now = Date.now();
      const strokeId = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      setDraftStroke({
        id: strokeId,
        color: localColor,
        tool,
        width: strokeWidth,
        points: [point],
        createdAt: now,
      });
    },
    [
      actualVideoRect,
      enabled,
      eraseAtPoint,
      getRelativePoint,
      localColor,
      saveLocal,
      strokeWidth,
      tool,
    ],
  );

  const appendPoint = React.useCallback(
    async (event: PointerEvent) => {
      const point = getRelativePoint(event);
      if (!point) {
        return;
      }

      if (tool === 'eraser') {
        await eraseAtPoint(point);
        return;
      }

      setDraftStroke((current) => {
        if (!current) {
          return current;
        }

        const previousPoint = current.points[current.points.length - 1];
        if (previousPoint && distanceBetweenPoints(previousPoint, point) < 0.003) {
          return current;
        }

        return {
          ...current,
          points: [...current.points, point],
        };
      });
    },
    [eraseAtPoint, getRelativePoint, saveLocal, tool],
  );

  const finishStroke = React.useCallback(async () => {
    setDrawing(false);
    const currentDraftStroke = draftStrokeRef.current;
    setDraftStroke(null);

    if (!currentDraftStroke || tool === 'eraser') {
      return;
    }

    await saveLocal((current) => ({
      activeStrokeId: undefined,
      strokes: [...current.strokes, currentDraftStroke],
      undoneStrokes: [],
    }));
  }, [saveLocal, tool]);

  const clearLocal = React.useCallback(async () => {
    await onSave({
      activeStrokeId: undefined,
      strokes: [],
      undoneStrokes: [],
    });
  }, [onSave]);

  const clearHandWriting = React.useCallback(async () => {
    if (canClearAll && onClearAll) {
      await onClearAll();
      return;
    }

    await clearLocal();
  }, [canClearAll, clearLocal, onClearAll]);

  React.useEffect(() => {
    if (!drawing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      appendPoint(event);
    };

    const handlePointerEnd = () => {
      finishStroke();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [appendPoint, drawing, finishStroke]);

  React.useEffect(() => {
    console.log('[Whiteboard] Render state:', {
      enabled,
      actualVideoRect,
      overlayId,
      whiteboardActiveOverlayId,
      collapsed,
      toolbarHost: !!toolbarHost,
    });
  }, [enabled, actualVideoRect, overlayId, whiteboardActiveOverlayId, collapsed, toolbarHost]);

  if (!enabled) {
    console.warn('[Whiteboard] Not rendering overlay:', { enabled, actualVideoRect });
    return null;
  }

  if (collapsed) {
    const collapsedToolbar = (
      <div className={styles.whiteboard_toolbar_collapsed} style={{ pointerEvents: 'auto' }}>
        <Tooltip title={t('common.whiteboard.expand')}>
          <Button
            style={{
              backgroundColor: tool === 'pen' ? localColor : undefined,
            }}
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setCollapsed(false)}
          />
        </Tooltip>
      </div>
    );

    const toolbarPortal =
      toolbarHost && overlayId
        ? createPortal(collapsedToolbar, toolbarHost)
        : !toolbarHost
          ? collapsedToolbar
          : null;

    // collapsed 时不渲染 overlay，禁用绘制并隐藏笔迹
    return (
      <>
        {toolbarPortal}
      </>
    );
  }

  const toolbar = (
    <div className={styles.whiteboard_toolbar} style={{ pointerEvents: 'auto' }}>
      <div className={styles.whiteboard_toolbar_left}>
        <Tooltip title={t('common.whiteboard.pen')}>
          <Button
            style={{
              backgroundColor: tool === 'pen' ? localColor : undefined,
            }}
            type={tool === 'pen' ? 'primary' : 'text'}
            icon={<EditOutlined />}
            onClick={() => {
              if (overlayId) {
                setWhiteboardActiveOverlayId(overlayId);
              }
              setTool('pen');
            }}
          />
        </Tooltip>
        <Tooltip title={t('common.whiteboard.eraser')}>
          <Button
            style={{
              backgroundColor: tool === 'eraser' ? localColor : undefined,
            }}
            type={tool === 'eraser' ? 'primary' : 'text'}
            icon={<ClearOutlined />}
            onClick={() => {
              console.log('[Whiteboard] Eraser button clicked, current tool:', tool);
              if (overlayId) {
                setWhiteboardActiveOverlayId(overlayId);
              }
              setTool('eraser');
            }}
          />
        </Tooltip>
        <Tooltip title={t('common.whiteboard.undo')}>
          <Button
            type="text"
            icon={<UndoOutlined />}
            disabled={!localHandWriting.strokes.length}
            onClick={() => {
              console.log('[Whiteboard] Undo clicked, strokes:', localHandWriting.strokes.length);
              if (overlayId) {
                setWhiteboardActiveOverlayId(overlayId);
              }
              saveLocal((current) => {
                if (!current.strokes.length) {
                  return current;
                }

                const removedStroke = current.strokes[current.strokes.length - 1];
                return {
                  activeStrokeId: undefined,
                  strokes: current.strokes.slice(0, -1),
                  undoneStrokes: [...current.undoneStrokes, removedStroke],
                };
              });
            }}
          />
        </Tooltip>
        <Tooltip title={t('common.whiteboard.redo')}>
          <Button
            type="text"
            icon={<RollbackOutlined />}
            disabled={!localHandWriting.undoneStrokes.length}
            onClick={() => {
              if (overlayId) {
                setWhiteboardActiveOverlayId(overlayId);
              }
              saveLocal((current) => {
                if (!current.undoneStrokes.length) {
                  return current;
                }

                const restoredStroke = current.undoneStrokes[current.undoneStrokes.length - 1];
                return {
                  activeStrokeId: undefined,
                  strokes: [...current.strokes, restoredStroke],
                  undoneStrokes: current.undoneStrokes.slice(0, -1),
                };
              });
            }}
          />
        </Tooltip>
        <Divider type="vertical" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>Size:</span>
          <Slider
            min={2}
            max={20}
            step={1}
            value={Math.round(strokeWidth * 1000)}
            onChange={(value) => {
              setStrokeWidth(Number(value) / 1000);
            }}
            style={{ width: 96, margin: 0 }}
          ></Slider>
        </div>
      </div>
      <div className={styles.whiteboard_toolbar_right}>
        <Tooltip
          title={canClearAll ? t('common.whiteboard.clear_all') : t('common.whiteboard.clear_self')}
        >
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => {
              if (overlayId) {
                setWhiteboardActiveOverlayId(overlayId);
              }
              void clearHandWriting();
            }}
          />
        </Tooltip>
        <Tooltip title={t('common.whiteboard.collapse')}>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => {
              if (overlayId) {
                setWhiteboardActiveOverlayId(overlayId);
              }
              setCollapsed(true);
            }}
          />
        </Tooltip>
      </div>
    </div>
  );

  console.log('[Whiteboard] Rendering toolbar:', {
    toolbarHost: !!toolbarHost,
    overlayId,
    whiteboardActiveOverlayId,
    collapsed,
  });

  return (
    <>
      {toolbarHost && overlayId
        ? createPortal(toolbar, toolbarHost)
        : !toolbarHost
          ? toolbar
          : null}
      {actualVideoRect && (
        <div
          ref={overlayRef}
          className={styles.whiteboard_overlay}
          onPointerDown={handlePointerDown}
          style={{ cursor: getWhiteboardCursor(tool, localColor) }}
        >
          <svg
            className={styles.whiteboard_canvas}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{
              left: `${actualVideoRect.left}px`,
              top: `${actualVideoRect.top}px`,
              width: `${actualVideoRect.width}px`,
              height: `${actualVideoRect.height}px`,
            }}
          >
            {renderedStrokes.map((stroke) => (
              <path
                key={stroke.id}
                d={buildStrokePath(stroke.points)}
                stroke={stroke.color}
                strokeWidth={getStrokeWidth(stroke)}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </svg>
        </div>
      )}
    </>
  );
}

export const ScreenShareWhiteboardOverlay = TileWhiteboardOverlay;

export function ParticipantMouseEffect({
  enabled = true,
  mappingTarget = 'screen-share',
  videoRef,
  containerRef,
  remoteCursors,
}: ParticipantMouseEffectProps) {
  if (!enabled) {
    return null;
  }

  const actualVideoRect = usePointerMappingRectState({
    mappingTarget,
    videoRef,
    containerRef,
  });
  if (!actualVideoRect) {
    return null;
  }

  return (
    <>
      {Object.entries(remoteCursors).map(([participantId, cursor]) => {
        const now = Date.now();
        if (now - cursor.timestamp > 10000) {
          return null;
        }

        const absoluteX = cursor.x * actualVideoRect.width + actualVideoRect.left;
        const absoluteY = cursor.y * actualVideoRect.height + actualVideoRect.top;

        return (
          <div
            key={participantId}
            className={styles.remote_cursor}
            style={{
              left: `${absoluteX}px`,
              top: `${absoluteY}px`,
              transform: 'translate(3px, 9.5px)',
            }}
          >
            <div className={styles.cursor_icon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 2L18 13H11L7 20V2Z"
                  fill={cursor.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            <div
              className={styles.cursor_label}
              style={{
                backgroundColor: cursor.color,
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                position: 'absolute',
                top: '-22px',
                left: '10px',
                whiteSpace: 'nowrap',
              }}
            >
              {cursor.name}
            </div>
          </div>
        );
      })}
    </>
  );
}
