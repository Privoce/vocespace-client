import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { Button, Card, Checkbox, Input, List } from 'antd';
import { useMemo, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { MessageInstance } from 'antd/es/message/interface';
import { AppAuth, TodoItem } from '@/lib/std/space';

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
  const toggleTodo = async (id: string) => {
    let data = appData.map((item) => {
      return item.id === id ? { ...item, done: !item.done } : item;
    });

    await setAppData(data);
  };
  const addTodo = async () => {
    if (!newTodo || newTodo.trim() === '') {
      messageApi.error(t('more.app.todo.empty_value'));
      return;
    }

    const newTodoItem: TodoItem = {
      id: Date.now().toString(),
      title: newTodo.trim(),
      done: false,
    };

    let data = [...appData, newTodoItem];
    await setAppData(data);
    setNewTodo('');
  };
  return (
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
                  checked={item.done}
                  disabled={disabled}
                >
                  <span
                    style={{
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}
                  >
                    {item.title}
                  </span>
                </Checkbox>
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
      </div>
    </Card>
  );
}
