// import { SvgResource } from "@/app/resources/svg";
import { useI18n } from "@/lib/i18n/i18n";
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
  Skeleton,
  Tree,
  TreeDataNode,
  TreeProps,
} from "antd";
import { Key, useEffect, useMemo, useState } from "react";
import styles from "@/styles/ai.module.scss";
import { MessageInstance } from "antd/es/message/interface";
// import { AppAuth, TodoItem } from '@/lib/std/space';
// import { useLocalParticipant } from '@livekit/components-react';
import { CardSize } from "antd/es/card/Card";
import { SupabaseClient } from "@supabase/supabase-js";
import { TodoItem, Todos } from "@/lib/std/todo";
import { api } from "@/lib/api";
import { inToday, todayTimestamp } from "@/lib/std";
import { v4 as uuidv4 } from "uuid";
import {
  CloseCircleOutlined,
  CloseOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";

export interface AppTodoProps {
  messageApi: MessageInstance;
  userId: string;
  client: SupabaseClient;
  isSelf?: boolean;
}

interface TodoNode {
  title: string;
  key: string;
  checked: boolean;
  date: string; // 使用字符串存储的时间戳
  origin: TodoItem; // 原始的 TodoItem 对象，以便后续操作
  from: string; // 来自哪个 Todos 的 date 字段
}

export function Todo({
  messageApi,
  userId,
  client,
  isSelf = false,
}: AppTodoProps) {
  const { t } = useI18n();
  const [todos, setTodos] = useState<Todos[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<TodoNode | null>(null);
  const [newTodo, setNewTodo] = useState<string>("");
  const fetchTodos = async () => {
    setLoading(true);
    const response = await api.todos.getTodos(userId);
    if (response.ok) {
      const { todos }: { todos: Todos[] } = await response.json();
      setTodos(todos);
    } else {
      messageApi.error(t("widgets.todo.error.fetch"));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTodos();
  }, [userId]);

  const addTodo = async () => {
    if (!newTodo.trim()) {
      messageApi.warning(t("widgets.todo.warning.empty"));
      return;
    }

    const wrapperTodo = {
      id: userId,
      date: todayTimestamp().toString(),
      items: [
        {
          id: new Date().getTime().toString(),
          title: newTodo,
          visible: true,
        },
      ],
    } as Todos;

    await fetchAddTodo(wrapperTodo, () => {
      setNewTodo("");
      fetchTodos();
    });
  };

  const fetchAddTodo = async (todo: Todos, onSuccess: () => void) => {
    setLoading(true);
    const response = await api.todos.add(todo);
    if (response.ok) {
      onSuccess();
      messageApi.success(t("widgets.todo.success.add"));
    } else {
      messageApi.error(t("widgets.todo.error.add"));
    }
    setLoading(false);
  };

  const toggleTodo = (v: boolean, item: TodoNode) => {
    if (v) {
      // 如果是完成，那么需要构建成一个为origin增加done字段
      item.origin.done = new Date().getTime();
    } else {
      // 去除done字段
      delete item.origin.done;
    }
    // 从todos中找到对应的Todos对象并更新
    const updatedTodo = todos.find((todo) => {
      return todo.date === item.from;
    });
    // 能找到就更新，找不到说明有问题
    if (updatedTodo) {
      updatedTodo.items = updatedTodo.items.map((todo) => {
        if (todo.id === item.origin.id) {
          return item.origin;
        }
        return todo;
      });
      // 提交更新
      fetchAddTodo(updatedTodo, () => {
        fetchTodos();
      });
    } else {
      messageApi.error(t("widgets.todo.error.fetch"));
      return;
    }
  };

  const { todoList, todoListChecked } = useMemo(() => {
    // console.warn("Rendering todoTree with todos:", todos);
    const expandList: TodoNode[] = [];
    const checkedList: TodoNode[] = [];
    todos.forEach((todoGroup) => {
      todoGroup.items.forEach((todo) => {
        const todoNode: TodoNode = {
          title: todo.title,
          key: uuidv4(),
          checked: !!todo.done,
          date: todo.id,
          origin: todo,
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
        const dateA = new Date(Number(a.date)).getTime();
        const dateB = new Date(Number(b.date)).getTime();
        return dateB - dateA; // 降序排列
      }),
      // 只返回今天完成的任务
      todoListChecked: checkedList,
    };
  }, [todos]);

  const startEditing = (item: TodoNode) => {
    if (isSelf) {
      setEditingTarget(item);
    }
  };

  const saveEdit = (item: TodoNode) => {
    // 如果压根没有修改，就不提交
    if (item.origin.title === editingTarget?.title) {
      setEditingTarget(null);
      return;
    }
    // 从todos中找到对应的Todos对象并更新
    const updatedTodo = todos.find((todo) => {
      return todo.date === item.from;
    });

    // 能找到就更新，找不到说明有问题
    if (updatedTodo) {
      updatedTodo.items = updatedTodo.items.map((todo) => {
        if (todo.id === item.origin.id) {
          item.origin.title = editingTarget?.title || item.origin.title;
          return item.origin;
        }
        return todo;
      });

      // 提交更新
      fetchAddTodo(updatedTodo, () => {
        fetchTodos();
      });
    } else {
      messageApi.error(t("widgets.todo.error.fetch"));
      return;
    }
    setEditingTarget(null);
  };

  const cancelEdit = () => {
    setEditingTarget(null);
  };

  const deleteTodo = async (item: TodoNode) => {
    const response = await api.todos.deleteTodo(userId, item.from, item.origin.id);
    if (response.ok) {
      fetchTodos();
      messageApi.success(t("widgets.todo.success.delete"));
    } else {
      messageApi.error(t("widgets.todo.error.delete"));
    }
    setLoading(false);
  };

  return (
    <>
      <Card
        style={{ width: "100%", padding: 0, height: "100%" }}
        styles={{ body: { height: "100%", padding: 0, overflow: "hidden" } }}
        size="default"
      >
        <div className={styles.tree_wrapper}>
          <Divider style={{ fontSize: 12, margin: "12px 0" }}>
            {t("widgets.todo.today_done")}
          </Divider>
          <div className={styles.tree_wrapper_today}>
            {loading ? (
              <div style={{ padding: "16px" }}>
                <Skeleton paragraph={{ rows: 5 }} active />
              </div>
            ) : todoListChecked.length > 0 ? (
              <div className={styles.tree_wrapper_today_content}>
                {todoListChecked.map((item) => (
                  <div key={item.key} className={styles.todo_item}>
                    <Checkbox checked={item.checked} disabled>
                      {item.title}
                    </Checkbox>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#8c8c8c",
                }}
              >
                {t("widgets.todo.empty")}
              </div>
            )}
          </div>
          <Divider style={{ fontSize: 12, margin: "12px 0" }}>
            {t("widgets.todo.history")}
          </Divider>
          <div className={styles.tree_wrapper_list}>
            {loading ? (
              <div style={{ padding: "16px" }}>
                <Skeleton paragraph={{ rows: 10 }} active />
              </div>
            ) : todoList.length > 0 ? (
              <div>
                {todoList.map((item) => (
                  <div key={item.key} className={styles.todo_item}>
                    <Checkbox
                      checked={item.checked}
                      disabled={!isSelf}
                      onChange={(v) => toggleTodo(v.target.checked, item)}
                    ></Checkbox>
                    <div style={{ marginLeft: "8px", flex: 1 }}>
                      {editingTarget?.key === item.key ? (
                        <Input
                          value={editingTarget?.title || ""}
                          styles={{ input: { fontSize: 14 } }}
                          size="small"
                          autoFocus
                          onChange={(e) =>
                            setEditingTarget({
                              ...editingTarget,
                              title: e.target.value,
                            })
                          }
                          onBlur={() => saveEdit(item)}
                          onPressEnter={() => saveEdit(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                        />
                      ) : (
                        <div
                          onClick={() => startEditing(item)}
                          style={{
                            // textDecoration: item.checked ? 'line-through' : 'none',
                            cursor: !isSelf ? "default" : "pointer",
                            color: "#fff",
                          }}
                        >
                          {item.title}
                        </div>
                      )}
                    </div>
                    <CloseOutlined
                      style={{ fontSize: 12 }}
                      onClick={() => deleteTodo(item)}
                    ></CloseOutlined>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#8c8c8c",
                }}
              >
                {t("widgets.todo.empty")}
              </div>
            )}
          </div>
          {isSelf && (
            <div className={styles.tree_wrapper_add}>
              <Input
                className={styles.todo_add_input}
                placeholder={t("widgets.todo.add")}
                width={"100%"}
                value={newTodo}
                onChange={(e) => {
                  setNewTodo(e.target.value);
                }}
                size="large"
                onPressEnter={addTodo}
                suffix={
                  isSelf && (<Button
                    className={styles.todo_add_btn}
                    style={{ padding: 0, height: "fit-content" }}
                    type="text"
                    onClick={addTodo}
                  >
                    <PlusCircleOutlined
                      style={{
                        color: isSelf ? "#fff" : "#8c8c8c",
                      }}
                    ></PlusCircleOutlined>
                  </Button>)
                }
              ></Input>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
