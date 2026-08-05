import React from 'react';
import { MouseMove } from '@/lib/std/device';
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

	const actualVideoRect = getPointerMappingRect({
		mappingTarget,
		videoElement: videoRef?.current,
		containerElement: containerRef?.current,
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
