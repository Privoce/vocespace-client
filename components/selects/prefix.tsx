import { SvgResource, SvgResourceProps } from '@/app/resources/svg';

/**
 * ### 设备选择组件的通用前缀组件
 * - 用于在设备选择组件中显示图标。
 * @param [`SvgResourceProps`]
 */
export function SelectPrefix({ type, svgSize, color }: SvgResourceProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'end',
        justifyContent: 'center',
        height: '22px',
        width: '100%',
      }}
    >
      <SvgResource type={type} svgSize={svgSize} color={color}></SvgResource>
    </div>
  );
}
