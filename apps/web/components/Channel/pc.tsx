import styles from '@/styles/channel.module.scss';
import {
  CommentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Button, Collapse, CollapseProps, Tag, Tooltip } from 'antd';
import type { ChannelModel } from './content';
export function ChannelPC({
  model,
  mainItems,
}: {
  model: ChannelModel;
  mainItems: CollapseProps['items'];
}) {
  const {
    space,
    isActive,
    t,
    collapsed,
    token,
    setFeedbackOpen,
    mainActiveKey,
    allParticipants,
    toggleCollapse,
    createOwnSpace,
  } = model;

  if (collapsed) {
    return (
      <div
        className={`${styles.container} ${styles.collapsed}`}
        style={{
          width: isActive ? 'fit-content' : '0px',
        }}
      >
        <Button
          type="text"
          onClick={toggleCollapse}
          icon={<MenuUnfoldOutlined />}
          style={{
            backgroundColor: '#1a1a1a',
            height: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            paddingTop: 20,
          }}
        ></Button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.roomInfo}>
              {/* <SvgResource.Hash className={styles.roomIcon} /> */}
              <span className={styles.roomName}>{space.name}</span>
              <Tooltip title={t('common.create_own_space')} placement="right">
                <Button
                  size="small"
                  type="text"
                  icon={<PlusCircleOutlined></PlusCircleOutlined>}
                  onClick={createOwnSpace}
                ></Button>
              </Tooltip>
            </div>
            <div className={styles.headerActions}>
              <Tag color="#22CCEE" variant="solid">
                {allParticipants.length} {t('channel.menu.active')}
              </Tag>
              <Button
                className={styles.collapseButton}
                onClick={toggleCollapse}
                icon={<MenuFoldOutlined />}
                type="text"
              ></Button>
            </div>
          </div>
        </div>
        <div className={styles.main}>
          {/* Main Room */}
          <div>
            <Collapse
              bordered={false}
              defaultActiveKey={['main', 'sub']}
              activeKey={mainActiveKey}
              expandIcon={() => undefined}
              style={{ background: token.colorBgContainer }}
              items={mainItems}
            />
          </div>
        </div>
        <div className={styles.feedbackItem}>
          <Button
            block
            variant="solid"
            color="default"
            size="large"
            onClick={() => setFeedbackOpen(true)}
            style={{
              borderTop: '1px solid #2a2a2a',
              backgroundColor: 'transparent',
              height: '46px',
              borderRadius: '0',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'flex-start',
              gap: 12,
            }}
          >
            {' '}
            <div className={styles.feedbackItem}>
              <CommentOutlined style={{ fontSize: '16px' }} />
              {t('channel.feedback.title')}
            </div>
            <RightOutlined />
          </Button>
        </div>
      </div>
    </>
  );
}
