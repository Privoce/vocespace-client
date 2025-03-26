'use client';

import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { formatChatMessageLinks, LiveKitRoom, LocalUserChoices } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RpcInvocationData,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React from 'react';
import { PreJoin } from './pre_join/pre_join';
import { VideoContainer } from './room/video_container';
import { use_add_user_device } from '@/lib/hooks/store/user_choices';
import { message } from 'antd';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
  `${process.env.NEXT_PUBLIC_BASE_PATH}/api/connection-details`;
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback(
    (e: any) => console.error(`Voce Space issue: ${e.message}`),
    [],
  );

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          ></PreJoin>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
}) {
  const e2eePassphrase =
    typeof window !== 'undefined' && decodePassphrase(location.hash.substring(1));

  const worker =
    typeof window !== 'undefined' &&
    e2eePassphrase &&
    new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
  const e2eeEnabled = !!(e2eePassphrase && worker);
  const keyProvider = new ExternalE2EEKeyProvider();
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq
          ? [VideoPresets.h1080, VideoPresets.h720]
          : [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec,
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
        noiseSuppression: true
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);
  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }

    room.registerRpcMethod("test", async (data: RpcInvocationData) => {
      return  "test";
    })

    return () => {
      room.unregisterRpcMethod("test");
    }

  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      maxRetries: 5,
      autoSubscribe: true,
    };
  }, []);

  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();

  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    // console.error(error);
    // alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
    // 处理连接错误
    if (error.name === "ConnectionError"){
      messageApi.error("Connection Error, please check your network connection and try again.");
    }else{
      console.error(error);
    }
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  return (
    <>
      {contextHolder}    
      <LiveKitRoom
        connect={e2eeSetupComplete}
        room={room}
        token={props.connectionDetails.participantToken}
        serverUrl={props.connectionDetails.serverUrl}
        connectOptions={connectOptions}
        video={props.userChoices.videoEnabled}
        audio={props.userChoices.audioEnabled}
        onDisconnected={handleOnLeave}
        onEncryptionError={handleEncryptionError}
        onError={handleError}
      >
        <VideoContainer
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        ></VideoContainer>
        <DebugMode />
        <RecordingIndicator />
      </LiveKitRoom>
    </>
  );
}

// import { Holistic } from '@mediapipe/holistic';
// import { Camera } from '@mediapipe/camera_utils';

// interface VirtualAvatarProps {
//   track: Track;
//   avatar_path: string;
// }

// function VirtualAvatar({ track, avatar_path }: VirtualAvatarProps) {
//   const video_ref = useRef<HTMLVideoElement>(null);
//   const avatar_ref = useRef<HTMLImageElement>(null);
//   const canvas_ref = useRef<HTMLCanvasElement>(null);

//   useEffect(() => {
//     if (!canvas_ref.current || !avatar_ref.current || !video_ref.current || !track) {
//       return;
//     }
//     // 使用mediaStream
//     const mediaStream = new MediaStream();
//     video_ref.current.srcObject = mediaStream;
//     video_ref.current.play().catch(console.error);

//     return () => {
//       if (video_ref.current) {
//         video_ref.current.srcObject = null;
//       }
//     };
//   }, [track]);

//   useEffect(() => {
//     if (!canvas_ref.current || !avatar_ref.current || !video_ref.current || !track) {
//       return;
//     }
//     const holistic = new Holistic({
//       locateFile: (file) => {
//         return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
//       },
//     });

//     holistic.setOptions({
//       modelComplexity: 1,
//       smoothLandmarks: true,
//       minDetectionConfidence: 0.5,
//       minTrackingConfidence: 0.5,
//     });

