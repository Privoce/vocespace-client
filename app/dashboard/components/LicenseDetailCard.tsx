import { Descriptions } from "antd";

interface LicenseDetailCardProps {
  license: any;
  lm: (key: string) => string;
  showValue?: boolean;
  title?: string;
}

export const fmtDate = (ts: number): string => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 证书详情卡片 — 展示邮箱/域名/类型/创建/过期/ID */
export const LicenseDetailCard: React.FC<LicenseDetailCardProps> = ({ license, lm, showValue, title }) => {
  const itemStyle = { color: '#fff' };

  return (
    <div style={{ marginTop: 16 }}>
      <Descriptions title={title} bordered size="small" column={1}>
        {showValue && license.value && (
          <Descriptions.Item label={lm('licenseValue')} style={itemStyle}>
            <div style={{ wordBreak: 'break-all', maxWidth: 480 }}>{license.value}</div>
          </Descriptions.Item>
        )}
        <Descriptions.Item label={lm('tableEmail')} style={itemStyle}>
          {license.email || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={lm('tableDomains')} style={itemStyle}>
          {license.domains || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={lm('tableType')} style={itemStyle}>
          {license.ilimit || license.limit || '-'}
        </Descriptions.Item>
        <Descriptions.Item label={lm('tableCreated')} style={itemStyle}>
          {license.created_at ? fmtDate(license.created_at) : '-'}
        </Descriptions.Item>
        <Descriptions.Item label={lm('tableExpires')} style={itemStyle}>
          {license.expires_at ? fmtDate(license.expires_at) : '-'}
        </Descriptions.Item>
        <Descriptions.Item label={lm('fieldId')} style={itemStyle}>
          {license.id || '-'}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
};