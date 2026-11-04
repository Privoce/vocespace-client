"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Form, Input, Button, Avatar, Typography, Progress } from "antd";
import {
  UserOutlined,
  CheckCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { dbApi } from "@/lib/api/db";
import type { UploadFile } from "antd";
import { SupabaseClient } from "@supabase/supabase-js";
import { MessageInstance } from "antd/es/message/interface";
import { DEFAULT_USER_INFO, UserInfo } from "@/lib/std/user";
import { type User } from "@supabase/supabase-js";
import { Nullable } from "@/lib/std";
import styles from "./drive.module.scss";
import { EditAvatarBtn } from "./widgets/avatar";
import { initSpace, vocespaceUrl, vocespaceUrlVisit } from "@/lib/std/space";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface DriveFormValues {
  username: string;
  desc?: string;
}

interface OnboardingDriveProps {
  user: User;
  userInfo: Nullable<UserInfo>;
  client: SupabaseClient;
  messageApi: MessageInstance;
  onComplete: () => void;
  updateUserInfo: (updates: Partial<UserInfo>) => Promise<boolean>;
  flushUser: () => Promise<void>;
}

export default function OnboardingDrive({
  user,
  userInfo,
  client,
  messageApi,
  onComplete,
  updateUserInfo,
  flushUser,
}: OnboardingDriveProps) {
  const [form] = Form.useForm<DriveFormValues>();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(
    user.user_metadata?.avatar_url,
  );
  const [step, setStep] = useState(1);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();

  // 初始化头像
  useEffect(() => {
    if (userInfo?.avatar) {
      setAvatar(userInfo.avatar);
    } else if (user?.user_metadata?.avatar_url) {
      setAvatar(user.user_metadata.avatar_url);
    }
  }, [userInfo?.avatar, user?.user_metadata?.avatar_url]);

  // 如果用户未认证，重定向到登录页
  useEffect(() => {
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, router]);

  const validateNickname = async (username: string) => {
    if (!username || username.length < 2) {
      return false;
    }

    try {
      // 检查昵称是否已存在
      const { data, error } = await client
        .from("user_info")
        .select("id")
        .eq("username", username)
        .neq("id", user?.id); // 排除自己

      if (error) throw error;
      return data.length === 0;
    } catch (error) {
      console.error("Error validating username:", error);
      return false;
    }
  };

  const handleFinish = async (values: DriveFormValues) => {
    if (!user) {
      messageApi.error(t("user.onboarding.error"));
      return;
    }

    try {
      setLoading(true);

      // 验证昵称唯一性
      const isNicknameValid = await validateNickname(values.username);
      if (!isNicknameValid) {
        messageApi.error(t("user.onboarding.usernameExists"));
        form.setFields([
          {
            name: "username",
            errors: [t("user.onboarding.usernameExists")],
          },
        ]);
        return;
      }

      // 更新用户信息
      const updateData = {
        username: values.username,
        desc: values.desc || null,
        avatar: avatar || null,
        online: true,
      };

      const success = await dbApi.userInfo.insert(
        client,
        updateData as UserInfo,
      );

      if (success) {
        const space = initSpace({
          name: updateData.username,
          desc: "",
          url: vocespaceUrlVisit(updateData.username),
          public: true,
          owner_id: user.id,
        });

        if (!space) {
          messageApi.error(t("space.pub.validation.failed"));
          return;
        }

        try {
          const mySpace = await dbApi.space.getByUserId(client, user.id);
          if (mySpace.length == 0) {
            await dbApi.space.insert(client, space);
            messageApi.success(t("space.pub.success"));
          }
        } catch (error) {
          messageApi.error(t("space.pub.fail"));
        }

        messageApi.success(t("user.onboarding.successMessage"));
        setStep(3); // 显示成功页面
      } else {
        messageApi.error(t("user.onboarding.error"));
      }
      setTimeout(async () => {
        // if has spaceName param, redirect to vocespace url
        const spaceName = searchParams.get("spaceName");
        if (spaceName) {
          const redirectUrl = await vocespaceUrl(
            // user.id,
            // updateData.username,
            DEFAULT_USER_INFO(user.id, updateData.username),
            "vocespace",
            spaceName,
          );

          window.open(redirectUrl, "_self");
          return;
        } else {
          // router.push(`/auth/user/${user.id}`);
          await flushUser();
        }
      }, 2000);
    } catch (error) {
      console.error("Error updating user info:", error);
      messageApi.error(t("user.onboarding.error"));
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className={styles.stepContent}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          {t("user.onboarding.welcome.title")}
        </Title>
        <Paragraph className={styles.subtitle}>
          {t("user.onboarding.welcome.subtitle")}
        </Paragraph>
      </div>

      <div className={styles.features}>
        <div className={styles.feature}>
          <CheckCircleOutlined className={styles.icon} />
          <Text>{t("user.onboarding.welcome.features.connect")}</Text>
        </div>
        <div className={styles.feature}>
          <CheckCircleOutlined className={styles.icon} />
          <Text>{t("user.onboarding.welcome.features.share")}</Text>
        </div>
        <div className={styles.feature}>
          <CheckCircleOutlined className={styles.icon} />
          <Text>{t("user.onboarding.welcome.features.discover")}</Text>
        </div>
      </div>

      <Button
        block
        type="primary"
        size="large"
        icon={<RightOutlined />}
        onClick={() => setStep(2)}
      >
        {t("user.onboarding.welcome.start")}
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.stepContent}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          {t("user.onboarding.profile.title")}
        </Title>
        <Paragraph className={styles.subtitle}>
          {t("user.onboarding.profile.subtitle")}
        </Paragraph>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        className={styles.form}
        requiredMark={false}
        initialValues={{
          username: user.email ? user.email.split("@")[0] : "",
        }}
      >
        {/* 头像上传 */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarUpload}>
            <EditAvatarBtn
              userId={user.id}
              client={client}
              messageApi={messageApi}
              afterUpdate={flushUser}
              oldAvatar={avatar}
            >
              <Avatar
                size={80}
                src={avatar}
                style={{
                  fontSize: 40,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: avatar ? "transparent" : "#22CCEE",
                }}
              >
                <UserOutlined />
              </Avatar>
            </EditAvatarBtn>
          </div>
        </div>
        {/* 昵称 */}
        <Form.Item
          name="username"
          label={t("user.onboarding.profile.username")}
          rules={[
            { required: true, message: t("user.onboarding.usernameRequired") },
            { min: 2, message: t("user.onboarding.usernameLength") },
            { max: 30, message: t("user.onboarding.usernameLength") },
            {
              // 允许空格，方便包含多个单词的姓名
              pattern: /^[a-zA-Z0-9\u4e00-\u9fa5 _-]+$/,
              message: t("user.onboarding.usernamePattern"),
            },
          ]}
        >
          <Input
            size="large"
            placeholder={t("user.onboarding.profile.usernamePlaceholder")}
            maxLength={30}
          />
        </Form.Item>

        {/* 个人简介 */}
        <Form.Item name="desc" label={t("user.onboarding.profile.desc")}>
          <TextArea
            rows={4}
            placeholder={t("user.onboarding.profile.descPlaceholder")}
            maxLength={100}
            showCount
          />
        </Form.Item>

        <div className={styles.buttonGroup}>
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            loading={loading || uploading}
          >
            {t("user.onboarding.profile.complete")}
          </Button>
        </div>
      </Form>
    </div>
  );

  const renderStep3 = () => (
    <div className={styles.stepContent}>
      <div className={styles.successContent}>
        <CheckCircleOutlined className={styles.successIcon} />
        <Title level={2} className={styles.successTitle}>
          {t("user.onboarding.success.title")}
        </Title>
        <Paragraph className={styles.successText}>
          {t("user.onboarding.success.subtitle")}
        </Paragraph>
        <Progress percent={100} showInfo={false} className={styles.progress} />
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className={styles.container}>
        <Card className={styles.card} loading />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.progressSection}>
          <Progress
            percent={(step / 3) * 100}
            showInfo={false}
            // className={styles.progressBar}
          />
          <Text className={styles.stepText}>
            {step === 1
              ? t("user.onboarding.step1")
              : step === 2
                ? t("user.onboarding.step2")
                : t("user.onboarding.step3")}{" "}
            ({step}/3)
          </Text>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </Card>
    </div>
  );
}
