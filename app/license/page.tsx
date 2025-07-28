'use client';

import {
  Tabs,
  Card,
  Button,
  Steps,
  Alert,
  Typography,
  Space,
  Descriptions,
  Tag,
  Divider,
} from 'antd';
import * as React from 'react';
import {
  AndroidOutlined,
  AppleOutlined,
  WindowsOutlined,
  LaptopOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { src } from '@/lib/std';

const { Title, Paragraph, Text } = Typography;

export default function Page() {
  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = src(`/license/${filename}`);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const browserCodecSupport = [
    {
      browser: 'Chrome',
      av1: '好',
      vp8: '好',
      vp9: '好',
      h264: '好',
      recommendation: '推荐',
      color: 'green',
    },
    {
      browser: 'Firefox',
      av1: '一般',
      vp8: '好',
      vp9: '好',
      h264: '好',
      recommendation: '推荐',
      color: 'blue',
    },
    {
      browser: 'Edge',
      av1: '好',
      vp8: '好',
      vp9: '好',
      h264: '好',
      recommendation: '实测出现问题',
      color: 'red',
    },
    {
      browser: 'Safari',
      av1: '差',
      vp8: '一般',
      vp9: '差',
      h264: '好',
      recommendation: '有限制',
      color: 'orange',
    },
  ];

  const getTagColor = (support: string) => {
    switch (support) {
      case '好':
        return 'success';
      case '一般':
        return 'warning';
      case '差':
        return 'error';
      default:
        return 'default';
    }
  };

  const mobileSteps = [
    {
      title: '下载证书',
      description: '点击下载按钮获取证书文件',
    },
    {
      title: '安装证书',
      description: '使用Safari浏览器打开证书文件进行安装',
    },
    {
      title: '信任证书',
      description: '在设置中启用对证书的完全信任',
    },
    {
      title: '验证安装',
      description: '访问服务确认证书正常工作',
    },
  ];

  const desktopSteps = [
    {
      title: '下载证书',
      description: '点击下载按钮获取证书文件',
    },
    {
      title: '安装证书',
      description: '双击证书文件或通过浏览器设置安装',
    },
    {
      title: '信任证书',
      description: '将证书标记为受信任的根证书颁发机构',
    },
    {
      title: '重启浏览器',
      description: '重新启动浏览器以使证书生效',
    },
  ];

  const iosInstallContent = (
    <Card
      styles={{
        body: {
          backgroundColor: '#fff',
        },
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload('ca.der')}
          >
            下载 iOS 证书 (ca.der)
          </Button>
        </div>

        <Steps direction="vertical" current={-1} items={mobileSteps} />

        <Alert
          message="iOS 安装详细步骤"
          description={
            <div>
              <Paragraph>
                您可以点击这个链接查看官方安装指南:
                <a href="https://support.apple.com/zh-cn/102390" target='_blank'>在 iOS、iPadOS 和 visionOS 中信任手动安装的证书描述文件</a>
              </Paragraph>
              <Paragraph>
                <Text>1. 下载证书：</Text>
                <br />
                使用 Safari 浏览器访问此页面并下载证书文件
              </Paragraph>

              <Paragraph>
                <Text>2. 安装描述文件：</Text>
                <br />
                • 下载完成后，前往"设置" → "已下载描述文件"
                <br />
                • 点击证书文件并选择"安装"
                <br />• 输入设备密码确认安装
              </Paragraph>

              <Paragraph>
                <Text>3. 信任证书：</Text>
                <br />
                • 前往"设置" → "通用" → "关于本机" → "证书信任设置"
                <br />
                • 找到 "meeting.sg-event.com/SG Root CA" 并开启完全信任
                <br />• 输入密码确认信任
                <br />
                <br />
                <img src={src('/images/ios_settings.png')} height={300}></img>
              </Paragraph>

              <Paragraph>
                <Text>4. 验证安装：</Text>
                <br />在 Safari 中访问服务地址，应该不会出现证书警告
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );

  const androidInstallContent = (
    <Card
      styles={{
        body: {
          backgroundColor: '#fff',
        },
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload('ca.der')}
          >
            下载 Android 证书 (ca.der)
          </Button>
        </div>

        <Steps direction="vertical" current={-1} items={mobileSteps} />

        <Alert
          message="Android 安装详细步骤"
          description={
            <div>
              <Paragraph>
                <Text>1. 下载证书：</Text>
                <br />
                使用 Chrome 或其他浏览器下载证书文件
              </Paragraph>

              <Paragraph>
                <Text>2. 安装证书：</Text>
                <br />
                • 前往"设置" → "安全" → "加密与凭据" → "安装证书"
                <br />
                • 选择"CA 证书"或"受信任的凭据"
                <br />• 选择下载的证书文件进行安装
              </Paragraph>

              <Paragraph>
                <Text>3. 设置证书名称：</Text>
                <br />
                • 为证书设置一个容易识别的名称，如 "meeting.sg-event.com/SG Root CA"
                <br />• 选择"用于 VPN 和应用"
              </Paragraph>

              <Paragraph>
                <Text>4. 验证安装：</Text>
                <br />
                在浏览器中访问服务地址，应该不会出现证书警告
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );

  const windowsInstallContent = (
    <Card
      styles={{
        body: {
          backgroundColor: '#fff',
        },
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload('ca.crt')}
          >
            下载 Windows 证书 (ca.crt)
          </Button>
        </div>

        <Steps direction="vertical" current={-1} items={desktopSteps} />

        <Alert
          message="Windows 安装详细步骤"
          description={
            <div>
              <Paragraph>
                <Text>方法一：双击安装</Text>
                <br />
                • 双击下载的 ca.crt 文件
                <br />
                • 点击"安装证书"
                <br />
                • 选择"本地计算机"，点击"下一步"
                <br />
                • 选择"将所有的证书都放入下列存储"
                <br />
                • 点击"浏览"，选择"受信任的根证书颁发机构"
                <br />• 完成安装并重启浏览器
              </Paragraph>

              <Paragraph>
                <Text>方法二：通过浏览器设置</Text>
                <br />
                • Chrome: 设置 → 隐私设置和安全性 → 安全 → 管理证书 → 受信任的根证书颁发机构 → 导入
                <br />
                • Edge: 设置 → 隐私、搜索和服务 → 安全性 → 管理证书
                <br />• Firefox: 设置 → 隐私与安全 → 证书 → 查看证书 → 证书颁发机构 → 导入
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );

  const macosInstallContent = (
    <Card
      styles={{
        body: {
          backgroundColor: '#fff',
        },
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload('ca.crt')}
          >
            下载 macOS 证书 (ca.crt)
          </Button>
        </div>

        <Steps direction="vertical" current={-1} items={desktopSteps} />

        <Alert
          message="macOS 安装详细步骤"
          description={
            <div>
              <Paragraph>
                <Text>1. 安装证书：</Text>
                <br />
                • 双击下载的 ca.crt 文件
                <br />
                • 在弹出的"钥匙串访问"中选择"系统"钥匙串
                <br />• 点击"添加"
              </Paragraph>

              <Paragraph>
                <Text>2. 信任证书：</Text>
                <br />
                • 在"钥匙串访问"中找到刚安装的证书
                <br />
                • 双击证书，展开"信任"部分
                <br />
                • 将"使用此证书时"设置为"始终信任"
                <br />• 关闭窗口并输入管理员密码
              </Paragraph>

              <Paragraph>
                <Text>3. 重启浏览器：</Text>
                <br />
                完全退出并重新启动浏览器以使证书生效
              </Paragraph>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '24px',
        overflowY: 'scroll',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Title level={2}>
          <QuestionCircleOutlined style={{ color: '#22CCEE', marginRight: '8px' }} />
          内网证书下载与安装指南
        </Title>

        <Alert
          message="重要提示"
          description="为了在内网环境下正常使用VoceSpace服务，您需要安装并信任我们的自签名证书。请根据您的设备类型选择对应的证书文件和安装方法。"
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Tabs
          defaultActiveKey="ios"
          size="large"
          items={[
            {
              key: 'ios',
              label: (
                <span>
                  <AppleOutlined />
                  iOS 设备
                </span>
              ),
              children: iosInstallContent,
            },
            {
              key: 'android',
              label: (
                <span>
                  <AndroidOutlined />
                  Android 设备
                </span>
              ),
              children: androidInstallContent,
            },
            {
              key: 'windows',
              label: (
                <span>
                  <WindowsOutlined />
                  Windows 电脑
                </span>
              ),
              children: windowsInstallContent,
            },
            {
              key: 'macos',
              label: (
                <span>
                  <LaptopOutlined />
                  macOS 电脑
                </span>
              ),
              children: macosInstallContent,
            },
          ]}
        />

        <Divider />

        <Card
          title="浏览器兼容性说明"
          style={{ marginTop: '24px' }}
          styles={{
            body: {
              backgroundColor: '#fff',
            },
          }}
        >
          <Alert
            message="视频编码支持"
            description="不同浏览器对视频编码的支持程度会影响音视频通话质量，建议使用推荐的浏览器以获得最佳体验。"
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          <Descriptions bordered column={1}>
            {browserCodecSupport.map((browser) => (
              <Descriptions.Item
                key={browser.browser}
                label={
                  <Space>
                    <Text>{browser.browser}</Text>
                    <Tag color={browser.color}>{browser.recommendation}</Tag>
                  </Space>
                }
              >
                <Space size="middle">
                  <Text>
                    AV1: <Tag color={getTagColor(browser.av1)}>{browser.av1}</Tag>
                  </Text>
                  <Text>
                    VP8: <Tag color={getTagColor(browser.vp8)}>{browser.vp8}</Tag>
                  </Text>
                  <Text>
                    VP9: <Tag color={getTagColor(browser.vp9)}>{browser.vp9}</Tag>
                  </Text>
                  <Text>
                    H264: <Tag color={getTagColor(browser.h264)}>{browser.h264}</Tag>
                  </Text>
                </Space>
              </Descriptions.Item>
            ))}
          </Descriptions>

          <Alert
            message="浏览器推荐"
            description={
              <div>
                <Paragraph style={{ color: '#ff0000' }}>
                  <Text strong style={{ color: '#ff0000' }}>
                    强烈推荐：
                  </Text>{' '}
                  Chrome、Firefox - 支持所有主要视频编码，兼容性最佳
                </Paragraph>
                <Paragraph>
                  <Text>有限支持：</Text> Safari - 对某些编码支持有限，可能影响音视频质量
                </Paragraph>
                <Paragraph>
                  <Text type="secondary" style={{ color: 'orange' }}>
                    注：VP9 和 AV1 编码可以提供更好的压缩率和画质，H264 兼容性最好但文件较大
                  </Text>
                </Paragraph>
              </div>
            }
            type="success"
            style={{ marginTop: '16px' }}
          />
        </Card>
      </div>
    </div>
  );
}
