import { IconOutline } from '@ant-design/icons-react-native';
import type { ComponentProps } from 'react';

/** Native counterpart of Ant Design's MailOutlined. */
export function MailOutlined(props: Omit<ComponentProps<typeof IconOutline>, 'name'>) {
  return <IconOutline name="mail" {...props} />;
}
