import { FlotLayoutProps } from './flot';
import styles from '@/styles/apps.module.scss';
import { Popover } from 'antd';
import {
  AppKey,
  Countdown,
  DEFAULT_COUNTDOWN,
  DEFAULT_TIMER,
  SpaceCountdown,
  SpaceTimer,
  SpaceTodo,
  Timer,
  TodoItem,
} from '@/lib/std/space';
import { AppTimer } from './timer';
import { MessageInstance } from 'antd/es/message/interface';
import { AppCountdown } from './countdown';
import { AppTodo } from './todo_list';
import { useRecoilState } from 'recoil';
import { SingleAppDataState, socket } from '@/app/[spaceName]/PageClientImpl';
import { useLocalParticipant } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { useI18n } from '@/lib/i18n/i18n';
import { useMemo } from 'react';
import { api } from '@/lib/api';
import { WsBase } from '@/lib/std/device';
import { CloseCircleOutlined } from '@ant-design/icons';

export interface SingleFlotLayoutProps extends FlotLayoutProps {
  appKey?: AppKey;
  setOpen: (open: boolean) => void;
}

export function SingleFlotLayout({
  style,
  messageApi,
  openApp,
  setOpen,
  spaceInfo,
  space,
  appKey,
}: SingleFlotLayoutProps) {
  const { localParticipant } = useLocalParticipant();
  return (
    <div style={style}>
      <Popover
        open={openApp}
        placement="leftTop"
        content={
          <SingleFlotAppItem
            appKey={appKey}
            messageApi={messageApi}
            localParticipant={localParticipant}
            space={space}
            setOpen={setOpen}
          ></SingleFlotAppItem>
        }
        styles={{
          body: {
            background: '#1a1a1a90',
            width: '300px',
          },
        }}
      ></Popover>
    </div>
  );
}

export interface SingleFlotAppItemProps {
  appKey?: AppKey;
  messageApi: MessageInstance;
  localParticipant: Participant;
  space: string;
  setOpen: (open: boolean) => void;
}

export function SingleFlotAppItem({
  appKey,
  messageApi,
  localParticipant,
  space,
  setOpen
}: SingleFlotAppItemProps) {
  const [appData, setAppData] = useRecoilState(SingleAppDataState);
  const { t } = useI18n();
  const setTimerAppData = async (data: Timer) => {
    await unifiedSetAppData(
      {
        ...data,
        timestamp: Date.now(),
      } as SpaceTimer,
      () => {
        setAppData({ ...appData, targetApp: data });
      },
    );
  };

  const setCountdownAppData = async (data: Countdown) => {
    await unifiedSetAppData(
      {
        ...data,
        timestamp: Date.now(),
      } as SpaceCountdown,
      () => {
        setAppData({ ...appData, targetApp: data });
      },
    );
  };

  const setTodoAppData = async (data: TodoItem[]) => {
    await unifiedSetAppData(
      {
        items: data,
        timestamp: Date.now(),
      },
      () => {
        setAppData({ ...appData, targetApp: data });
      },
    );
  };

  const unifiedSetAppData = async (
    data: SpaceTimer | SpaceCountdown | SpaceTodo,
    f: () => void,
  ) => {
    if (appData.participantId && appKey) {
      const response = await api.uploadSpaceApp(space, appData.participantId, appKey, data);

      if (response.ok) {
        f();
        socket.emit('update_user_status', {
          space,
        } as WsBase);
        messageApi.success(t('more.app.upload.success'));
      } else {
        messageApi.error(t('more.app.upload.error'));
      }
    }
  };

  const isSelf = useMemo(() => {
    return appData.participantId === localParticipant.identity;
  }, [appData.participantId, localParticipant.identity]);
  return (
    <>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
        <div>{isSelf ? t('more.app.tab.self') : appData.participantName}</div>
        <CloseCircleOutlined onClick={()=> {
          setOpen(false);
        }}></CloseCircleOutlined>
      </div>
      {appKey === 'timer' && (
        <AppTimer
          size="small"
          appData={appData.targetApp as Timer || DEFAULT_TIMER}
          setAppData={setTimerAppData}
          auth={isSelf ? 'write' : appData.auth}
        ></AppTimer>
      )}
      {appKey === 'countdown' && (
        <AppCountdown
          messageApi={messageApi}
          size="small"
          appData={appData.targetApp as Countdown || DEFAULT_COUNTDOWN}
          setAppData={setCountdownAppData}
          auth={isSelf ? 'write' : appData.auth}
        />
      )}
      {appKey === 'todo' && (
        <AppTodo
          messageApi={messageApi}
          appData={appData.targetApp as TodoItem[] || []}
          setAppData={setTodoAppData}
          auth={isSelf ? 'write' : appData.auth}
        />
      )}
    </>
  );
}
