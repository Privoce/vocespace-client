
/**
 * 生成唯一颜色，当前仅使用在分享屏幕时用户鼠标的颜色区分上
 */
export const randomColor = (participantId: string): string => {
  // 使用参与者ID创建一个简单的哈希值
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = participantId.charCodeAt(i) + ((hash << 5) - hash);
  }

  // 根据哈希值选择预定义的颜色
  const colors = [
    '#667085',
    '#D0D5DD',
    '#22CCEE',
    '#A4F0FC',
    '#F97066',
    '#FDA29B',
    '#FDB022',
    '#FFC84B',
    '#32D583',
    '#A6F4C4',
    '#717BBC',
    '#B3B8DB',
    '#5FE9D0',
    '#36BFFB',
    '#528AFF',
    '#865BF7',
    '#EE45BC',
    '#FF682F',
    '#FDEAD7',
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
