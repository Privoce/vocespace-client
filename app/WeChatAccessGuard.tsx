'use client';

import { useI18n } from '@/lib/i18n/i18n';
import { isWeChatBrowser, src } from '@/lib/std';
import { Image, Modal, Result } from 'antd';
import React from 'react';

type GuardState =
  | { kind: 'pending' }
  | { kind: 'ok' }
  | { kind: 'wechat' }
  | {
      kind: 'unsupported-browser';
      browserName: string;
      browserVersion: string;
      minimumVersion: string;
    };

type BrowserInfo = {
  name: string;
  version: string;
  versionParts: number[];
};

const MIN_VERSIONS: Record<string, string> = {
  Chrome: '88',
  Edge: '88',
  Firefox: '85',
  Safari: '14.1',
  iOS: '14.3',
};

function parseVersion(version: string): number[] {
  return version
    .split(/[._]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function compareVersions(current: number[], minimum: number[]): number {
  const maxLength = Math.max(current.length, minimum.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentPart = current[index] ?? 0;
    const minimumPart = minimum[index] ?? 0;

    if (currentPart > minimumPart) {
      return 1;
    }

    if (currentPart < minimumPart) {
      return -1;
    }
  }

  return 0;
}

function detectIosVersion(userAgent: string): BrowserInfo | null {
  const match = userAgent.match(/(?:iPhone|CPU (?:iPhone )?OS|iPad; CPU OS) (\d+(?:[_\.]\d+)*)/i);

  if (!match) {
    return null;
  }

  const version = match[1].replace(/_/g, '.');
  return {
    name: 'iOS',
    version,
    versionParts: parseVersion(version),
  };
}

function detectBrowser(userAgent: string): BrowserInfo | null {
  const patterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'Edge', regex: /Edg(?:A|iOS)?\/(\d+(?:\.\d+)*)/i },
    { name: 'Chrome', regex: /(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/i },
    { name: 'Firefox', regex: /(?:Firefox|FxiOS)\/(\d+(?:\.\d+)*)/i },
    { name: 'Safari', regex: /Version\/(\d+(?:\.\d+)*)[\s\S]*Safari\//i },
  ];

  for (const pattern of patterns) {
    const match = userAgent.match(pattern.regex);

    if (match) {
      return {
        name: pattern.name,
        version: match[1],
        versionParts: parseVersion(match[1]),
      };
    }
  }

  return null;
}

function detectGuardState(): GuardState {
  const userAgent = window.navigator.userAgent;

  if (isWeChatBrowser()) {
    return { kind: 'wechat' };
  }

  const iosInfo = detectIosVersion(userAgent);
  if (iosInfo && compareVersions(iosInfo.versionParts, parseVersion(MIN_VERSIONS.iOS)) < 0) {
    const browserInfo = detectBrowser(userAgent);
    return {
      kind: 'unsupported-browser',
      browserName: browserInfo?.name ?? iosInfo.name,
      browserVersion: browserInfo?.version ?? iosInfo.version,
      minimumVersion: MIN_VERSIONS.iOS,
    };
  }

  const browserInfo = detectBrowser(userAgent);
  if (!browserInfo) {
    return { kind: 'ok' };
  }

  const minimumVersion = MIN_VERSIONS[browserInfo.name];
  if (!minimumVersion) {
    return { kind: 'ok' };
  }

  if (compareVersions(browserInfo.versionParts, parseVersion(minimumVersion)) < 0) {
    return {
      kind: 'unsupported-browser',
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
      minimumVersion,
    };
  }

  return { kind: 'ok' };
}

export function WeChatAccessGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [guardState, setGuardState] = React.useState<GuardState>({ kind: 'pending' });
  const [wechatModalOpen, setWeChatModalOpen] = React.useState(false);

  React.useEffect(() => {
    const nextState = detectGuardState();
    setGuardState(nextState);
    if (nextState.kind === 'wechat') {
      setWeChatModalOpen(true);
    }
  }, []);

  if (guardState.kind === 'unsupported-browser') {
    return (
      <Result
        status="warning"
        title={t('common.browser.low_version.title')}
        subTitle={`${t('common.browser.low_version.current_prefix')} ${guardState.browserName} (${guardState.browserVersion}) ${t('common.browser.low_version.current_suffix')} ${guardState.minimumVersion}。${t('common.browser.low_version.recommendation')}`}
      />
    );
  }

  if (guardState.kind === 'pending') {
    return null;
  }

  return (
    <>
      {children}
      <Modal
        open={guardState.kind === 'wechat' && wechatModalOpen}
        footer={null}
        onCancel={() => setWeChatModalOpen(false)}
        title={t('common.wx.access_warning_title')}
      >
        <Result
          status="warning"
          title={t('common.wx.not_support')}
          extra={<Image src={src('/wxClick.png')}></Image>}
        />
      </Modal>
    </>
  );
}