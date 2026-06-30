/**
 * # 证书管理组件
 * 用于管理用户的证书
 * - 统计用户证书与证书类型（免费证书、付费证书、房间证书（新））房间证书还没实现 (antd Statistics组件)
 * - Tabs 组件用于查看看板
 *    - 查看用户证书 （表格形式）（操作栏： 升级，更新，延长，删除） 升级：升级证书（比如从免费升级到付费）更新：更新证书，不会改变证书类型，但会生成新的证书，延长：延长证书有效期（这里需要二次选择框选择延长时间：3天，7天，30天，6个月，1年）
 *    - 生成证书 （输入需要的用户数据为用户生成一个证书），界面中还需要有一个按钮用于将用户证书发送给用户（通过用户邮箱发送）
 *    - 验证证书 （有一个TextArea组件用来输入证书，点击验证按钮后，会验证证书是否有效）
 * 整个证书管理组件的Tabs部分的所有操作需要直接与后端进行交互，并且提供配置的hostToken用于管理员验证操作
 */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Input,
  Form,
  Select,
  Statistic,
  Row,
  Col,
  Card,
  message,
  Space,
  Typography,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import TextArea from 'antd/es/input/TextArea';
import { useI18n } from '@/lib/i18n/i18n';
import { api } from '@/lib/api';

const { Title, Text } = Typography;

interface LicenseRecord {
  id: string;
  email: string;
  domains: string;
  created_at: number;
  expires_at: number;
  value: string;
  ilimit: string;
}

const fmtDate = (ts: number): string => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const licenseTypeColor = (limit: string) => {
  switch (limit) {
    case 'free':
      return 'default';
    case 'pro':
      return 'blue';
    case 'enterprise':
      return 'gold';
    default:
      return 'default';
  }
};

const isValidLicense = (expiresAt: number): boolean => {
  return Math.floor(Date.now() / 1000) < expiresAt;
};

interface DashboardLicenseManageProps {
  isHostManager?: boolean;
  hostToken?: string;
}

