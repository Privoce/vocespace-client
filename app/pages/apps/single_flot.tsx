// import { CountdownProp, FlotAppExports, FlotLayoutProps, TimerProp, TodoProp } from './flot';
// import styles from '@/styles/apps.module.scss';
// import { Collapse, CollapseProps, Popover, theme, Tooltip } from 'antd';
// import {
//   AppAuth,
//   AppKey,
//   castCountdown,
//   castTimer,
//   castTodo,
//   Countdown,
//   DEFAULT_COUNTDOWN,
//   DEFAULT_TIMER,
//   SpaceCountdown,
//   SpaceInfo,
//   SpaceTimer,
//   SpaceTodo,
//   Timer,
//   TodoItem,
// } from '@/lib/std/space';
// import { AppTimer } from './timer';
// import { MessageInstance } from 'antd/es/message/interface';
// import { AppCountdown } from './countdown';
// import { AppTodo } from './todo_list';
// import { useRecoilState } from 'recoil';
// import { RemoteTargetApp, socket } from '@/app/[spaceName]/PageClientImpl';
// import { useLocalParticipant } from '@livekit/components-react';
// import { Participant } from 'livekit-client';
// import { useI18n } from '@/lib/i18n/i18n';
// import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
// import { api } from '@/lib/api';
// import { WsBase } from '@/lib/std/device';
// import {
//   CloseCircleOutlined,
//   EyeInvisibleOutlined,
//   EyeOutlined,
//   ProfileOutlined,
//   RobotOutlined,
// } from '@ant-design/icons';
// import { AICutAnalysisMdTabs } from './ai_analysis_md';
// import { DEFAULT_COLLAPSE_HEADER_STYLES } from '../controls/collapse_tools';
// import { TodoTogether } from './todo_together';

// export interface SingleFlotLayoutProps extends FlotLayoutProps {
//   appKey?: AppKey;
//   setOpen: (open: boolean) => void;
// }

// export function SingleFlotLayout({
//   style,
//   messageApi,
//   openApp,
//   setOpen,
//   spaceInfo,
//   space,
//   appKey,
// }: SingleFlotLayoutProps) {
//   const [showAICutAnalysis, setShowAICutAnalysis] = useState<boolean>(true);
//   const [containerHeight, setContainerHeight] = useState<number>(0);
//   return (
//     <div style={style}>
//       <Popover
//         open={openApp}
//         placement="leftTop"
//         content={
//           <div className={styles.flot_app}>
//             <div className={styles.flot_app_header}>
//               <CloseCircleOutlined
//                 onClick={() => {
//                   setOpen(false);
//                 }}
//               ></CloseCircleOutlined>
//             </div>
//             <div className={styles.flot_app_content}>
//               {containerHeight > 0 && showAICutAnalysis && (
//                 <AICutAnalysisMdTabs
//                   height={containerHeight - 8}
//                   spaceInfo={spaceInfo}
//                 ></AICutAnalysisMdTabs>
//               )}
//               <RemoteFlotAppItem
//                 messageApi={messageApi}
//                 space={space}
//                 spaceInfo={spaceInfo}
//                 showAICutAnalysis={showAICutAnalysis}
//                 setShowAICutAnalysis={setShowAICutAnalysis}
//                 onHeightChange={setContainerHeight}
//               ></RemoteFlotAppItem>
//             </div>
//           </div>
//         }
//         styles={{
//           body: {
//             background: '#f67f22',
//             width: 'fit-content',
//             maxHeight: '86vh',
//             height: 'fit-content',
//             overflowY: 'scroll',
//             paddingRight: 0,
//             paddingBottom: 0,
//             scrollbarWidth: 'thin',
//             scrollbarColor: '#888 transparent',
//           },
//         }}
//       ></Popover>
//     </div>
//   );
// }

// export interface RemoteFlotAppItemProps {
//   messageApi: MessageInstance;
//   space: string;
//   onHeightChange?: (height: number) => void;
//   spaceInfo: SpaceInfo;
//   setShowAICutAnalysis: (show: boolean) => void;
//   showAICutAnalysis: boolean;
// }

// const DEFAULT_KEYS: AppKey[] = ['timer', 'countdown', 'todo'];

// export const RemoteFlotAppItem = forwardRef<FlotAppExports, RemoteFlotAppItemProps>(
//   (
//     {
//       messageApi,
//       spaceInfo,
//       onHeightChange,
//       showAICutAnalysis,
//       setShowAICutAnalysis,
//     }: RemoteFlotAppItemProps,
//     ref,
//   ) => {
//     const [remote, setRemote] = useRecoilState(RemoteTargetApp);
//     const [activeKeys, setActiveKeys] = useState<AppKey[]>(DEFAULT_KEYS);
//     const { t } = useI18n();
//     const { token } = theme.useToken();
//     const [showExport, setShowExport] = useState<boolean>(false);
//     const containerRef = useRef<HTMLDivElement>(null);
//     const resizeObserverRef = useRef<ResizeObserver | null>(null);

//     // 监听容器高度变化
//     useEffect(() => {
//       if (containerRef.current && onHeightChange) {
//         const updateHeight = () => {
//           if (containerRef.current) {
//             const height = containerRef.current.clientHeight;
//             onHeightChange(height);
//           }
//         };

//         // 初始设置高度
//         updateHeight();

//         // 设置 ResizeObserver
//         resizeObserverRef.current = new ResizeObserver(() => {
//           updateHeight();
//         });

//         resizeObserverRef.current.observe(containerRef.current);

//         return () => {
//           if (resizeObserverRef.current) {
//             resizeObserverRef.current.disconnect();
//           }
//         };
//       }
//     }, [onHeightChange]);

