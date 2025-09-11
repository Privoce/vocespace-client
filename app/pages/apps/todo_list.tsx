import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  DescriptionsProps,
  Input,
  List,
  Modal,
  Progress,
} from 'antd';
import { useMemo, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { MessageInstance } from 'antd/es/message/interface';
import { AppAuth, TodoItem } from '@/lib/std/space';
import { DeliveredProcedureOutlined } from '@ant-design/icons';
import { useLocalParticipant } from '@livekit/components-react';

export interface AppTodoProps {
  messageApi: MessageInstance;
  appData: TodoItem[];
  setAppData: (data: TodoItem[]) => Promise<void>;
  auth: AppAuth;
}

export function AppTodo({ messageApi, appData, setAppData, auth }: AppTodoProps) {
  const { t } = useI18n();
  const disabled = useMemo(() => {
    return auth !== 'write';
  }, [auth]);
  const [newTodo, setNewTodo] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [showExport, setShowExport] = useState<boolean>(false);
  const { localParticipant } = useLocalParticipant();
  const toggleTodo = async (id: string) => {
    let data = appData.map((item) => {
      // return item.id === id ? { ...item, done: Date.now() } : item;
      if (item.id === id) {
        if (!item.done) {
          return { ...item, done: Date.now() };
        } else {
          return { ...item, done: undefined };
        }
      }
      return item;
    });

    await setAppData(data);
  };

  const startEditing = (item: TodoItem) => {
    if (!disabled) {
      setEditingId(item.id);
      setEditingValue(item.title);
    }
  };

  const saveEdit = async () => {
    if (editingId && editingValue.trim() !== '') {
      const data = appData.map((item) => {
        return item.id === editingId ? { ...item, title: editingValue.trim() } : item;
      });
      await setAppData(data);
    }
    setEditingId(null);
    setEditingValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };
  const addTodo = async () => {
    if (!newTodo || newTodo.trim() === '') {
      messageApi.error(t('more.app.todo.empty_value'));
      return;
    }

    const newTodoItem: TodoItem = {
      id: Date.now().toString(),
      title: newTodo.trim(),
      done: undefined,
    };

    let data = [...appData, newTodoItem];
    await setAppData(data);
    setNewTodo('');
  };

  const historyItems: DescriptionsProps['items'] = useMemo(() => {
    if (appData.length === 0) {
      return [];
    }
    let items: DescriptionsProps['items'] = [];
    appData.forEach((item) => {
      items.push({
        label: item.title,
        key: item.id,
        children: item.done
          ? `${new Date(Number(item.id)).toLocaleString()} ~ ${new Date(
              item.done,
            ).toLocaleString()} (${t('more.app.todo.done')})`
          : `${new Date(Number(item.id)).toLocaleString()} ${t('more.app.todo.undone')}`,
      });
    });
    return items;
  }, [appData]);

  const exportTodo = async () => {
    if (appData.length !== 0) {
      setShowExport(true);
    } else {
      messageApi.info(t('more.app.todo.unexport'));
    }
  };

  return (
    <>
      <Card style={{ width: '100%' }}>
        <div className={styles.todo_list_wrapper}>
          <List
            pagination={{
              position: 'bottom',
              align: 'end',
              pageSize: 5,
              size: 'small',
              simple: { readOnly: true },
            }}
            bordered={false}
            split={false}
            locale={{
              emptyText: (
                <p
                  style={{
                    color: '#8c8c8c',
                  }}
                >
                  {t('more.app.todo.empty')}
                </p>
              ),
            }}
            // dataSource={todos}
            dataSource={appData}
            renderItem={(item, index) => (
              <List.Item>
                <div className={styles.todo_item}>
                  <Checkbox
                    onChange={() => toggleTodo(item.id)}
                    checked={Boolean(item.done)}
                    disabled={disabled}
                  ></Checkbox>
                  <div style={{ marginLeft: '8px', flex: 1 }}>
                    {editingId === item.id ? (
                      <Input
                        value={editingValue}
                        size="small"
                        autoFocus
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveEdit}
                        onPressEnter={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => startEditing(item)}
                        style={{
                          textDecoration: item.done ? 'line-through' : 'none',
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                      >
                        {item.title}
                      </div>
                    )}
                  </div>
                  <Button
                    disabled={disabled}
                    type="text"
                    onClick={async () => {
                      await setAppData(appData.filter((todo) => todo.id !== item.id));
                      messageApi.success(t('more.app.todo.delete'));
                    }}
                  >
                    <SvgResource
                      type="close"
                      svgSize={12}
                      color={disabled ? '#666' : '#8c8c8c'}
                    ></SvgResource>
                  </Button>
                </div>
              </List.Item>
            )}
          ></List>
        </div>

        <div className={styles.todo_add_wrapper}>
          <Button style={{ padding: 0 }} type="text" onClick={addTodo} disabled={disabled}>
            <SvgResource type="add" svgSize={16} color={disabled ? '#666' : '#fff'}></SvgResource>
          </Button>
          <Input
            disabled={disabled}
            placeholder={t('more.app.todo.add')}
            width={'100%'}
            value={newTodo}
            style={{ borderColor: disabled ? '#666' : '#22CCEE' }}
            onChange={(e) => {
              setNewTodo(e.target.value);
            }}
            onPressEnter={addTodo}
          ></Input>
          <Button style={{ padding: 0 }} type="text" onClick={exportTodo} disabled={disabled}>
            <DeliveredProcedureOutlined
              disabled={disabled}
              style={{ color: disabled ? '#666' : '#fff', fontSize: 16 }}
            />
          </Button>
        </div>
      </Card>
      <Modal
        width={600}
        open={showExport}
        title={localParticipant.name || localParticipant.identity}
        cancelText={t('common.cancel')}
        okText={t('common.close')}
        onCancel={() => {
          setShowExport(false);
        }}
        onOk={() => {
          setShowExport(false);
        }}
      >
        <ExportTodoHistroy items={historyItems} appData={appData}></ExportTodoHistroy>
      </Modal>
    </>
  );
}

export function ExportTodoHistroy({
  items,
  appData,
}: {
  items: DescriptionsProps['items'];
  appData: TodoItem[];
}) {
  let { percent, start, end } = useMemo(() => {
    let start = Number(appData[0].id);
    let end = appData[appData.length - 1].done ?? Date.now();

    // 计算已完成任务数
    let completedCount = appData.filter((item) => item.done).length;

    // 计算完成百分比
    let percent = Math.round((completedCount / appData.length) * 100);

    return {
      start,
      end,
      percent,
    };
  }, [appData]);

  return (
    <>
      <Descriptions
        bordered
        items={items}
        column={1}
        styles={{
          label: {
            color: '#8c8c8c',
            fontWeight: 700,
            backgroundColor: '#181818',
          },
          content: {
            backgroundColor: '#1E1E1E',
            color: '#8c8c8c',
          },
        }}
      />
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'inline-flex', justifyContent: 'space-between', width: '100%' }}>
          <span>Start: {new Date(start).toLocaleString()}</span>
          <span>End: {new Date(end).toLocaleString()}</span>
        </div>
        <Progress percent={percent} strokeColor={'#22CCEE'} />
      </div>
    </>
  );
}