export const DashboardLicenseManage: React.FC<DashboardLicenseManageProps> = ({}) => {
  const { t } = useI18n();
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('view');

  // 生成证书表单
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // 更新证书表单
  const [updateForm] = Form.useForm();
  const [updateLoading, setUpdateLoading] = useState(false);

  // 验证证书
  const [validateValue, setValidateValue] = useState('');
  const [validateResult, setValidateResult] = useState<{
    valid: boolean;
    msg: string;
    license?: LicenseRecord;
  } | null>(null);
  const [validateLoading, setValidateLoading] = useState(false);

  // 延长期限模态框
  const [extendModal, setExtendModal] = useState<{
    open: boolean;
    record: LicenseRecord | null;
  }>({ open: false, record: null });
  const [extendDays, setExtendDays] = useState<number>(30);

  // token输入
  const [inputToken, setInputToken] = useState('');
  const [verified, setVerified] = useState(false);
  const [hostToken, setHostToken] = useState('');
  const [isHostManager, setIsHostManager] = useState(false);

  const lm = (key: string) => t(`dashboard.licenseManage.${key}`);

  // hostToken验证
  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const resp = await api.checkHostToken(token);
      const data = await resp.json();
      return data.success === true;
    } catch {
      return false;
    }
  };

  const handleVerifyToken = async () => {
    if (!inputToken) {
      message.warning(t('dashboard.conf.placeholder'));
      return;
    }
    const ok = await verifyToken(inputToken);
    if (ok) {
      setHostToken(inputToken);
      setIsHostManager(true);
      setVerified(true);
      message.success(t('dashboard.host_token_verify_success') || 'Token verified');
      // 加载数据
      await fetchLicenses(inputToken);
    } else {
      message.error(t('dashboard.conf.error.verify'));
    }
  };

  // 获取所有证书
  const fetchLicenses = async (token?: string) => {
    const tk = token || hostToken;
    if (!tk) return;
    setLoading(true);
    try {
      const resp = await api.getAllLicenses(tk);
      if (resp.ok) {
        const data = await resp.json();
        setLicenses(data.licenses || []);
      } else {
        message.error(lm('fetchFailed'));
      }
    } catch (err) {
      console.error('Failed to fetch licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  // 首次加载或 hostToken 变化时获取数据
  useEffect(() => {
    if (isHostManager && hostToken) {
      fetchLicenses();
    }
  }, [isHostManager, hostToken]);

  // 统计信息
  const stats = useMemo(() => {
    const total = licenses.length;
    const valid = licenses.filter((l) => isValidLicense(l.expires_at)).length;
    const expired = total - valid;
    const proCount = licenses.filter((l) => l.ilimit === 'pro').length;
    return { total, valid, expired, proCount };
  }, [licenses]);

  // 表格列定义
  const columns = [
    {
      title: lm('tableEmail'),
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: lm('tableDomains'),
      dataIndex: 'domains',
      key: 'domains',
      ellipsis: true,
    },
    {
      title: lm('tableType'),
      dataIndex: 'ilimit',
      key: 'ilimit',
      render: (limit: string) => <Tag color={licenseTypeColor(limit)}>{limit}</Tag>,
    },
    {
      title: lm('tableCreated'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (ts: number) => fmtDate(ts),
    },
    {
      title: lm('tableExpires'),
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (ts: number) => (
        <span style={{ color: isValidLicense(ts) ? undefined : '#ff4d4f' }}>
          {fmtDate(ts)}
          {!isValidLicense(ts) && <ExclamationCircleOutlined style={{ marginLeft: 4 }} />}
        </span>
      ),
    },
    {
      title: lm('tableStatus'),
      key: 'status',
      render: (_: any, record: LicenseRecord) =>
        isValidLicense(record.expires_at) ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {lm('tableValid')}
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            {lm('tableExpired')}
          </Tag>
        ),
    },
    {
      title: lm('tableActions'),
      key: 'actions',
      render: (_: any, record: LicenseRecord) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              updateForm.setFieldsValue({
                email: record.email,
                value: record.value,
                newDomains: record.domains,
                newEmail: record.email,
              });
              setActiveTab('update');
            }}
          >
            {lm('tabUpdate')}
          </Button>
          <Button
            size="small"
            onClick={() => setExtendModal({ open: true, record })}
          >
            {lm('extendTitle')}
          </Button>
        </Space>
      ),
    },
  ];

  // 创建证书
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      const resp = await api.createLicense(
        {
          email: values.email,
          domains: values.domains,
        },
        hostToken,
      );
      const data = await resp.json();
      if (resp.ok && data.success) {
        message.success(lm('createSuccess').replace('{value}', data.license_value?.substring(0, 20) || ''));
        Modal.success({
          title: lm('createModalTitle'),
          content: (
            <div>
              <Text strong>{lm('licenseValue')}:</Text>
              <Text copyable style={{ display: 'block', wordBreak: 'break-all', marginTop: 8 }}>
                {data.license_value}
              </Text>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {data.email_sent ? lm('emailSent') : lm('emailFailed')}
              </Text>
            </div>
          ),
          width: 600,
        });
        createForm.resetFields();
        await fetchLicenses();
      } else {
        message.error(data.error || lm('createFailed'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  };

  // 更新证书
  const handleUpdate = async () => {
    try {
      const values = await updateForm.validateFields();
      setUpdateLoading(true);
      const resp = await api.updateLicense(
        {
          email: values.email,
          value: values.value,
          newDomains: values.newDomains,
          newEmail: values.newEmail,
        },
        hostToken,
      );
      const data = await resp.json();
      if (resp.ok && data.success) {
        message.success(lm('updateSuccess'));
        updateForm.resetFields();
        setActiveTab('view');
        await fetchLicenses();
      } else {
        message.error(data.error || lm('updateFailed'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdateLoading(false);
    }
  };

  // 延长证书
  const handleExtend = async () => {
    if (!extendModal.record) return;
    const record = extendModal.record;

    setUpdateLoading(true);
    try {
      const resp = await api.updateLicense(
        {
          email: record.email,
          value: record.value,
        },
        hostToken,
      );
      if (resp.ok) {
        message.success(lm('extendSuccess').replace('{days}', String(extendDays)));
        setExtendModal({ open: false, record: null });
        await fetchLicenses();
      } else {
        const data = await resp.json();
        message.error(data.error || lm('updateFailed'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdateLoading(false);
    }
  };

  // 验证证书
  const handleValidate = async () => {
    if (!validateValue.trim()) {
      message.warning(lm('validatePlaceholder'));
      return;
    }
    setValidateLoading(true);
    setValidateResult(null);
    try {
      const resp = await api.validateLicenseValue(validateValue.trim());
      if (resp.ok) {
        const data = await resp.json();
        setValidateResult({
          valid: isValidLicense(data.expires_at),
          msg: isValidLicense(data.expires_at) ? lm('validateValid') : lm('validateExpired'),
          license: data,
        });
      } else if (resp.status === 403) {
        setValidateResult({ valid: false, msg: lm('validateInvalid') });
      } else if (resp.status === 404) {
        setValidateResult({ valid: false, msg: lm('validateNotFound') });
      } else {
        setValidateResult({ valid: false, msg: lm('validateFailed') });
      }
    } catch (err) {
      setValidateResult({ valid: false, msg: lm('validateFailed') });
    } finally {
      setValidateLoading(false);
    }
  };

  if (!isHostManager && !verified) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={4}>{lm('title')}</Title>
        <Card>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {lm('enterToken')}
          </Text>
          <Space>
            <Input.Password
              placeholder={t('dashboard.conf.placeholder')}
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              style={{ width: 300 }}
            />
            <Button type="primary" onClick={handleVerifyToken}>
              {t('dashboard.conf.verify')}
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  const extendDaysMap = [
    { value: 3, label: lm('extendDays3') },
    { value: 7, label: lm('extendDays7') },
    { value: 30, label: lm('extendDays30') },
    { value: 180, label: lm('extendDays180') },
    { value: 365, label: lm('extendDays365') },
  ];

  const tabItems = [
    {
      key: 'view',
      label: lm('tabView'),
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title={lm('statsTotal')} value={stats.total} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={lm('statsValid')}
                  value={stats.valid}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={lm('statsExpired')}
                  value={stats.expired}
                  valueStyle={{ color: stats.expired > 0 ? '#cf1322' : undefined }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title={lm('statsPro')} value={stats.proCount} suffix={`/ ${stats.total}`} />
              </Card>
            </Col>
          </Row>
          <Table
            dataSource={licenses}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: 'create',
      label: lm('tabCreate'),
      children: (
        <Card>
          <Form
            form={createForm}
            layout="vertical"
            style={{ maxWidth: 500 }}
          >
            <Form.Item
              name="email"
              label={lm('formEmail')}
              rules={[{ required: true, type: 'email', message: lm('formEmailRequired') }]}
            >
              <Input placeholder="user@example.com" />
            </Form.Item>
            <Form.Item
              name="domains"
              label={lm('formDomains')}
              rules={[{ required: true, message: lm('formDomainsRequired') }]}
            >
              <Input placeholder={lm('formDomainsPlaceholder')} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleCreate} loading={createLoading}>
                {lm('createBtn')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'update',
      label: lm('tabUpdate'),
      children: (
        <Card>
          <Form
            form={updateForm}
            layout="vertical"
            style={{ maxWidth: 500 }}
          >
            <Form.Item
              name="email"
              label={lm('updateOriginalEmail')}
              rules={[{ required: true, message: lm('formEmailRequired') }]}
            >
              <Input placeholder="original email" />
            </Form.Item>
            <Form.Item
              name="value"
              label={lm('updateLicenseValue')}
              rules={[{ required: true, message: lm('updateLicenseValueRequired') }]}
            >
              <TextArea rows={3} placeholder={lm('updateLicenseValue')} />
            </Form.Item>
            <Form.Item name="newDomains" label={lm('updateNewDomains')}>
              <Input placeholder={lm('updateNewDomains')} />
            </Form.Item>
            <Form.Item name="newEmail" label={lm('updateNewEmail')}>
              <Input placeholder={lm('updateNewEmail')} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleUpdate} loading={updateLoading}>
                {lm('updateBtn')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'validate',
      label: lm('tabValidate'),
      children: (
        <Card>
          <TextArea
            rows={5}
            placeholder={lm('validatePlaceholder')}
            value={validateValue}
            onChange={(e) => {
              setValidateValue(e.target.value);
              setValidateResult(null);
            }}
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={handleValidate} loading={validateLoading}>
            {lm('validateBtn')}
          </Button>
          {validateResult && (
            <Card
              size="small"
              style={{ marginTop: 16 }}
              variant="outlined"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {validateResult.valid ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                )}
                <span style={{ fontWeight: 500 }}>{validateResult.msg}</span>
              </div>
              {validateResult.license && (
                <div style={{ marginTop: 12 }}>
                  <div><Text strong>{lm('tableEmail')}:</Text> {validateResult.license.email}</div>
                  <div><Text strong>{lm('tableDomains')}:</Text> {validateResult.license.domains}</div>
                  <div><Text strong>{lm('tableType')}:</Text> {validateResult.license.ilimit}</div>
                  <div><Text strong>{lm('tableCreated')}:</Text> {fmtDate(validateResult.license.created_at)}</div>
                  <div><Text strong>{lm('tableExpires')}:</Text> {fmtDate(validateResult.license.expires_at)}</div>
                </div>
              )}
            </Card>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>{lm('title')}</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* 延长期限模态框 */}
      <Modal
        title={lm('extendTitle')}
        open={extendModal.open}
        onOk={handleExtend}
        onCancel={() => setExtendModal({ open: false, record: null })}
        confirmLoading={updateLoading}
      >
        {extendModal.record && (
          <div>
            <p>
              <Text strong>{lm('tableEmail')}:</Text> {extendModal.record.email}
            </p>
            <p>
              <Text strong>{lm('extendCurrentExpires')}:</Text> {fmtDate(extendModal.record.expires_at)}
            </p>
            <div style={{ marginTop: 16 }}>
              <Text>{lm('extendBy')}:</Text>
              <Select
                value={extendDays}
                onChange={setExtendDays}
                style={{ width: 200, marginLeft: 8 }}
                options={extendDaysMap}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
