import { ExpandOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { forwardRef, useImperativeHandle, useState } from 'react';

export interface FullScreenBtnProps {
  setCollapsed: (collapsed: boolean) => void;
  isFullScreen: boolean;
  setIsFullScreen: (isFullScreen: boolean) => void;
}
export interface FullScreenBtnExports {}

export const useFullScreenBtn = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  return {
    isFullScreen,
    setIsFullScreen,
  };
};

export const FullScreenBtn = forwardRef<FullScreenBtnExports, FullScreenBtnProps>(
  ({ setCollapsed, isFullScreen, setIsFullScreen }: FullScreenBtnProps, ref) => {
    return (
      <Button
        size="large"
        style={{
          backgroundColor: isFullScreen ? '#22CCEE' : '#1E1E1E',
          height: '46px',
          borderRadius: '8px',
          border: 'none',
          color: '#fff',
          minWidth: '50px',
          width: 'fit-content',
        }}
        icon={<ExpandOutlined />}
        onClick={() => {
          if (!isFullScreen) {
            setCollapsed(true);
          }
          setIsFullScreen(!isFullScreen);
        }}
      ></Button>
    );
  },
);
