"use client";

import { Button, Result } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthCodeErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get("error") || "未知错误";
  const errorCode = searchParams?.get("error_code") || "";
  const errorDescription = searchParams?.get("error_description") || "";

  let errorMessage = "Google 登录过程中出现错误，请重试。";
  
  if (errorCode === "flow_state_not_found") {
    errorMessage = "登录会话已过期，请重新开始登录流程。";
  } else if (errorDescription) {
    errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
  } else if (error && error !== "unknown") {
    errorMessage = `错误信息: ${error}`;
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <Result
        status="error"
        title="登录失败"
        subTitle={errorMessage}
        extra={[
          <Button type="primary" key="retry" onClick={() => router.push('/auth/login')}>
            重新登录
          </Button>,
          <Button key="home" onClick={() => router.push('/')}>
            返回首页
          </Button>,
        ]}
      />
    </div>
  );
}

export default function AuthCodeError() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
      }}>
        Loading...
      </div>
    }>
      <AuthCodeErrorContent />
    </Suspense>
  );
}