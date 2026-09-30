import { SvgResource } from '@/app/resources/svg';
import { Button, DrawerProps } from 'antd';

export function DrawerHeader({ title, icon }: { title: string, icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <span>{title}</span>
    </div>
  );
}

export const DEFAULT_DRAWER_PROP: DrawerProps = {
  style: { backgroundColor: '#111', padding: 0, margin: 0, color: '#fff' },
  placement: 'right',
  closable: false,
  width: '640px',
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