//     holistic.onResults((results) => {
//       if (!canvas_ref.current || !avatar_ref.current) {
//         return;
//       }
//       const ctx = canvas_ref.current.getContext('2d');
//       if (!ctx) {
//         return;
//       }
//       ctx.clearRect(0, 0, canvas_ref.current.width, canvas_ref.current.height);
//       // 根据描补特征点绘制虚拟头像
//       if (results.faceLandmarks) {
//         // ctx.drawImage(avatar_ref.current, 0, 0);
//         // // 可以根据 results.faceLandmarks 来调整虚拟形象的位置和表情
//         // // 根据面部特征点调整虚拟形象
//         // // 这里可以添加更复杂的动画逻辑
//         // const face = results.faceLandmarks;
//         // // 示例：根据头部旋转调整虚拟形象
//         // const rotation = calculateFaceRotation(face);
//         // applyTransformation(ctx, rotation);
//         // 计算面部旋转
//         const rotation = calculateFaceRotation(results.faceLandmarks);

//         // 保存当前上下文状态
//         ctx.save();

//         // 绘制虚拟形象
//         ctx.drawImage(
//           avatar_ref.current,
//           0,
//           0,
//           canvas_ref.current.width,
//           canvas_ref.current.height,
//         );

//         // 应用变换
//         applyTransformation(ctx, rotation);

//         // 恢复上下文状态
//         ctx.restore();
//       }
//     });

//     // 相机设置
//     const camera = new Camera(video_ref.current, {
//       onFrame: async () => {
//         if (!canvas_ref.current || !video_ref.current) return;
//         await holistic.send({ image: video_ref.current });
//       },
//       width: 640,
//       height: 480,
//     });

//     camera.start();

//     return () => {
//       camera.stop();
//       holistic.close();
//     };
//   }, []);

//   // 宽高继承父元素
//   const width = 'inherits';
//   const height = 'inherits';

//   return (
//     <div className="virtual-avatar" style={{ width: '100%', height: '100%' }}>
//       <video ref={video_ref} style={{ display: 'none' }} playsInline></video>
//       <canvas ref={canvas_ref} height={800} width={800}></canvas>
//       <img ref={avatar_ref} src={avatar_path} alt="virtual" style={{ display: 'none' }} />
//     </div>
//   );
// }

// // 计算面部旋转
// function calculateFaceRotation(faceLandmarks: any) {
//   // 如果没有面部特征点，返回默认值
//   if (!faceLandmarks || faceLandmarks.length === 0) {
//     return { x: 0, y: 0, z: 0 };
//   }

//   // 获取关键点（使用MediaPipe面部特征点索引）
//   const nose = faceLandmarks[1]; // 鼻尖
//   const leftEye = faceLandmarks[33]; // 左眼
//   const rightEye = faceLandmarks[263]; // 右眼
//   const leftMouth = faceLandmarks[57]; // 嘴左角
//   const rightMouth = faceLandmarks[287]; // 嘴右角
//   // console.log(`============`);
//   // console.log(faceLandmarks);
//   // 计算头部旋转
//   // Y轴旋转（左右转动）
//   const yRotation = Math.atan2(nose.x - leftEye.x, nose.z - leftEye.z);

//   // X轴旋转（上下点头）
//   const xRotation = Math.atan2(nose.y - leftEye.y, nose.z - leftEye.z);

//   // Z轴旋转（头部倾斜）
//   const zRotation = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

//   // 将弧度转换为角度并限制范围
//   const maxRotation = 45; // 最大旋转角度
//   return {
//     x: ((xRotation * 180) / Math.PI).toFixed(2),
//     y: ((yRotation * 180) / Math.PI).toFixed(2),
//     z: ((zRotation * 180) / Math.PI).toFixed(2),
//   };
// }

// // 应用变换
// function applyTransformation(ctx: CanvasRenderingContext2D, rotation: any) {
//   const canvas = ctx.canvas;
//   const centerX = canvas.width / 2;
//   const centerY = canvas.height / 2;

//   // 保存当前上下文状态
//   ctx.save();

//   // 移动到画布中心
//   ctx.translate(centerX, centerY);

//   // 应用旋转（将角度转换为弧度）
//   // 限制旋转范围以使动画更平滑
//   const maxRotation = 30; // 度
//   const xRot =
//     (Math.min(Math.max(parseFloat(rotation.x), -maxRotation), maxRotation) * Math.PI) / 180;
//   const yRot =
//     (Math.min(Math.max(parseFloat(rotation.y), -maxRotation), maxRotation) * Math.PI) / 180;
//   const zRot =
//     (Math.min(Math.max(parseFloat(rotation.z), -maxRotation), maxRotation) * Math.PI) / 180;

