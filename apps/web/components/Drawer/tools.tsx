import { SvgResource } from '@/components/Icon/index';
import { Button, DrawerProps } from 'antd';

export function DrawerHeader({ title, icon }: { title: string, icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <span>{title}</span>
    </div>
  );
}

// styles 收窄为对象分支：antd 新版本 DrawerProps['styles'] 是 object | function 联合，
// 使用方需要直接访问 .styles.body（注意函数也属于 object，Extract 不适用，需 Exclude 函数）
type DrawerStylesObject = Exclude<DrawerProps['styles'], (...args: never[]) => unknown>;
export const DEFAULT_DRAWER_PROP: Omit<DrawerProps, 'styles'> & {
  styles?: DrawerStylesObject;
} = {
  style: { backgroundColor: '#111', padding: 0, margin: 0, color: '#fff' },
  placement: 'right',
  closable: false,
  size: '640px',
  styles: {
    body: {
      padding: '0 24px 0 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      overflow: "hidden"
    },
  },
};


export const DrawerCloser = ({
  on_clicked,
}: {
  on_clicked: () => void;
}): React.ReactNode => {
  return (
    <div>
      <Button type="text" shape="circle" onClick={on_clicked}>
        <SvgResource type="close" color="#fff" svgSize={16}></SvgResource>
      </Button>
    </div>
  );
};
