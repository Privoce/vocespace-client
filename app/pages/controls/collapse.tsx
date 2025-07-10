import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

export interface FocusCollapseProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function FocusCollapse({ open, setOpen }: FocusCollapseProps) {
  return (
    <div
      style={{
        height: '100vh',
        width: 28,
        paddingTop: 24,
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "flex-start",
        backgroundColor: "#1e1e1e",
        cursor: "pointer",
      }}
      onClick={() => setOpen(!open)}
    >
      {open ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
    </div>
  );
}