//   // 应用3D变换（模拟3D效果）
//   ctx.transform(Math.cos(zRot), Math.sin(zRot), -Math.sin(zRot), Math.cos(zRot), 0, 0);

//   // 添加一些缩放效果来模拟前后移动
//   const scale = 1 + (yRot / Math.PI) * 0.1;
//   ctx.scale(scale, scale);

//   // 移回原位置
//   ctx.translate(-centerX, -centerY);

//   // 在VirtualAvatar组件的useEffect中，
//   // 需要在drawImage之后，调用applyTransformation

//   // 恢复上下文状态
//   ctx.restore();
// }

// function VideoTracksRenderer() {
//   const tracks = useTracks([Track.Source.Camera]);
//   const [useVirtualAvatar, setUseVirtualAvatar] = React.useState(false);
//   const participants = useParticipants();
//   const renderTrack = (trackRef: TrackReference) => {
//     if (!trackRef?.publication.track) {
//       return <VideoConference></VideoConference>;
//     }

//     if (useVirtualAvatar) {
//       return <VirtualAvatar track={trackRef.publication.track} avatar_path="/images/avatar.png" />;
//     }

//     return <VideoTrack trackRef={trackRef} />;
//   };

//   return (
//     <div className="video-tracks-container" style={{ height: 'calc(100% - 40px)', width: '100%' }}>
//       <button
//         onClick={() => setUseVirtualAvatar(!useVirtualAvatar)}
//         className="avatar-toggle-button"
//       >
//         {useVirtualAvatar ? '切换到真实视频' : '切换到虚拟形象'}
//       </button>
//       <ParticipantLoop participants={participants}>
//         {/* {(participant: RemoteParticipant| LocalParticipant) => (
//           <ParticipantTile participant={participant}>
//             {renderTrack}
//           </ParticipantTile>
//         )} */}
//         {renderTrack(tracks[0])}
//       </ParticipantLoop>
//     </div>
//   );
// }

// function VideoTracksRenderer() {
//   const tracks = useTracks([Track.Source.Camera]);
//   const mask_cam = tracks.find((t) => t.participant.name === 'syf1');
//   const participants = useParticipants();
//   const blur_style = {
//     filter: 'blur(10px)',
//     width: '100%',
//     height: '100%',
//   };
//   const cameraTracks = useTracks([Track.Source.Camera]);
//   return (
//     <>
//       {mask_cam ? (
//         <TrackLoop tracks={cameraTracks}>
//           <ParticipantLoop participants={participants}>
//             <VideoTrack trackRef={mask_cam} style={blur_style}></VideoTrack>
//           </ParticipantLoop>
//         </TrackLoop>
//       ) : (
//         <VideoConference></VideoConference>
//       )}
//     </>
//   );
// }

// // 创建一个新的组件来处理音频轨道
// import { TrackReference } from '@livekit/components-react';
// import { VideoContainer } from './room/video_container';

// function AudioTracksRenderer({ tracks }: { tracks: TrackReference[] }) {
//   return (
//     <div style={{ display: 'none' }}>
//       {tracks.map((trackRef) => (
//         <AudioTrack
//           key={trackRef.publication.trackSid}
//           trackRef={trackRef}
//           volume={0.1}
//           muted={false}
//         />
//       ))}
//     </div>
//   );
// }

// // 创建一个容器组件来使用 useTracks
// function AudioTracksContainer() {
//   const tracks = useTracks([
//     Track.Source.Microphone,
//     Track.Source.ScreenShareAudio,
//     Track.Source.Unknown,
//   ]).filter(
//     (ref) => !isLocalParticipant(ref.participant) && ref.publication.kind === Track.Kind.Audio,
//   );

//   return <AudioTracksRenderer tracks={tracks} />;
// }
