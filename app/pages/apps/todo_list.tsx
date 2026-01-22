import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  DescriptionsProps,
  Divider,
  Input,
  List,
  Modal,
  Progress,
} from 'antd';
import { useMemo, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { MessageInstance } from 'antd/es/message/interface';
import { AppAuth, sortTodos, SpaceTodo, todayTimeStamp, TodoItem } from '@/lib/std/space';
import { useLocalParticipant } from '@livekit/components-react';
import { CardSize } from 'antd/es/card/Card';
import dayjs, { extend } from 'dayjs';
import { api } from '@/lib/api';
import { WsBase } from '@/lib/std/device';
import { socket } from '@/app/[spaceName]/PageClientImpl';

export interface AppTodoProps {
  space: string;
  participantId: string;
  isAuth: boolean;
  messageApi: MessageInstance;
  appData: SpaceTodo[];
  setAppData: (data: SpaceTodo) => Promise<void>;
  auth: AppAuth;
  showExport: boolean;
  setShowExport: (show: boolean) => void;
  size?: CardSize;
  bodyStyle?: React.CSSProperties;
}

export const inToday = (timestamp: number): boolean => {
  const todayStart = todayTimeStamp();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  return timestamp >= todayStart && timestamp < tomorrowStart;
};

interface TodoNode extends TodoItem {
  from: number;
}

export function AppTodo({
  space,
  participantId,
  isAuth,
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
  const [historyPageSize, setHistoryPageSize] = useState<number>(6);
  const [newTodo, setNewTodo] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const { localParticipant } = useLocalParticipant();
  // 添加输入法组合状态跟踪
  const [isComposing, setIsComposing] = useState(false);
  const { todoList, todoListChecked } = useMemo(() => {
    // console.warn("Rendering todoTree with todos:", todos);
    const expandList: TodoNode[] = [];
    const checkedList: TodoNode[] = [];
    appData.forEach((todoGroup) => {
      todoGroup.items.forEach((todo) => {
        const todoNode: TodoNode = {
          ...todo,
          from: todoGroup.date,
        };

        expandList.push(todoNode);

        if (todo.done && inToday(todo.done)) {
          checkedList.push(todoNode);
        }
      });
    });
    // 需要按照日期进行排序
    return {
      todoList: expandList.sort((a, b) => {
        const dateA = new Date(Number(a.id)).getTime();
        const dateB = new Date(Number(b.id)).getTime();
        return dateB - dateA; // 降序排列
      }),
      // 只返回今天完成的任务
      todoListChecked: checkedList,
    };
  }, [appData]);

  // const toggleTodo = async (item: TodoItem) => {
  //   let data = {
  //     ...sItem,
  //     items: sItem.items.map((item) => {
  //       if (item.id === id) {
  //         if (!item.done) {
  //           return { ...item, done: Date.now() };
  //         } else {
  //           return { ...item, done: undefined };
  //         }
  //       }
  //       return item;
  //     }),
  //   };
  //   await setAppData(data);
  // };

  const toggleTodo = async (v: boolean, item: TodoNode) => {
    if (v) {
      item.done = new Date().getTime();
    } else {
      // 去除done字段
      delete item.done;
    }

    const updatedTodo = appData.find((st) => st.date === item.from);
    if (updatedTodo) {
      // 如果有找到对应的SpaceTodo，更新其中的items
      updatedTodo.items = updatedTodo.items.map((todo) => {
        if (todo.id === item.id) {
          return item;
        }
        return todo;
      });

      await setAppData(updatedTodo);
    } else {
      messageApi.error(t('more.app.upload.error'));
    }
  };

  const startEditing = (item: TodoItem) => {
    if (!disabled) {
      setEditingId(item.id);
      setEditingValue(item.title);
    }
  };

  const saveEdit = async (item: TodoNode) => {
    if (editingId && editingValue.trim() !== '') {
      const upadtedTodo = appData.find((st) => st.date === item.from);
      if (!upadtedTodo) {
        messageApi.error(t('more.app.upload.error'));
        return;
      }
      upadtedTodo.items = upadtedTodo.items.map((todo) => {
        return todo.id === editingId ? { ...todo, title: editingValue.trim() } : todo;
      });

      await setAppData(upadtedTodo);
    }
    setEditingId(null);
    setEditingValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };
  const addTodo = async () => {
    if (isComposing) return; // 如果正在进行输入法组合，忽略回车事件

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

    // let data = [...appData, newTodoItem];
    const targetTodo = appData.find((item) => item.date === todayTimeStamp()) || {
      date: todayTimeStamp(),
      items: [],
    };
    targetTodo.items.push(newTodoItem);
    await setAppData(targetTodo);
    setNewTodo('');
  };

  const historyItems: DescriptionsProps['items'] = useMemo(() => {
    if (appData.length === 0) {
      return [];
    }
    let items: DescriptionsProps['items'] = [];
    appData.forEach((todo) => {
      todo.items.forEach((item) => {
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
    });
    return items;
  }, [appData]);
  /**
   * 删除待办事项
   */
  const deleteTodo = async (item: TodoNode) => {
    const updatedTodo = appData.find((st) => st.date === item.from);
    if (!updatedTodo) {
      messageApi.error(t('more.app.upload.error'));
      return;
    }

    // 从对应的SpaceTodo中删除该待办事项
    // await setAppData({
    //   ...updatedTodo,
    //   items: updatedTodo.items.filter((todo) => todo.id !== item.id),
    // } as SpaceTodo, true);

    const response = await api.deleteTodo(
      space,
      participantId,
      {
        ...updatedTodo,
        items: updatedTodo.items.filter((todo) => todo.id !== item.id),
      } as SpaceTodo,
      item.id,
      isAuth,
    );

    if (response.ok) {
      socket.emit('update_user_status', {
        space,
      } as WsBase);
      messageApi.success(t('more.app.todo.delete'));
    } else {
      messageApi.error(t('more.app.upload.error'));
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
      <Card
        style={{ width: '100%', padding: 0 }}
        size={size}
        styles={{
          body: {
            padding: size == 'small' ? 4 : 12,
            height: 'fit-content',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'space-between',
            justifyContent: 'center',
            alignContent: 'space-between',
            ...bodyStyle,
          },
        }}
      >
        <div className={styles.todo_list_wrapper}>
          <Divider style={{ fontSize: 12, margin: '0 0 8px 0' }}>
            {t('more.app.todo.today_done')}
          </Divider>
          <List
            pagination={
              todoListChecked.length > 6
                ? {
                    position: 'bottom',
                    align: 'end',
                    pageSize: 6,
                    size: 'small',
                    showSizeChanger: false,
                    simple: { readOnly: true },
                  }
                : undefined
            }
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
                  {t('more.app.todo.today_empty')}
                </p>
              ),
            }}
            dataSource={todoListChecked}
            renderItem={(item) => (
              <List.Item style={{ border: 'none' }}>
                <div className={styles.todo_item}>
                  <Checkbox checked disabled>
                    {item.title}
                  </Checkbox>
                </div>
              </List.Item>
            )}
          ></List>
          <Divider style={{ fontSize: 12, margin: '8px 0' }}>{t('more.app.todo.history')}</Divider>
          <List
            className={styles.todo_history_list}
            pagination={
              appData.length > 0
                ? {
                    position: 'bottom',
                    align: 'end',
                    pageSize: historyPageSize,
                    size: 'small',
                    pageSizeOptions: ['6', '10', '15'],
                    onShowSizeChange: (_current, size) => {
                      setHistoryPageSize(size);
                    },
                    simple: { readOnly: true },
                  }
                : undefined
            }
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
            dataSource={todoList}
            renderItem={(item) => (
              <List.Item
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  border: 'none',
                }}
              >
                <div
                  className={styles.todo_item}
                  style={{
                    fontSize: size === 'small' ? 12 : 14,
                    // height: size === 'small' ? 28 : 32,
                  }}
                >
                  <Checkbox
                    onChange={async (e) => await toggleTodo(e.target.checked, item)}
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
                        onBlur={() => saveEdit(item)}
                        onPressEnter={() => saveEdit(item)}
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
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
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
  appData: SpaceTodo[];
}) {
  let { percent, start, end } = useMemo(() => {
    // 根据appData，排在最后的是start时间，最新的是end时间
    let startItem = appData[appData.length - 1].items;
    let start = Number(startItem[startItem.length - 1].id);
    let endItem = appData[0].items;
    let end = Number(endItem[0].id);
    // 计算已完成任务数
    let completedCount = appData.flatMap((todo) => todo.items).filter((item) => item.done).length;
    let allCount = appData.flatMap((todo) => todo.items).length;
    // 计算完成百分比
    let percent = Math.round((completedCount / allCount) * 100);

    return {
      start,
      end,
      percent,
    };
  }, [appData]);

  return (
    <>
      <div className={styles.todo_export}>
        <Descriptions
          bordered
          items={items}
          column={1}
          styles={{
            label: {
              color: '#8c8c8c',
              fontWeight: 700,
              backgroundColor: '#f67f22',
            },
            content: {
              backgroundColor: '#F59346',
              color: '#8c8c8c',
            },
          }}
        />
      </div>
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
