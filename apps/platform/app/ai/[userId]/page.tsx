"use client";

import { useI18n } from "@/lib/i18n/i18n";
import { Todo } from "./todo";
import { Col, message, Row } from "antd";
import { useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import styles from "@/styles/ai.module.scss";
import { AIAnalysis } from "./analysis";

export default function Page({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const {
    user,
    userInfo,
    spaces,
    avatar,
    isSelf,
    loading,
    error,
    needsOnboarding,
    client,
    refreshUserData,
    updateUserInfo,
  } = useUser({
    userId: params.userId,
  });

  useEffect(() => {
    if (error) {
      console.warn("Error loading user data:", error, params.userId);

      messageApi.error(error);
    }
  }, [error, messageApi, params.userId]);

  return (
    <div className={styles.view}>
      {contextHolder}
      <Row style={{height: "100%"}}>
        <Col span={8}>
          <Todo messageApi={messageApi} userId={userId} client={client} isSelf={isSelf}></Todo>
        </Col>
        <Col span={16}>
          <AIAnalysis userId={userId} client={client} messageApi={messageApi}></AIAnalysis>
        </Col>
      </Row>
    </div>
  );
}
