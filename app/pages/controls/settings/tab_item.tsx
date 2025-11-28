import { SvgResource, SvgType } from '@/app/resources/svg';
import { isMobile } from '@/lib/std';

export function TabItem({
  type,
  label,
  svgSize = 14,
}: {
  type: SvgType;
  label: string;
  svgSize?: number;
}) {
  const isPhone = isMobile();
  const tabStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    gap: '6px',
  };

  return (
    <div style={tabStyles}>
      <SvgResource type={type} svgSize={svgSize}></SvgResource>
      {!isPhone && label}
    </div>
  );
}
