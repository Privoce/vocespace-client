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
  Descriptions,
  TableColumnsType,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import TextArea from 'antd/es/input/TextArea';
import { useI18n } from '@/lib/i18n/i18n';
import { api } from '@/lib/api';
import { fmtDate, LicenseDetailCard } from './LicenseDetailCard';

const { Title } = Typography;

export type LicenseType = 'free' | 'pro' | 'enterprise' | 'room';
export const LICENSE_TYPES: LicenseType[] = ['free', 'pro', 'enterprise', 'room'];

interface LicenseRecord {
  id: string;
  email: string;
  domains: string;
  created_at: number;
  expires_at: number;
  value: string;
  ilimit: LicenseType;
  roomName?: string;
}

const licenseTypeColor = (limit: string) => {
  switch (limit) {
    case 'free':
      return 'default';
    case 'pro':
      return 'blue';
    case 'enterprise':
      return 'gold';
    case 'room':
      return 'purple';
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
  const [createdLicense, setCreatedLicense] = useState<any>(null);

  // 更新证书表单
  const [updateForm] = Form.useForm();
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updatedLicense, setUpdatedLicense] = useState<any>(null);

  // 验证证书
  const [validateValue, setValidateValue] = useState('');
  const [validateResult, setValidateResult] = useState<{
    valid: boolean;
    msg: string;
    license?: any;
    invalidFields?: string[];
    inDb?: boolean;
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

  // 字段映射
  const fieldLabelMap: Record<string, string> = {
    email: lm('fieldEmail'),
    domains: lm('fieldDomains'),
    created_at: lm('fieldCreatedAt'),
    expires_at: lm('fieldExpiresAt'),
    limit: lm('fieldLimit'),
    id: lm('fieldId'),
  };

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
    const roomCount = licenses.filter((l) => l.ilimit === 'room').length;
    return { total, valid, expired, proCount, roomCount };
  }, [licenses]);

  // 表格列定义
  const columns: TableColumnsType<any> = [
    {
      title: lm('tableEmail'),
      dataIndex: 'email',
      fixed: 'left',
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
      width: 100,
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
      width: 140,
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
      fixed: 'right',
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
          <Button size="small" onClick={() => setExtendModal({ open: true, record })}>
            {lm('extendTitle')}
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record)}>
            {lm('deleteBtn')}
          </Button>
        </Space>
      ),
    },
  ];

  // 删除证书
  const handleDelete = async (record: LicenseRecord) => {
    Modal.confirm({
      title: lm('deleteConfirmTitle'),
      content: lm('deleteConfirmContent').replace('{email}', record.email),
      okText: lm('deleteBtn'),
      cancelText: t('dashboard.conf.cancel') || 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const resp = await api.deleteAllLicenses(hostToken, record.id);
          const data = await resp.json();
          if (resp.ok && data.success) {
            message.success(lm('deleteSuccess'));
            await fetchLicenses();
          } else {
            message.error(data.error || lm('deleteFailed'));
          }
        } catch (err) {
          console.error(err);
          message.error(lm('deleteFailed'));
        }
      },
    });
  };

  // 创建证书
  const [importLoading, setImportLoading] = useState(false);

  const handleCreate = async (sendEmail: boolean) => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      setCreatedLicense(null);
      const resp = await api.createLicense(
        {
          email: values.email,
          domains: values.domains,
          ilimit: values.ilimit || 'pro',
          sendEmail,
          roomName: values.roomName,
        },
        hostToken,
      );
      const data = await resp.json();
      if (resp.ok && data.success) {
        setCreatedLicense(data.license);
        message.success(
          lm('createSuccess').replace('{value}', data.license_value?.substring(0, 20) || ''),
        );
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

  // 导入证书到数据库
  const handleImportToDb = async () => {
    if (!validateValue.trim()) return;
    setImportLoading(true);
    try {
      const resp = await api.createLicense(
        { value: validateValue.trim(), sendEmail: false },
        hostToken,
      );
      const data = await resp.json();
      if (resp.ok && data.success) {
        message.success(lm('importToDbSuccess'));
        setValidateResult(null);
        setValidateValue('');
        await fetchLicenses();
      } else {
        message.error(data.error || lm('importToDbError'));
      }
    } catch (err) {
      console.error(err);
      message.error(lm('importToDbError'));
    } finally {
      setImportLoading(false);
    }
  };

  // 更新证书
  const handleUpdate = async (sendEmail: boolean = false) => {
    try {
      const values = await updateForm.validateFields();
      setUpdateLoading(true);
      setUpdatedLicense(null);
      const resp = await api.updateLicense(
        {
          email: values.email,
          value: values.value,
          newDomains: values.newDomains,
          newEmail: values.newEmail,
          sendEmail,
        },
        hostToken,
      );
      const data = await resp.json();
      if (resp.ok && data.success) {
        setUpdatedLicense(data.license);
        message.success(sendEmail ? lm('updateAndSendSuccess') : lm('updateSuccess'));
        updateForm.resetFields();
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
      const data = await resp.json();
      if (resp.ok) {
        if (data.inDb && data.license) {
          // 数据库中的记录
          setValidateResult({
            valid: data.valid,
            msg: data.valid ? lm('validateValid') : lm('validateExpired'),
            license: data.license,
            invalidFields: data.invalidFields,
            inDb: true,
          });
        } else if (data.inDb === false && data.claims) {
          // 不在数据库中，解析JWT字段
          if (data.valid) {
            setValidateResult({
              valid: true,
              msg: lm('validateNotInDb'),
              license: data.claims,
              invalidFields: undefined,
              inDb: false,
            });
          } else {
            setValidateResult({
              valid: false,
              msg: lm('validateInvalid'),
              license: data.claims,
              invalidFields: data.invalidFields,
              inDb: false,
            });
          }
        } else {
          setValidateResult({ valid: false, msg: lm('validateFailed') });
        }
      } else if (resp.status === 400) {
        setValidateResult({ valid: false, msg: 'Invalid JWT token' });
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
          <span style={{ display: 'block', marginBottom: 16 }}>{lm('enterToken')}</span>
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
            <Col span={4}>
              <Card>
                <Statistic title={lm('statsTotal')} value={stats.total} />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={lm('statsValid')}
                  value={stats.valid}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={lm('statsExpired')}
                  value={stats.expired}
                  valueStyle={{ color: stats.expired > 0 ? '#cf1322' : undefined }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={lm('statsPro')}
                  value={stats.proCount}
                  suffix={`/ ${stats.total}`}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title={lm('statsRoom')}
                  value={stats.roomCount}
                  suffix={`/ ${stats.total}`}
                />
              </Card>
            </Col>
          </Row>
          <Table
            
            scroll={{ x: 'max-content' }}
            dataSource={licenses}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (record: LicenseRecord) => (
                <div style={{ maxWidth: 600 }}>
                  <span>{lm('licenseValue')}:</span>
                  <div
                    style={{
                      wordBreak: 'break-all',
                      marginTop: 4,
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {record.value}
                  </div>
                </div>
              ),
              rowExpandable: () => true,
            }}
          />
        </div>
      ),
    },
    {
      key: 'create',
      label: lm('tabCreate'),
      children: (
        <Card>
          <Form form={createForm} layout="vertical" style={{ maxWidth: 500 }}>
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
            <Form.Item name="ilimit" label={lm('formType')} initialValue="pro">
              <Select
                onChange={() => {
                  // Clear roomName when type changes away from 'room'
                  createForm.setFieldValue('roomName', undefined);
                }}
                options={LICENSE_TYPES.map((type) => ({
                  value: type,
                  label: lm(`type${type.charAt(0).toUpperCase()}${type.slice(1)}`),
                }))}
              />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) => prev.ilimit !== cur.ilimit}
            >
              {({ getFieldValue }) =>
                getFieldValue('ilimit') === 'room' ? (
                  <Form.Item
                    name="roomName"
                    label={lm('formRoomName')}
                    rules={[{ required: true, message: lm('formRoomNameRequired') }]}
                  >
                    <Input placeholder="my-room-name" />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" onClick={() => handleCreate(true)} loading={createLoading}>
                  {lm('generateBtn')}
                </Button>
                <Button onClick={() => handleCreate(false)} loading={createLoading}>
                  {lm('generateOnlyBtn')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
          {createdLicense && <LicenseDetailCard license={createdLicense} lm={lm} showValue />}
        </Card>
      ),
    },
    {
      key: 'update',
      label: lm('tabUpdate'),
      children: (
        <Card>
          <Form form={updateForm} layout="vertical" style={{ maxWidth: 500 }}>
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
              <Space>
                <Button type="primary" onClick={() => handleUpdate(false)} loading={updateLoading}>
                  {lm('updateBtn')}
                </Button>
                <Button onClick={() => handleUpdate(true)} loading={updateLoading}>
                  {lm('updateAndSendBtn')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
          {updatedLicense && <LicenseDetailCard license={updatedLicense} lm={lm} showValue />}
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
            <Card size="small" style={{ marginTop: 16 }} variant="outlined">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {validateResult.valid ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                )}
                <span style={{ fontWeight: 500 }}>{validateResult.msg}</span>
              </div>

              {/* 入库按钮：有效证书且不在数据库时显示 */}
              {validateResult.inDb === false && validateResult.valid && (
                <div style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={handleImportToDb} loading={importLoading}>
                    {lm('importToDb')}
                  </Button>
                </div>
              )}

              {/* 字段错误列表 */}
              {validateResult.invalidFields && validateResult.invalidFields.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Descriptions title="Invalid Fields" bordered size="small" column={1}>
                    {validateResult.invalidFields.map((field) => (
                      <Descriptions.Item key={field} label={fieldLabelMap[field] || field}>
                        <Tag color="error" icon={<CloseCircleOutlined />}>
                          Invalid
                        </Tag>
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </div>
              )}

              {/* 证书信息 */}
              {validateResult.license && (
                <LicenseDetailCard license={validateResult.license} lm={lm} />
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
              <span>{lm('tableEmail')}:</span> {extendModal.record.email}
            </p>
            <p>
              <span>{lm('extendCurrentExpires')}:</span> {fmtDate(extendModal.record.expires_at)}
            </p>
            <div style={{ marginTop: 16 }}>
              <span>{lm('extendBy')}:</span>
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
