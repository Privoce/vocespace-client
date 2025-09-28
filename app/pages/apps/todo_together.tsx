import { SpaceInfo, TodoItem } from '@/lib/std/space';
import { useI18n } from '@/lib/i18n/i18n';
import { Collapse, Progress, Empty, Card, List } from 'antd';
import { AppTodo } from './todo_list';
import { MessageInstance } from 'antd/es/message/interface';
import { useMemo } from 'react';
import styles from '@/styles/apps.module.scss';

export interface TodoTogetherProps {
  spaceInfo: SpaceInfo;
  messageApi: MessageInstance;
}

interface ParticipantTodoSummary {
  participantId: string;
  name: string;
  todoData: TodoItem[] | undefined;
  completedCount: number;
  totalCount: number;
  firstTodoTitle?: string;
}

export function TodoTogether({ spaceInfo, messageApi }: TodoTogetherProps) {
  const { t } = useI18n();

  // 处理参与者的todo数据
  const participantSummaries: ParticipantTodoSummary[] = useMemo(() => {
    return (
      Object.entries(spaceInfo.participants)
        // .filter(([_, participant]) => {
        //   const todoItems = participant.appDatas?.todo?.items;
        //   return todoItems && todoItems.length > 0;
        // })
        .map(([participantId, participant]) => {
          const todoData = participant.appDatas?.todo?.items || [];
          const visibleTodos = todoData.filter((item) => item.visible !== false);
          const completedCount = todoData.filter((item) => item.done).length;
          const firstTodo = visibleTodos[0];

          return {
            participantId,
            name: participant.name,
            todoData: visibleTodos,
            completedCount,
            totalCount: todoData.length,
            firstTodoTitle: firstTodo?.title,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    ); // 按名字排序
  }, [spaceInfo.participants]);

  // 生成每个参与者的Collapse项目
  const createCollapseItemsForParticipant = (summary: ParticipantTodoSummary) => {
    const progressPercent =
      summary.totalCount > 0 ? Math.round((summary.completedCount / summary.totalCount) * 100) : 0;

    return [
      {
        key: summary.participantId,
        label: (
          <div className={styles.todo_together_header}>
            <div className={styles.todo_together_user_info}>
              {/* <UserOutlined style={{ marginRight: 8, color: '#22CCEE' }} /> */}
              <span style={{ fontWeight: 'bold', color: '#fff' }}>{summary.name}</span>
            </div>
            <div className={styles.todo_together_summary}>
              <div
                style={{
                  color: '#8c8c8c',
                  fontSize: '12px',
                  marginRight: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                {summary.firstTodoTitle || t('more.app.todo.together.empty')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Progress
                  percent={progressPercent}
                  size="small"
                  strokeColor="#22CCEE"
                  trailColor="#333"
                  showInfo={false}
                  style={{ width: '100%', marginRight: '8px' }}
                />
                <span
                  style={{
                    color: '#22CCEE',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {summary.completedCount}/{summary.totalCount}
                </span>
              </div>
            </div>
          </div>
        ),
        children: (
          <div style={{ marginTop: 0 }}>
            {summary?.todoData && summary.todoData.length > 0 && (
              <AppTodo
                size="small"
                bodyStyle={{
                  padding: '0 18px 0 0',
                }}
                messageApi={messageApi}
                appData={summary.todoData}
                setAppData={async () => {}} // 只读模式，不允许修改
                auth="read" // 设置为只读权限
                showExport={false}
                setShowExport={() => {}}
              />
            )}
          </div>
        ),
      },
    ];
  };

  if (participantSummaries.length === 0) {
    return (
      <Card style={{ width: '100%' }}>
        <Empty
          description={
            <span style={{ color: '#8c8c8c' }}>{t('more.app.todo.together.empty')}</span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <Card
      style={{ width: '100%' }}
      size="default"
      styles={{ body: { padding: '4px 0px 4px 8px' } }}
    >
      <div className={styles.todo_together_wrapper}>
        <List
          dataSource={participantSummaries}
          pagination={{
            position: 'bottom',
            align: 'end',
            pageSize: 4,
            size: 'small',
            simple: { readOnly: true },
            showSizeChanger: false,
          }}
          renderItem={(summary) => (
            <List.Item style={{ padding: '0 0 4px 0' }}>
              <Collapse
                items={createCollapseItemsForParticipant(summary)}
                ghost
                expandIconPosition="end"
                className={styles.todo_together_collapse}
                style={{ width: '100%' }}
              />
            </List.Item>
          )}
        />
      </div>
    </Card>
  );
}
