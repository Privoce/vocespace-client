import { SvgResource } from '@/app/resources/svg';
import { useI18n } from '@/lib/i18n/i18n';
import { Button, Card, Checkbox, Input, List, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import styles from '@/styles/apps.module.scss';
import { MessageInstance } from 'antd/es/message/interface';
import { useRecoilState } from 'recoil';
import { AppsDataState } from '@/app/[roomName]/PageClientImpl';
import equal from 'fast-deep-equal';

export interface AppTodoProps {
  messageApi: MessageInstance;
}

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
}

export function AppTodo({ messageApi }: AppTodoProps) {
  const { t } = useI18n();
  const [newTodo, setNewTodo] = useState<string>('');
  // const [todos, setTodos] = useState<TodoItem[]>([]);
  const [appData, setAppData] = useRecoilState(AppsDataState);
  const [todos, setTodos] = useState<TodoItem[]>(appData.todo);

  useEffect(() => {
    if (equal(todos, appData.todo)) return;
    setAppData((prev) => ({
      ...prev,
      todo: todos,
    }));
  }, [todos, appData.todo]);

  const toggleTodo = (id: string) => {
    setTodos((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };
  const addTodo = () => {
    if (!newTodo || newTodo.trim() === '') {
      messageApi.error(t('more.app.todo.empty_value'));
      return;
    }

    const newTodoItem: TodoItem = {
      id: Date.now().toString(),
      title: newTodo.trim(),
      done: false,
    };

    setTodos((prev) => [...prev, newTodoItem]);
    setNewTodo('');
  };
  return (
    <Card style={{ width: '100%' }}>
      <div className={styles.todo_list_wrapper}>
        <List
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
          dataSource={todos}
          renderItem={(item, index) => (
            <List.Item>
              <div className={styles.todo_item}>
                <Checkbox onChange={() => toggleTodo(item.id)} checked={item.done}>
                  <span
                    style={{
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}
                  >
                    {item.title}
                  </span>
                </Checkbox>
                <Button
                  type="text"
                  onClick={() => {
                    setTodos((prev) => prev.filter((todo) => todo.id !== item.id));
                    messageApi.success(t('more.app.todo.delete'));
                  }}
                >
                  <SvgResource type="close" svgSize={12} color="#8c8c8c"></SvgResource>
                </Button>
              </div>
            </List.Item>
          )}
        ></List>
      </div>

      <div className={styles.todo_add_wrapper}>
        <Button style={{ padding: 0 }} type="text" onClick={addTodo}>
          <SvgResource type="add" svgSize={16}></SvgResource>
        </Button>
        <Input
          placeholder={t('more.app.todo.add')}
          width={'100%'}
          value={newTodo}
          onChange={(e) => {
            setNewTodo(e.target.value);
          }}
        ></Input>
      </div>
    </Card>
  );
}