//     const itemStyle: React.CSSProperties = {
//       marginBottom: 8,
//       background: token.colorFillAlter,
//       borderRadius: token.borderRadiusSM,
//       border: 'none',
//     };

//     const setRemoteTimerData = async (auth: AppAuth, participantId: string, timer: Timer) => {
//       if (auth !== 'write') return;
//       // 通过API更新
//       // const response = await api.updateParticipantApp(participantId, 'timer', timer);
//     };

//     const exportTodo = (data: TodoItem[]) => {
//       if (data.length === 0) {
//         messageApi.info(t('more.app.todo.unexport'));
//       } else {
//         setShowExport(true);
//       }
//     };

//     const createItems = (
//       participantId: string,
//       timer?: TimerProp,
//       countdown?: CountdownProp,
//       todo?: TodoProp,
//       isRemote = false,
//     ): CollapseProps['items'] => {
//       let items: CollapseProps['items'] = [];

//       if (timer) {
//         items.push({
//           key: 'timer',
//           label: <div className={styles.flot_header}>{t('more.app.timer.title')}</div>,
//           children: (
//             <AppTimer
//               size="small"
//               appData={timer.data}
//               setAppData={timer.setData}
//               auth={timer.auth}
//             ></AppTimer>
//           ),
//           style: itemStyle,
//           styles: DEFAULT_COLLAPSE_HEADER_STYLES,
//         });
//       }

//       if (countdown) {
//         items.push({
//           key: 'countdown',
//           label: <div className={styles.flot_header}>{t('more.app.countdown.title')}</div>,
//           children: (
//             <AppCountdown
//               messageApi={messageApi}
//               size="small"
//               appData={countdown.data}
//               setAppData={countdown.setData}
//               auth={countdown.auth}
//             />
//           ),
//           style: itemStyle,
//           styles: DEFAULT_COLLAPSE_HEADER_STYLES,
//         });
//       }

//       if (todo) {
//         items.push({
//           key: 'todo',
//           label: (
//             <div className={styles.flot_header}>
//               {t('more.app.todo.title')}
//               <div className={styles.flot_header_icons}>
//                 {!isRemote && (
//                   <>
//                     <Tooltip title={t('more.app.todo.complete')}>
//                       <ProfileOutlined
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           exportTodo(todo.data);
//                         }}
//                       />
//                     </Tooltip>
//                     <Tooltip title={t('more.ai.cut')}>
//                       <RobotOutlined
//                         disabled={!spaceInfo.participants[participantId]?.ai.cut}
//                         onClick={(e) => {
//                           e.stopPropagation();
//                           setShowAICutAnalysis(!showAICutAnalysis);
//                         }}
//                       />
//                     </Tooltip>
//                   </>
//                 )}
//               </div>
//             </div>
//           ),
//           children: (
//             <AppTodo
//               messageApi={messageApi}
//               appData={todo.data}
//               setAppData={todo.setData}
//               auth={todo.auth}
//               showExport={showExport}
//               setShowExport={setShowExport}
//             />
//           ),
//           style: itemStyle,
//           styles: DEFAULT_COLLAPSE_HEADER_STYLES,
//         });
//       }

//       return items;
//     };

//     const appData = useMemo(() => {
//       if (!remote.participantId || !spaceInfo) return {};
//       // return {
//       //   ...spaceInfo.participants[remote.participantId].appDatas,
//       //   sync: spaceInfo.participants[remote.participantId]?.sync
//       // };
//       const remoteParticipant = spaceInfo.participants[remote.participantId];

//       if (remoteParticipant.sync) {
//         let castedTimer = castTimer(remoteParticipant.appDatas.timer);
//         let castedCountdown = castCountdown(remoteParticipant.appDatas.countdown);
//         let castedTodo = castTodo(remoteParticipant.appDatas.todo);

//         let timer: TimerProp | undefined = undefined;
//         if (castedTimer) {
//           timer = {
//             data: castedTimer,
//             setData: async (data) => {
//               // update the timer data
//               await setRemoteTimerData(remoteParticipant.auth, remote.participantId!, data);
//             },
//             auth: remoteParticipant.auth,
//           };
//         }
//         let countdown: CountdownProp | undefined = undefined;
//         if (castedCountdown) {
//           countdown = {
//             data: castedCountdown,
//             setData: async (data) => {
//               // update the countdown data
//             },
//             auth: remoteParticipant.auth,
//           };
//         }
//         let todo: TodoProp | undefined = undefined;
//         if (castedTodo) {
//           todo = {
//             data: castedTodo,
//             setData: async (data) => {
//               // update the todo data
//               console.warn(data);
//             },
//             auth: remoteParticipant.auth,
//           };
//         } else {
//           // 给一个空的todo
//           todo = {
//             data: [],
//             setData: async (data) => {
//               // update the todo data
//               console.warn(data);
//             },
//             auth: remoteParticipant.auth,
//           };
//         }

//         let remoteItems = createItems(remote.participantId, timer, countdown, todo, true);
//         return {
//           key: remote.participantId,
//           label: remoteParticipant.name,
//           children: (
//             <Collapse
//               bordered={false}
//               activeKey={activeKeys}
//               onChange={(keys) => {
//                 setActiveKeys(keys as AppKey[]);
//               }}
//               expandIconPosition="start"
//               items={remoteItems}
//             />
//           ),
//         };
//       }
//     }, [spaceInfo, remote, activeKeys]);

//     useImperativeHandle(ref, () => ({
//       clientHeight: containerRef.current?.clientHeight,
//     }));
//     // 暂时不使用tab，返回自己的即可
//     // return <Tabs style={{ width: 360 }} size="small" items={tabItems}></Tabs>;
//     return (
//       <div ref={containerRef} className={styles.flot_app_item}>
//         {appData?.children}
//       </div>
//     );
//   },
// );
