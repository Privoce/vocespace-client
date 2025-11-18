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
import { useLocalParticipant } from '@livekit/components-react';
import { CardSize } from 'antd/es/card/Card';

export interface AppTodoProps {
  messageApi: MessageInstance;
  appData: TodoItem[];
  setAppData: (data: TodoItem[]) => Promise<void>;
  auth: AppAuth;
  showExport: boolean;
  setShowExport: (show: boolean) => void;
  size?: CardSize;
  bodyStyle?: React.CSSProperties;
}

export function AppTodo({
  messageApi,
  appData,
  setAppData,
  auth,
  showExport,
  setShowExport,
  size = 'default',
  bodyStyle,
}: AppTodoProps) {
  const { t } = useI18n();
  const disabled = useMemo(() => {
    return auth !== 'write';
  }, [auth]);
  const [newTodo, setNewTodo] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const { localParticipant } = useLocalParticipant();
  const toggleTodo = async (id: string) => {
    let data = appData.map((item) => {
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
      visible: true,
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

  /**
   * 删除待办事项 (需要判断item中的done字段)
   * - done字段有值表示已完成，则是将其中的visible字段设置为false
   * - done字段无值表示未完成，则是直接删除该条目
   */
  const deleteTodo = async (item: TodoItem) => {
    if (!item.done) {
      await setAppData(appData.filter((todo) => todo.id !== item.id));
      messageApi.success(t('more.app.todo.delete'));
    } else {
      const data = appData.map((todo) => {
        return todo.id === item.id ? { ...todo, visible: false } : todo;
      });
      await setAppData(data);
      messageApi.success(t('more.app.todo.delete'));
    }
  };

  const convertToBtnSize = (size: CardSize): 'small' | 'middle' | 'large' => {
    switch (size) {
      case 'small':
        return 'small';
      case 'default':
      default:
        return 'middle';
    }
  };

  return (
    <>
      <Card style={{ width: '100%', padding: 0 }} size={size} styles={{ body: { padding: size == "small" ? 4 : 12, ...bodyStyle } }}>
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
                    fontSize: size === 'small' ? 12 : 14,
                  }}
                >
                  {t('more.app.todo.empty')}
                </p>
              ),
            }}
            // dataSource={todos}
            dataSource={appData.map((item) => item).filter((item) => item.visible)}
            renderItem={(item, index) => (
              <List.Item style={{ border: 'none' }}>
                <div
                  className={styles.todo_item}
                  style={{
                    fontSize: size === 'small' ? 12 : 14,
                    height: size === 'small' ? 28 : 32,
                  }}
                >
                  <Checkbox
                    onChange={() => toggleTodo(item.id)}
                    checked={Boolean(item.done)}
                    disabled={disabled}
                  ></Checkbox>
                  <div style={{ marginLeft: '8px', flex: 1 }}>
                    {editingId === item.id ? (
                      <Input
                        value={editingValue}
                        styles={{ input: { fontSize: size === 'small' ? 12 : 14 } }}
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
                          color: '#fff',
                        }}
                      >
                        {item.title}
                      </div>
                    )}
                  </div>
                  <Button
                    disabled={disabled}
                    type="text"
                    onClick={() => deleteTodo(item)}
                    size={convertToBtnSize(size)}
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
        {!disabled && (
          <div className={styles.todo_add_wrapper}>
            <Input
              className={styles.todo_add_input}
              placeholder={t('more.app.todo.add')}
              width={'100%'}
              value={newTodo}
              style={{ borderColor: disabled ? '#666' : '#22CCEE' }}
              onChange={(e) => {
                setNewTodo(e.target.value);
              }}
              size="middle"
              onPressEnter={addTodo}
              suffix={
                <Button
                  className={styles.todo_add_btn}
                  style={{ padding: 0, height: 'fit-content' }}
                  type="text"
                  onClick={addTodo}
                  disabled={disabled}
                >
                  <SvgResource
                    type="add"
                    svgSize={16}
                    color={disabled ? '#666' : '#8c8c8c'}
                  ></SvgResource>
                </Button>
              }
            ></Input>
          </div>
        )}
      </Card>
      <Modal
        width={600}
        open={showExport}
        title={localParticipant.name || localParticipant.identity}
        footer={null}
        onCancel={() => setShowExport(false)}
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
            backgroundColor: '#1a1a1a',
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
