import React from 'react';
import { MouseMove } from '@/lib/std/device';
import { HandWritingStroke, ParticipantHandWriting } from '@/lib/std/space';
import { Button, Tooltip } from 'antd';
import { ClearOutlined, EditOutlined, RollbackOutlined, UndoOutlined } from '@ant-design/icons';
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

interface ScreenShareWhiteboardOverlayProps {
	enabled?: boolean;
	videoRef?: React.RefObject<HTMLVideoElement | null>;
	localParticipantId: string;
	localColor: string;
	handWritingByParticipant: Record<string, ParticipantHandWriting | undefined>;
	onSave: (nextValue: ParticipantHandWriting) => Promise<void> | void;
}

function buildStrokePath(points: HandWritingStroke['points']): string {
	if (!points.length) {
		return '';
	}

	if (points.length === 1) {
		const point = points[0];
		return `M ${point.x} ${point.y} L ${point.x + 0.0001} ${point.y + 0.0001}`;
	}

	return points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
		.join(' ');
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

function strokeTouchesPoint(stroke: HandWritingStroke, point: { x: number; y: number }, radius: number) {
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

	if (!videoElement.videoWidth || !videoElement.videoHeight) {
		return null;
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

	React.useEffect(() => {
		const measure = () => {
			setRect(
				getPointerMappingRect({
					mappingTarget,
					videoElement: videoRef?.current,
					containerElement: containerRef?.current,
				}),
			);
		};

		measure();

		const resizeTarget =
			mappingTarget === 'screen-share' ? videoRef?.current : containerRef?.current;
		if (!resizeTarget) {
			return;
		}

		const observer = new ResizeObserver(() => {
			measure();
		});
		observer.observe(resizeTarget);

		const videoElement = videoRef?.current;
		const handleVideoReady = () => {
			measure();
		};

		videoElement?.addEventListener('loadedmetadata', handleVideoReady);
		videoElement?.addEventListener('loadeddata', handleVideoReady);
		videoElement?.addEventListener('resize', handleVideoReady);
		window.addEventListener('resize', handleVideoReady);

		return () => {
			observer.disconnect();
			videoElement?.removeEventListener('loadedmetadata', handleVideoReady);
			videoElement?.removeEventListener('loadeddata', handleVideoReady);
			videoElement?.removeEventListener('resize', handleVideoReady);
			window.removeEventListener('resize', handleVideoReady);
		};
	}, [containerRef, mappingTarget, videoRef]);

	return rect;
}

export function ScreenShareWhiteboardOverlay({
	enabled = true,
	videoRef,
	localParticipantId,
	localColor,
	handWritingByParticipant,
	onSave,
}: ScreenShareWhiteboardOverlayProps) {
	const [tool, setTool] = React.useState<WhiteboardTool>('pen');
	const [drawing, setDrawing] = React.useState(false);
	const overlayRef = React.useRef<HTMLDivElement | null>(null);
	const localHandWriting = normalizeHandWriting(handWritingByParticipant[localParticipantId]);

	const actualVideoRect = usePointerMappingRectState({
		mappingTarget: 'screen-share',
		videoRef,
	});

	const allStrokes = React.useMemo(
		() =>
			Object.values(handWritingByParticipant)
				.filter((value): value is ParticipantHandWriting => Boolean(value))
				.flatMap((value) => normalizeHandWriting(value).strokes),
		[handWritingByParticipant],
	);

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
					strokeTouchesPoint(stroke, point, ERASER_RADIUS),
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
				return;
			}

			const point = getRelativePoint(event);
			if (!point) {
				return;
			}

			event.preventDefault();
			overlayRef.current?.setPointerCapture(event.pointerId);
			setDrawing(true);

			if (tool === 'eraser') {
				await eraseAtPoint(point);
				return;
			}

			const now = Date.now();
			const strokeId = `${now}-${Math.random().toString(36).slice(2, 8)}`;
			await saveLocal((current) => ({
				activeStrokeId: strokeId,
				strokes: [
					...current.strokes,
					{
						id: strokeId,
						color: localColor,
						tool,
						points: [point],
						createdAt: now,
					},
				],
				undoneStrokes: [],
			}));
		},
		[actualVideoRect, enabled, eraseAtPoint, getRelativePoint, localColor, saveLocal, tool],
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

			await saveLocal((current) => {
				if (!current.activeStrokeId) {
					return current;
				}

				return {
					...current,
					strokes: current.strokes.map((stroke) =>
						stroke.id === current.activeStrokeId
							? { ...stroke, points: [...stroke.points, point] }
							: stroke,
					),
				};
			});
		},
		[eraseAtPoint, getRelativePoint, saveLocal, tool],
	);

	const finishStroke = React.useCallback(async () => {
		setDrawing(false);
		await saveLocal((current) => ({
			...current,
			activeStrokeId: undefined,
		}));
	}, [saveLocal]);

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

	if (!enabled || !actualVideoRect) {
		return null;
	}

	return (
		<>
			<div className={styles.whiteboard_toolbar}>
				<Tooltip title="笔">
					<Button
						type={tool === 'pen' ? 'primary' : 'default'}
						shape="circle"
						icon={<EditOutlined />}
						onClick={() => setTool('pen')}
					/>
				</Tooltip>
				<Tooltip title="橡皮擦">
					<Button
						type={tool === 'eraser' ? 'primary' : 'default'}
						shape="circle"
						icon={<ClearOutlined />}
						onClick={() => setTool('eraser')}
					/>
				</Tooltip>
				<Tooltip title="撤销">
					<Button
						shape="circle"
						icon={<UndoOutlined />}
						disabled={!localHandWriting.strokes.length}
						onClick={() => {
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
				<Tooltip title="恢复">
					<Button
						shape="circle"
						icon={<RollbackOutlined />}
						disabled={!localHandWriting.undoneStrokes.length}
						onClick={() => {
							saveLocal((current) => {
								if (!current.undoneStrokes.length) {
									return current;
								}

								const restoredStroke =
									current.undoneStrokes[current.undoneStrokes.length - 1];
								return {
									activeStrokeId: undefined,
									strokes: [...current.strokes, restoredStroke],
									undoneStrokes: current.undoneStrokes.slice(0, -1),
								};
							});
						}}
					/>
				</Tooltip>
			</div>
			<div
				ref={overlayRef}
				className={styles.whiteboard_overlay}
				onPointerDown={handlePointerDown}
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
					{allStrokes.map((stroke) => (
						<path
							key={stroke.id}
							d={buildStrokePath(stroke.points)}
							stroke={stroke.color}
							strokeWidth={0.006}
							strokeLinecap="round"
							strokeLinejoin="round"
							fill="none"
						/>
					))}
				</svg>
			</div>
		</>
	);
}

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
