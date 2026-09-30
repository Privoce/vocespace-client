// import React, { useMemo, useState } from 'react';
// import { Input, Tree, Tag, Space, Typography } from 'antd';
// import type { TreeDataNode } from 'antd';
// import { SpaceInfo, SpaceTodo, SpaceTimer, SpaceCountdown } from '@/lib/std/space';
// import dayjs from 'dayjs';
// import duration from 'dayjs/plugin/duration';

// dayjs.extend(duration);

// const { Search } = Input;
// const { Text } = Typography;

// interface AppHistoryProps {
//   spaceInfo: SpaceInfo;
// }

// interface ProcessedDataItem {
//   type: 'todo' | 'timer' | 'countdown';
//   participantId: string;
//   participantName: string;
//   timestamp: number;
//   data: SpaceTodo | SpaceTimer | SpaceCountdown;
// }

// interface CustomTreeDataNode extends TreeDataNode {
//   data?: ProcessedDataItem;
// }

// export function AppHistory({ spaceInfo }: AppHistoryProps) {
//   const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
//   const [searchValue, setSearchValue] = useState('');
//   const [autoExpandParent, setAutoExpandParent] = useState(true);

//   // 处理数据：合并所有应用数据并按日期分组
//   const processedData = useMemo(() => {
//     const allData: ProcessedDataItem[] = [
//       ...spaceInfo.appsDatas.todo.map((item) => ({
//         type: 'todo' as const,
//         participantId: item.participantId,
//         participantName: item.participantName,
//         timestamp: item.timestamp,
//         data: item,
//       })),
//       ...spaceInfo.appsDatas.timer.map((item) => ({
//         type: 'timer' as const,
//         participantId: item.participantId,
//         participantName: item.participantName,
//         timestamp: item.timestamp,
//         data: item,
//       })),
//       ...spaceInfo.appsDatas.countdown.map((item) => ({
//         type: 'countdown' as const,
//         participantId: item.participantId,
//         participantName: item.participantName,
//         timestamp: item.timestamp,
//         data: item,
//       })),
//     ];

//     // 按日期分组
//     const groupedByDate: { [dateKey: string]: ProcessedDataItem[] } = {};

//     allData.forEach((item) => {
//       const dateKey = dayjs(item.timestamp).format('YYYY-MM-DD');
//       if (!groupedByDate[dateKey]) {
//         groupedByDate[dateKey] = [];
//       }
//       groupedByDate[dateKey].push(item);
//     });

//     return groupedByDate;
//   }, [spaceInfo.appsDatas]);

//   // 生成树形数据
//   const treeData = useMemo((): CustomTreeDataNode[] => {
//     const dates = Object.keys(processedData).sort((a, b) => b.localeCompare(a)); // 最新日期在前

//     return dates.map((dateKey) => {
//       const items = processedData[dateKey];
//       const children: CustomTreeDataNode[] = items.map((item) => {
//         const timeStr = dayjs(item.timestamp).format('HH:mm:ss');
//         let title: React.ReactNode;

//         switch (item.type) {
//           case 'todo':
//             const todoItem = item.data as SpaceTodo;
//             const completedCount = todoItem.items.filter((i) => i.done).length;
//             title = (
//               <Space>
//                 <Tag color="blue">TODO</Tag>
//                 {/* <Text>{item.participantName}</Text> */}
//                 <Text>({timeStr})</Text>
//                 <Text>
//                   {completedCount}/{todoItem.items.length} 已完成
//                 </Text>
//               </Space>
//             );
//             break;

//           case 'timer':
//             const timerItem = item.data as SpaceTimer;
//             const timerValue = timerItem.value
//               ? dayjs.duration(timerItem.value, 'milliseconds').format('HH:mm:ss')
//               : '未设置';
//             title = (
//               <Space>
//                 <Tag color="green">计时器</Tag>
//                 {/* <Text>{item.participantName}</Text> */}
//                 <Text>({timeStr})</Text>
//                 <Text>时长: {timerValue}</Text>
//               </Space>
//             );
//             break;

//           case 'countdown':
//             const countdownItem = item.data as SpaceCountdown;
//             console.warn(countdownItem.duration);
//             const countdownValue = countdownItem.duration ? countdownItem.duration : '未设置';

