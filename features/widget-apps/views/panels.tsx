'use client';

import { AppCountdown } from '@/app/pages/apps/countdown';
import { AppTimer } from '@/app/pages/apps/timer';
import { AppTodo } from '@/app/pages/apps/todo_list';
import { TodoTogether } from '@/app/pages/apps/todo_together';
import { DEFAULT_COLLAPSE_HEADER_STYLES } from '@/app/pages/controls/collapse_tools';
import { CopyButton } from '@/app/pages/controls/widgets/copy';
import { CountdownProp, TimerProp, TodoProp } from '@/features/widget-apps/shared';
import { getParticipantPlatformInfo } from '@/lib/hooks/platform';
import {
  AppKey
} from '@/lib/std/space';
import styles from '@/styles/apps.module.scss';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { CollapseProps, Tooltip } from 'antd';
import type { useWidgetApps } from '../hooks/useWidgetApps';
export type FlotAppItemModel = ReturnType<typeof useWidgetApps>;
export function getWidgetPanels(model: FlotAppItemModel) {
  const {
    messageApi,
    space,
    spaceInfo,
    isSelf,
    participantId,
    t,
    showExport,
    setShowExport,
    itemStyle,
    appData,
    updateAppSync,
    exportTodo,
    getTodoText,
  } = model;
  const showSyncIcon = (isSelf: boolean, key: AppKey) => {
    if (!isSelf) {
      return <span></span>;
    }

    // 安全检查：确保参与者和 sync 属性存在
    const participant = spaceInfo.participants[participantId];
    if (!participant || !participant.sync) {
      return <span></span>;
    }

    return (
      <>
        {participant.sync.includes(key) ? (
          <Tooltip title={t('more.app.settings.sync.desc_priv')}>
            <EyeOutlined
              onClick={(e) => {
                e.stopPropagation();
                updateAppSync(key);
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip title={t('more.app.settings.sync.desc_pub')}>
            <EyeInvisibleOutlined
              onClick={(e) => {
                e.stopPropagation();
                updateAppSync(key);
              }}
            />
          </Tooltip>
        )}
      </>
    );
  };
  const createItems = (
    participantId: string,
    timer?: TimerProp,
    countdown?: CountdownProp,
    todo?: TodoProp,
    isSelf = false,
  ): CollapseProps['items'] => {
    let items: CollapseProps['items'] = [];

    if (todo) {
      items.push({
        key: 'todo',
        label: (
          <div className={styles.flot_header}>
            {t('more.app.todo.title')}
            <div className={styles.flot_header_icons}>
              {showSyncIcon(isSelf, 'todo')}
              {isSelf && (
                <>
                  <Tooltip title={t('more.app.todo.complete')}>
                    <ProfileOutlined
                      onClick={(e) => {
                        e.stopPropagation();
                        exportTodo(todo.data.length);
                      }}
                    />
                  </Tooltip>
                  {/* <Tooltip title={t('more.ai.cut')}>
                      <RobotOutlined
                        disabled={!spaceInfo.participants[participantId]?.ai.cut}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAICutAnalysis(!showAICutAnalysis);
                        }}
                      />
                    </Tooltip> */}

                  <CopyButton text={getTodoText(todo)} messageApi={messageApi}></CopyButton>
                </>
              )}
            </div>
          </div>
        ),
        children: (
          <AppTodo
            space={space}
            participantId={participantId}
            isAuth={
              getParticipantPlatformInfo({ user: spaceInfo.participants[participantId] }).isAuth
            }
            messageApi={messageApi}
            appData={todo.data}
            setAppData={todo.setData}
            auth={todo.auth}
            showExport={showExport}
            setShowExport={setShowExport}
          />
        ),
        style: itemStyle,
        styles: DEFAULT_COLLAPSE_HEADER_STYLES,
      });
    }

    if (isSelf) {
      items.push({
        key: 'together',
        label: (
          <div className={styles.flot_header}>
            {/* {showSyncIcon(isRemote, 'timer')} */}
            {t('more.app.todo.together.title')}
          </div>
        ),
        children: (
          <TodoTogether
            spaceInfo={spaceInfo}
            messageApi={messageApi}
            space={space}
          ></TodoTogether>
        ),
        style: itemStyle,
        styles: DEFAULT_COLLAPSE_HEADER_STYLES,
      });
    }

    if (timer) {
      items.push({
        key: 'timer',
        label: (
          <div className={styles.flot_header}>
            {t('more.app.timer.title')}
            {showSyncIcon(isSelf, 'timer')}
          </div>
        ),
        children: (
          <AppTimer
            size="small"
            appData={timer.data}
            setAppData={timer.setData}
            auth={timer.auth}
          ></AppTimer>
        ),
        style: itemStyle,
        styles: DEFAULT_COLLAPSE_HEADER_STYLES,
      });
    }

    if (countdown) {
      items.push({
        key: 'countdown',
        label: (
          <div className={styles.flot_header}>
            {t('more.app.countdown.title')}
            {showSyncIcon(isSelf, 'countdown')}
          </div>
        ),
        children: (
          <AppCountdown
            messageApi={messageApi}
            size="small"
            appData={countdown.data}
            setAppData={countdown.setData}
            auth={countdown.auth}
          />
        ),
        style: itemStyle,
        styles: DEFAULT_COLLAPSE_HEADER_STYLES,
      });
    }

    return items;
  };
  return createItems(participantId, model.widgetData.timer, model.widgetData.countdown, model.widgetData.todo, isSelf);
}
