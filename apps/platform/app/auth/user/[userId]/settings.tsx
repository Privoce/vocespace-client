"use client";

import { useI18n } from "@/lib/i18n/i18n";
import { Nullable } from "@/lib/std";
import { Extraction } from "@/lib/std/space";
import { UserInfo } from "@/lib/std/user";
import styles from "@/styles/user_settings.module.scss";
import { UserOutlined } from "@ant-design/icons";
import { User } from "@supabase/supabase-js";
import {
  Avatar,
  Button,
  Checkbox,
  CheckboxOptionType,
  Col,
  Input,
  InputNumber,
  InputNumberProps,
  Radio,
  Row,
  Slider,
} from "antd";
import { MessageInstance } from "antd/es/message/interface";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UserSettingsProps {
  messageApi: MessageInstance;
  userInfo: UserInfo;
  avatar: string | null;
  user: User;
  setPageType: (type: "settings" | "profile") => void;
  deleteAccount: () => Promise<void>;
  updateUserInfo: (updates: Partial<UserInfo>) => Promise<boolean>;
}

export function UserSettings({
  messageApi,
  userInfo,
  avatar,
  user,
  setPageType,
  deleteAccount,
  updateUserInfo,
}: UserSettingsProps) {
  const { t } = useI18n();
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const client = createClient();

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      messageApi.error(
        t("user.setting.password.min_length") || "Password too short",
      );
      return;
    }

    try {
      setChanging(true);
      const { data, error } = await client.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      messageApi.success(
        t("user.setting.password.success") || "Password updated",
      );
      setNewPassword("");
    } catch (e) {
      messageApi.error(
        e instanceof Error ? e.message : t("user.setting.password.fail"),
      );
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.avatar_wrapper}>
        <div className={styles.avatar_wrapper_info}>
          <div>
            <Avatar
              size={48}
              className={styles.avatar}
              src={avatar}
              style={{
                fontSize: 18,
                backgroundColor: avatar ? "transparent" : "#22CCEE",
                border: "none",
              }}
            >
              {userInfo.username.charAt(0).toUpperCase() || <UserOutlined />}
            </Avatar>
          </div>
          <div className={styles.avatar_wrapper_name}>
            {userInfo.username || user.email}
          </div>
        </div>
        <Button
          type="primary"
          onClick={() => {
            setPageType("profile");
          }}
        >
          {t("user.setting.to_profile")}
        </Button>
      </div>
      <div className={styles.items}>
        <div className={styles.items_section}>
          <div className={styles.items_section_title}>
            {t("user.setting.password.change") || "修改密码"}
          </div>
          <div className={styles.items_section_desc}>
            {t("user.setting.password.change_desc") ||
              "输入新密码以更新账户密码。"}
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Input.Password
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={
                t("user.setting.password.placeholder") || "New password"
              }
              style={{ width: 420 }}
            />
            {newPassword.trim().length > 0 && (
              <div style={{ width: "100%" }}>
                <Button
                  type="primary"
                  onClick={handleChangePassword}
                  loading={changing}
                >
                  {t("user.setting.password.change_btn") || "修改"}
                </Button>
              </div>
            )}
          </div>
        </div>
        {/* 修改用户密码 */}

        <div className={styles.items_delete}>
          <div className={styles.items_delete_title}>
            {t("user.setting.account.delete")}
          </div>
          <div className={styles.items_delete_desc}>
            {t("user.setting.account.delete_confirm")}
          </div>
          <Button danger={true} onClick={deleteAccount}>
            {t("user.setting.account.delete_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