//             title = (
//               <Space>
//                 <Tag color="orange">倒计时</Tag>
//                 {/* <Text>{item.participantName}</Text> */}
//                 <Text>({timeStr})</Text>
//                 <Text>时长: {countdownValue}</Text>
//               </Space>
//             );
//             break;
//         }

//         return {
//           key: `${item.type}-${item.participantId}-${item.timestamp}`,
//           title,
//           isLeaf: true,
//           data: item,
//         };
//       });

//       return {
//         key: dateKey,
//         title: (
//           <Space>
//             <Text strong>{dayjs(dateKey).format('YYYY年MM月DD日')}</Text>
//             <Tag>{items.length} 条记录</Tag>
//           </Space>
//         ),
//         children,
//       };
//     });
//   }, [processedData]);

//   // 搜索功能数据列表
//   const dataList = useMemo(() => {
//     const list: { key: React.Key; title: string; type: string; participantName: string }[] = [];

//     Object.entries(processedData).forEach(([dateKey, items]) => {
//       items.forEach((item) => {
//         const key = `${item.type}-${item.participantId}-${item.timestamp}`;
//         list.push({
//           key,
//           title: item.participantName,
//           type: item.type,
//           participantName: item.participantName,
//         });
//       });
//     });

//     return list;
//   }, [processedData]);

//   const getParentKey = (key: React.Key): React.Key | null => {
//     for (const dateNode of treeData) {
//       if (dateNode.children?.some((child) => child.key === key)) {
//         return dateNode.key;
//       }
//     }
//     return null;
//   };

//   const onExpand = (newExpandedKeys: React.Key[]) => {
//     setExpandedKeys(newExpandedKeys);
//     setAutoExpandParent(false);
//   };

//   const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { value } = e.target;

//     if (!value) {
//       setExpandedKeys([]);
//       setSearchValue('');
//       setAutoExpandParent(true);
//       return;
//     }

//     const newExpandedKeys = dataList
//       .filter(
//         (item) =>
//           item.title.toLowerCase().includes(value.toLowerCase()) ||
//           item.type.toLowerCase().includes(value.toLowerCase()),
//       )
//       .map((item) => getParentKey(item.key))
//       .filter((item, i, self): item is React.Key => !!(item && self.indexOf(item) === i));

//     setExpandedKeys(newExpandedKeys);
//     setSearchValue(value);
//     setAutoExpandParent(true);
//   };

//   // 渲染搜索高亮的树形数据
//   const renderTreeData = useMemo(() => {
//     if (!searchValue) return treeData;

//     const loop = (data: CustomTreeDataNode[]): CustomTreeDataNode[] =>
//       data.map((item) => {
//         if (item.children) {
//           return {
//             ...item,
//             children: loop(item.children as CustomTreeDataNode[]),
//           };
//         }

//         // 对叶子节点进行搜索高亮处理
//         const titleText = item.data?.participantName || '';
//         const typeText = item.data?.type || '';

//         if (
//           titleText.toLowerCase().includes(searchValue.toLowerCase()) ||
//           typeText.toLowerCase().includes(searchValue.toLowerCase())
//         ) {
//           return {
//             ...item,
//             title: React.cloneElement(item.title as React.ReactElement, {
//               style: { backgroundColor: '#ffd591' },
//             }),
//           };
//         }

//         return item;
//       });

//     return loop(treeData);
//   }, [treeData, searchValue]);

//   if (Object.keys(processedData).length === 0) {
//     return (
//       <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
//         暂无应用数据历史记录
//       </div>
//     );
//   }

//   return (
//     <div>
//       <Search
//         style={{ marginBottom: 16 }}
//         placeholder="搜索关键字"
//         onChange={onChange}
//         allowClear
//       />
//       <Tree
//         onExpand={onExpand}
//         expandedKeys={expandedKeys}
//         autoExpandParent={autoExpandParent}
//         treeData={renderTreeData}
//         showLine={{ showLeafIcon: false }}
//         height={400}
//         style={{
//           padding: '8px',
//         }}
//       />
//     </div>
//   );
// }
