import { Card, Skeleton } from 'antd';
import { useEffect, useState } from 'react';
import styles from '@/styles/chat.module.scss';
import { api } from '@/lib/api';

interface LinkPreviewProps {
  text?: string;
  isLocal: boolean;
}

interface PreviewData {
  charset?: string | null;
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  mediaType: string;
  contentType?: string;
  images?: string[];
  videos?: {
    url?: string;
    secureUrl?: string | null;
    type?: string | null;
    width?: string;
    height?: string;
  }[];
  favicons: string[];
}

export const useLinkPreview = ({
  text,
  isLocal,
}: LinkPreviewProps): {
  link: string;
  linkPreview: React.ReactNode;
} => {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extract the first URL from the text for preview
    const extractFirstUrl = (text: string): string | null => {
      const urlRegex = /https?:\/\/[\w\-_]+(\.[\w\-_]+)+(?:[\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/i;
      const match = text.match(urlRegex);
      return match ? match[0] : null;
    };

    // Fetch link preview data from the API
    const fetchLinkPreview = async () => {
      if (text) {
        const firstUrl = extractFirstUrl(text);
        if (!firstUrl) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          const response = await api.fetchLinkPreview(firstUrl);
          if (!response.ok) {
            throw new Error('Failed to fetch link preview');
          }
          const data = await response.json();
          console.warn('Link preview data:', data);
          setPreviewData(data);
          setError(null);
        } catch (err) {
          setError(err as string);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchLinkPreview();
  }, [text]);

  if (loading) {
    return {
      link: '',
      linkPreview: <Skeleton active paragraph={{ rows: 2 }} />,
    };
  }

  if (error || !previewData) {
    return {
      link: '',
      linkPreview: <></>,
    };
  }

  return {
    link: previewData.url,
    linkPreview: (
      <a
        href={previewData.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link_preview}
        style={{
          justifyContent: isLocal ? 'flex-end' : 'flex-start',
        }}
      >
        <Card size="small" className={styles.link_preview_card}>
          {previewData?.images && previewData.images.length > 0 && (
            <div className={styles.link_preview_image}>
              <img src={previewData.images[0]} alt={previewData.title || '链接预览'} />
            </div>
          )}
          <div className={styles.link_preview_content}>
            {previewData?.siteName && (
              <div className={styles.link_preview_site}>
                {previewData?.favicons.map((favicon, index) => (
                  <img key={index} src={favicon} alt="" className={styles.link_preview_favicon} />
                ))}
                <span>{previewData.siteName}</span>
              </div>
            )}
            {previewData?.title && (
              <h4 className={styles.link_preview_title}>{previewData.title}</h4>
            )}
            {previewData?.description && (
              <p className={styles.link_preview_description}>{previewData.description}</p>
            )}
          </div>
        </Card>
      </a>
    ),
  };
};
