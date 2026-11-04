"use client";

import { DatePicker, DatePickerProps, Image, Skeleton } from "antd";
import styles from "@/styles/ai.module.scss";
import { useEffect, useMemo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import { SupabaseClient } from "@supabase/supabase-js";
import { MessageInstance } from "antd/es/message/interface";
import { dbApi } from "@/lib/api/db";
import { AICutAnalysis, AICutAnalysisRes, DEFAULT_AI_CUT_ANALYSIS } from "@/lib/std/ai";
import { useI18n } from "@/lib/i18n/i18n";
import { todayTimestamp } from "@/lib/std";
import ReactMarkdown from "react-markdown";
import { AI_ANALYSIS_BUCKET } from "@/lib/api/db/storage";

interface AIAnalysisProps {
  userId: string;
  client: SupabaseClient;
  messageApi: MessageInstance;
}

export function AIAnalysis({ userId, client, messageApi }: AIAnalysisProps) {
  const { t } = useI18n();
  const [date, setDate] = useState(dayjs.utc(todayTimestamp()));
  const [loading, setLoading] = useState(false);
  const onChange: DatePickerProps["onChange"] = (date, dateString) => {
    setDate(date as Dayjs);
  };
  const [content, setContent] = useState<AICutAnalysis>();
  // 根据日期获取分析内容 -------------------------------------------------------
  const fetchAIAnalysis = async (userId: string, date: number) => {
    setLoading(true);
    try {
      const res = await dbApi.ai.get(client, userId, date.toString());
      if (res) {
        setContent(res);
      }else {
        // 没有数据
        setContent(DEFAULT_AI_CUT_ANALYSIS);
      }
    } catch (error) {
      messageApi.error("Failed to fetch AI analysis data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIAnalysis(userId, date.valueOf());
  }, [userId, date]);

  return (
    <div className={styles.analysis}>
      <DatePicker onChange={onChange} value={date} />
      {loading ? (
        <div className={styles.analysis_content}>
          <Skeleton paragraph={{ rows: 10 }} active />
        </div>
      ) : (
        <div className={styles.analysis_content}>
          {content?.result.map((section, index) => (
            <div key={index} style={{ marginBottom: "32px" }}>
              {section.name && (
                <h2
                  style={{
                    color: "#fff",
                    fontSize: "18px",
                    marginBottom: "8px",
                  }}
                >
                  {section.name}
                </h2>
              )}
              <p
                style={{
                  color: "#888",
                  fontSize: "12px",
                  marginBottom: "8px",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <span>
                  {`${t("widgets.ai.cut.time.start")}: ${new Date(
                    section.timestamp
                  ).toLocaleString()}`}
                </span>
                <span>{`${t("widgets.ai.cut.time.duration")}: ${
                  section.duration
                }`}</span>
              </p>

              <div style={{ marginBottom: "16px" }}>
                <ReactMarkdown>{section.content}</ReactMarkdown>
              </div>

              <Image
                src={
                  dbApi.storage.getUrl(
                    client,
                    AI_ANALYSIS_BUCKET,
                    `/public/${userId}_${section.timestamp}.jpg`
                  ).data.publicUrl
                }
                alt={`no img: ${userId}_${section.timestamp}.jpg`}
                style={{
                  maxWidth: "320px",
                  height: "auto",
                  borderRadius: "8px",
                  marginRight: "12px",
                }}
              ></Image>

              {section.same && (
                <Image
                  src={
                    dbApi.storage.getUrl(
                      client,
                      AI_ANALYSIS_BUCKET,
                      `/public/${userId}_${section.same}.jpg`
                    ).data.publicUrl
                  }
                  alt={`no img: ${userId}_${section.same}.jpg`}
                  style={{
                    maxWidth: "320px",
                    height: "auto",
                    borderRadius: "8px",
                  }}
                ></Image>
              )}

              {index < content.result.length - 1 && (
                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid #333",
                    margin: "12px 0",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
