"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Spin, Empty, message, Card } from "antd";
import ReactMarkdown from "react-markdown";
import { HomeHeader } from "../../home/header";
import { SpaceCard } from "@/components/space/card";
import {
  Space,
  SpaceState,
  FrequencyInterval,
  SpaceType,
} from "@/lib/std/space";
import styles from "@/styles/space_about.module.scss";
import { MessageInstance } from "antd/es/message/interface";



interface SpaceAboutProps {
  spaceId?: string;
  messageApi: MessageInstance;
}

export default function SpaceAbout({ spaceId, messageApi }: SpaceAboutProps) {
  const searchParams = useSearchParams();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const id = spaceId || searchParams?.get("spaceId");

  useEffect(() => {
    const fetchSpace = async () => {
      if (!id) {
        setError("Space ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // In real app, fetch data based on ID
        setSpace(null);
        setError(null);
      } catch (err) {
        setError("Failed to load space information");
        message.error("加载空间信息失败");
      } finally {
        setLoading(false);
      }
    };

    fetchSpace();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.spaceAbout}>
        <HomeHeader messageApi={messageApi} />
        <div className={styles.loading}>
          {/* <Spin size="large" /> */}
        </div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className={styles.spaceAbout}>
        <HomeHeader messageApi={messageApi} />
        <div className={styles.error}>
          <div className={styles.errorTitle}>出现错误</div>
          <div className={styles.errorMessage}>{error || "未找到空间信息"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.spaceAbout}>
      <HomeHeader messageApi={messageApi} />

      <div className={styles.container}>
        {/* Left Content - Images and README */}
        <Card className={styles.leftContent}>
          {/* Image Gallery */}
          <div className={styles.imageGallery}>
            {space.images && space.images.length > 0 ? (
              <>
                <img
                  src={space.images[selectedImageIndex]}
                  alt={`${space.name} - ${selectedImageIndex + 1}`}
                  className={styles.mainImage}
                />
                <div className={styles.imageList}>
                  {space.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`${space.name} - ${index + 1}`}
                      className={`${styles.imageItem} ${
                        index === selectedImageIndex ? styles.selected : ""
                      }`}
                      onClick={() => setSelectedImageIndex(index)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.noImages}>暂无宣传图片</div>
            )}
          </div>

          {/* README Section */}
          <div className={styles.readmeSection}>
            <h2 className={styles.sectionTitle}>空间介绍</h2>
            {space.readme ? (
              <div className={styles.readmeContent}>
                <ReactMarkdown>{space.readme}</ReactMarkdown>
              </div>
            ) : (
              <div className={styles.noReadme}>暂无详细介绍</div>
            )}
          </div>
        </Card>

        {/* Right Content - Space Card */}
        <div className={styles.rightContent}>
          {/* <SpaceCard {...space} style={{ margin: 0 }} /> */}
        </div>
      </div>
    </div>
  );
}
