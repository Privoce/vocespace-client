import { TrackReference, useLocalParticipant, VideoTrack } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { useEffect, useRef } from 'react';

export function ScreenTrack({
  room,
  screen_ref,
  track,
  screenBlurValue = 0,
}: {
  room?: Room;
  screen_ref: React.RefObject<HTMLVideoElement>;
  track: TrackReference;
  screenBlurValue?: number;
}) {
  const { localParticipant } = useLocalParticipant();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!track) return;

    // 只有当前屏幕共享是其他参与者的，才需要发送鼠标位置
    if (track.participant.identity !== localParticipant.identity) {
      // 处理鼠标按下事件
      const handleMouseDown = (e: MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
          const data = {
            position: {
              x,
              y,
              active: true,
            },
            participantId: localParticipant.identity,
            participantName: localParticipant.name || 'Anonymous',
          };

          if(localParticipant.identity !== track.participant.identity) {
            room?.localParticipant
            .performRpc({
              destinationIdentity: track.participant.identity,
              method: 'test',
              payload: 'Hello from RPC!',
            })
            .then((res) => {
              console.log('RPC response:', res);
            });
          }

          
        }
      };

      // 添加事件监听器
      if (containerRef.current) {
        containerRef.current.addEventListener('mousedown', handleMouseDown);
      }

      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('mousedown', handleMouseDown);
        }
      };
    }
  }, [track]);

  return (
    <div ref={containerRef}>
      <VideoTrack
        ref={screen_ref}
        trackRef={track}
        style={{
          filter: `blur(${screenBlurValue}px)`,
        }}
      ></VideoTrack>
    </div>
  );
}
