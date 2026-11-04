import { UserOutlined } from "@ant-design/icons";
import { User } from "@supabase/supabase-js";
import { Avatar, Button, Dropdown, Spin, message } from "antd";
import { useRouter } from "next/navigation";
import { useAuth, whereUserFrom } from "@/hooks/useUser";
import { Nullable } from "@/lib/std";
import { UserInfo } from "@/lib/std/user";
import { useI18n } from "@/lib/i18n/i18n";

export interface UserBoxProps {
  user: Nullable<User>;
  userInfo: Nullable<UserInfo>;
  username: string;
  loading?: boolean;
  avatar?: Nullable<string>;
}

/**
 * UserBox component
 * always use in header to show user is login or not
 * if login, show user avatar and dropdown menu
 * if not login, show login button
 */
export function UserBox({
  user,
  username,
  loading = false,
  userInfo,
  avatar,
}: UserBoxProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { signOut } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const toLogin = () => {
    router.push("/auth/login");
  };

  const handleLogout = async () => {
    try {
      await signOut();
      messageApi.success(t("login.out.success"));
      setTimeout(() => {
        router.replace("/auth/login");
        // window.location.reload();
      }, 500);
    } catch (error) {
      messageApi.error(t("login.out.error"));
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return <div>{/* <Spin size="default" /> */}</div>;
  }

  return (
    <div>
      {contextHolder}
      {user ? (
        <Dropdown
          placement="bottomRight"
          menu={{
            items: [
              {
                key: "display_email",
                label: user.email,
                disabled: true,
              },
              {
                key: "profile",
                label: t("user.box.profile"),
                onClick: () => router.push(`/auth/user/${user.id}`),
              },
              {
                key: "settings",
                label: t("user.box.settings"),
                onClick: () => router.push(`/auth/user/${user.id}?pg=settings`),
              },
              {
                key: "logout",
                label: t("user.box.logout"),
                onClick: handleLogout,
              },
            ],
          }}
        >
          <Avatar
            size={"large"}
            src={avatar}
            style={{
              backgroundColor: avatar ? "transparent" : "#22CCEE",
              cursor: "pointer",
              border: "none",
            }}
          >
            {username.charAt(0).toUpperCase() || <UserOutlined />}
          </Avatar>
        </Dropdown>
      ) : (
        <Button
          type="primary"
          size="large"
          onClick={toLogin}
          icon={<UserOutlined></UserOutlined>}
        >
          {t("login.title")}
        </Button>
      )}
    </div>
  );
}
