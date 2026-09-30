import { SvgResource, SvgType } from '@/app/resources/svg';
import { Button } from 'antd';

export interface ToggleBtnProps {
  svgType: SvgType;
  svgSize?: number;
  label?: string;
  onClick: () => void;
}

export const ToggleBtn = ({ svgType, svgSize = 18, label, onClick }: ToggleBtnProps) => {
  return (
    <Button
      variant="solid"
      color="default"
      size="large"
      onClick={onClick}
      style={{
        backgroundColor: '#1E1E1E',
        height: '46px',
        borderRadius: '8px',
        fontSize: '16px',
      }}
    >
      <SvgResource type={svgType} svgSize={svgSize}></SvgResource>
      {label && label}
    </Button>
  );
};
