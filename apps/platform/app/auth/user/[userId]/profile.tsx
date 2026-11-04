"use client";

import React, { useState, useMemo, ChangeEvent } from "react";
import {
  Avatar,
  Button,
  Card,
  Tooltip,
  Modal,
  MenuProps,
  List,
  Skeleton,
  Result,
  Input,
  Form,
} from "antd";
import {
  EditOutlined,
  UserOutlined,
  MailOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  GithubOutlined,
  TwitterOutlined,
  LinkedinOutlined,
  TrophyOutlined,
  DeleteOutlined,
  RightOutlined,
  CommentOutlined,
  WechatFilled,
  PlusCircleFilled,
  HistoryOutlined,
  DownOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { SpaceCard } from "@/components/space/card";
import { UserInfo, UserStats } from "@/lib/std/user";
import {
  Space,
  SpaceType,
  vocespaceUrl,
  vocespaceUrlVisit,
} from "@/lib/std/space";
import styles from "@/styles/user_profile.module.scss";
import dayjs from "dayjs";
import { VocespaceLogo } from "@/components/widget/logo";
import { whereUserFrom } from "@/hooks/useUser";
import { EditAvatarBtn } from "./widgets/avatar";
import { useI18n } from "@/lib/i18n/i18n";
import { EasyPubSpaceModal } from "@/app/space/[spaceId]/edit/easy";
import { dbApi } from "@/lib/api/db";
import { useJoinUsBtn } from "./widgets/join";
import { useShareBtn } from "./widgets/share";
import TextArea from "antd/es/input/TextArea";
import { UserPageUniProps } from "./page";
import { useRouter } from "next/navigation";

// Mock用户统计数据
const mockUserStats: UserStats = {
  space_type_preferences: {
    [SpaceType.Tech]: 45,
    [SpaceType.Meeting]: 25,
    [SpaceType.Class]: 20,
    [SpaceType.Hobbies]: 10,
  },
  activity_heatmap: generateMockHeatmapData(),
  monthly_stats: [
    {
      month: "2024-01",
      spaces_created: 1,
      spaces_joined: 5,
      total_duration: 20,
    },
    {
      month: "2024-02",
      spaces_created: 0,
      spaces_joined: 8,
      total_duration: 35,
    },
    {
      month: "2024-03",
      spaces_created: 2,
      spaces_joined: 12,
      total_duration: 45,
    },
  ],
  overview: {
    total_spaces_created: 5,
    total_spaces_subscribed: 23,
    total_participation_hours: 156,
    longest_streak_days: 15,
    current_streak_days: 7,
    most_active_space_type: SpaceType.Tech,
    average_session_duration: 45,
  },
};

// 生成模拟热力图数据
function generateMockHeatmapData() {
  const data = [];
  const today = dayjs();

  for (let i = 0; i < 365; i++) {
    const date = today.subtract(i, "day");
    const count = Math.floor(Math.random() * 5); // 0-4的随机数
    const duration = count * (20 + Math.floor(Math.random() * 40)); // 20-60分钟

    data.push({
      date: date.format("YYYY-MM-DD"),
      count,
      duration,
    });
  }

  return data.reverse();
}

interface UserProfileProps extends UserPageUniProps {}

type TabKey = "publishs" | "subscribes" | "ai";

export function UserProfile({
  userId,
  messageApi,
  client,
  flushUser,
  user,
  userInfo,
  avatar,
  isSelf,
  loading,
  updateUserInfo,
  spaces,
}: UserProfileProps) {
  const { t } = useI18n();
  const [openPubSpace, setOpenPubSpace] = useState<TabKey[]>(["publishs"]);
  const [descEditOpen, setDescEditOpen] = useState(false);
  const [usernameEditOpen, setUsernameEditOpen] = useState(false);
  const [usernameForm] = Form.useForm();
  const [linksEditOpen, setLinksEditOpen] = useState<boolean>(false);
  const [linkedin, setLinkedin] = useState(userInfo?.linkedin || "");
  const [github, setGithub] = useState(userInfo?.github || "");
  const [twitter, setTwitter] = useState(userInfo?.twitter || "");
  const [wx, setWx] = useState(userInfo?.wx || "");
  const [website, setWebsite] = useState(userInfo?.website || "");
  const [desc, setDesc] = useState(userInfo?.desc || "");
  const [linkShareModalOpen, setLinkShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const router = useRouter();
  const selfVocespaceUrl = useMemo(() => {
    if (user && userInfo?.username) {
      return vocespaceUrlVisit(userInfo.username);
    } else {
      return "";
    }
  }, [user?.id, userInfo]);

  // 空间类型偏好图表配置
  //   const pieConfig = {
  //     appendPadding: 10,
  //     data: Object.entries(userStats.space_type_preferences).map(
  //       ([type, value]) => ({
  //         type: getSpaceTypeName(type as SpaceType),
  //         value,
  //       })
  //     ),
  //     angleField: "value",
  //     colorField: "type",
  //     radius: 0.8,
  //     label: {
  //       type: "outer",
  //       content: "{name} {percentage}",
  //     },
  //     interactions: [{ type: "element-active" }],
  //     color: ["#1890ff", "#52c41a", "#faad14", "#f5222d"],
  //   };
  const { JoinUsBtn, JoinUsModal, JoinUserBtn } = useJoinUsBtn({
    username: userInfo?.username,
  });
  const { ShareBtn, ShareModal } = useShareBtn({ userInfo });
  const [createSpaceOpen, setCreateSpaceOpen] = useState<boolean>(false);
  const createNewSpace = async (space: Space) => {
    try {
      await dbApi.space.insert(client, space);
      messageApi.success(t("space.pub.success"));
      setCreateSpaceOpen(false);
      await flushUser();
    } catch (error) {
      messageApi.error(t("space.pub.fail"));
    }
  };

  const links = useMemo(() => {
    return [
      {
        label: t("user.profile.selfVocespace"),
        visible: true,
        url:
          isSelf && userInfo
            ? selfVocespaceUrl
            : vocespaceUrlVisit(userInfo?.username || ""),
        icon: <VocespaceLogo height={24} width={24} />,
        key: "vocespace",
        placeholder: t("user.setting.placeholder.vocespace"),
        value:
          isSelf && userInfo
            ? selfVocespaceUrl
            : vocespaceUrlVisit(userInfo?.username || ""),
        onChange: (e: ChangeEvent<HTMLInputElement>) => {},
      },
      {
        label: t("user.setting.email"),
        url: user?.email,
        visible: true,
        icon: <MailOutlined style={{ fontSize: 24 }} />,
        key: "email",
        placeholder: t("user.setting.placeholder.email"),
        value: user?.email || "",
        onChange: (e: ChangeEvent<HTMLInputElement>) => {},
      },
      {
        label: t("user.setting.github"),
        url: userInfo?.github,
        visible: userInfo?.github ? true : false,
        icon: <GithubOutlined style={{ fontSize: 24 }} />,
        key: "github",
        placeholder: t("user.setting.placeholder.github"),
        value: github,
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
          setGithub(e.target.value);
        },
      },
      {
        label: t("user.setting.twitter"),
        visible: userInfo?.twitter ? true : false,
        url: userInfo?.twitter,
        icon: <TwitterOutlined style={{ fontSize: 24 }} />,
        key: "twitter",
        placeholder: t("user.setting.placeholder.twitter"),
        value: twitter,
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
          setTwitter(e.target.value);
        },
      },
      {
        label: t("user.setting.linkedin"),
        url: userInfo?.linkedin,
        visible: userInfo?.linkedin ? true : false,
        icon: <LinkedinOutlined style={{ fontSize: 24 }} />,
        key: "linkedin",
        placeholder: t("user.setting.placeholder.linkedin"),
        value: userInfo?.linkedin || "",
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
          setLinkedin(e.target.value);
        },
      },
      {
        label: t("user.setting.website"),
        url: userInfo?.website,
        visible: userInfo?.website ? true : false,
        icon: <GlobalOutlined style={{ fontSize: 24 }} />,
        key: "website",
        placeholder: t("user.setting.placeholder.website"),
        value: website,
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
          setWebsite(e.target.value);
        },
      },
      {
        label: t("user.setting.wx"),
        url: userInfo?.wx,
        visible: userInfo?.wx ? true : false,
        icon: <WechatFilled style={{ fontSize: 24 }} />,
        key: "wx",
        placeholder: t("user.setting.placeholder.wx"),
        value: wx,
        onChange: (e: ChangeEvent<HTMLInputElement>) => {
          setWx(e.target.value);
        },
      },
      ...(isSelf
        ? [
            {
              label: t("user.setting.editLinks"),
              url: "",
              visible: true,
              icon: <PlusCircleFilled style={{ fontSize: 24 }} />,
              key: "editLinks",
              placeholder: "",
              value: "",
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
                setLinksEditOpen(true);
              },
            },
          ]
        : []),
    ];
  }, [
    userInfo,
    selfVocespaceUrl,
    t,
    user,
    github,
    linkedin,
    twitter,
    wx,
    website,
    isSelf,
  ]);

  const metaInfo = useMemo(() => {
    return [
      // {
      //   icon: <CalendarOutlined className={styles.icon} />,
      //   label: dayjs(user?.created_at).format("YYYY-MM"),
      // },
      ...(userInfo?.location
        ? [
            {
              icon: <EnvironmentOutlined className={styles.icon} />,
              label:
                userInfo.location || t("user.profile.placeholder.location"),
            },
          ]
        : []),
      {
        value: "publishs",
        icon: <CommentOutlined className={styles.icon} />,
        label: `${t("user.profile.publishs")} : ${spaces.length}`,
        open: openPubSpace.includes("publishs"),
        onclick: () =>
          setOpenPubSpace((prev) => {
            if (prev.includes("publishs")) {
              return prev.filter((item) => item !== "publishs");
            }
            return [...prev, "publishs"];
          }),
        collapsed: (
          <List
            dataSource={spaces}
            split={false}
            renderItem={(item) => {
              return (
                <List.Item>
                  <SpaceCard
                    space={item}
                    cardType="edit"
                    style={{ padding: 0, margin: 0 }}
                  ></SpaceCard>
                </List.Item>
              );
            }}
          ></List>
        ),
      },
      {
        value: "subscribes",
        icon: <HistoryOutlined className={styles.icon} />,
        label: `${t("user.profile.subscribes")} : ${
          userInfo?.subscribes?.length || 0
        }`,
        open: openPubSpace.includes("subscribes"),
        onclick: () => {},
      },
      {
        icon: <AppstoreOutlined className={styles.icon} />,
        label: `${t("user.profile.ai")} `,
        open: openPubSpace.includes("ai"),
        onclick: () => {
          router.push(`/ai/${userId}`);
        },
      },
    ];
  }, [userInfo, user, t, openPubSpace, spaces]);

  const handleDesc = () => {
    if (!isSelf) return;
    setDescEditOpen(true);
  };

  const handleUsername = () => {
    if (!isSelf) return;
    setUsernameEditOpen(true);
  };

  // 当打开编辑用户名模态框时填充当前用户名
  React.useEffect(() => {
    if (usernameEditOpen) {
      usernameForm.setFieldsValue({ username: userInfo?.username || "" });
    }
  }, [usernameEditOpen, userInfo, usernameForm]);

  const saveUsername = async () => {
    try {
      const values = await usernameForm.validateFields();
      const newUsername = (values.username || "").trim();
      if (!newUsername) return;

      const updateData: Partial<UserInfo> = { username: newUsername };
      const ok = await updateUserInfo(updateData);
      if (ok) {
        messageApi.success(t("user.setting.saveSuccess"));
        setUsernameEditOpen(false);
        await flushUser();
      } else {
        messageApi.error(t("user.onboarding.usernameExists"));
      }
    } catch (error) {
      // validation errors or update errors
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    }
  };

  const saveLinks = async () => {
    try {
      const updateData: Partial<UserInfo> = {
        linkedin,
        github,
        twitter,
        wx,
        website,
      };
      await updateUserInfo(updateData);
      messageApi.success(t("user.setting.saveSuccess"));
      setLinksEditOpen(false);
    } catch (error) {
      messageApi.error(t("user.setting.saveError"));
    }
  };

  const saveDesc = async () => {
    try {
      const updateData: Partial<UserInfo> = {
        desc,
      };

      await updateUserInfo(updateData);
      messageApi.success(t("user.setting.saveSuccess"));
      setDescEditOpen(false);
    } catch (error) {
      messageApi.error(t("user.setting.saveError"));
    }
  };

  return (
    <div className={styles.userProfile}>
      {loading ? (
        <div className={styles.container}>
          <Card
            className={styles.profileHeader}
            style={{ borderRadius: 16, height: "100%" }}
            styles={{
              body: {
                padding: 16,
                height: "100%",
              },
            }}
          >
            <Skeleton avatar paragraph={{ rows: 4 }} active />
          </Card>
          <Skeleton.Node active style={{ width: "100%" }} />
        </div>
      ) : !userInfo ? (
        <Result
          status="404"
          title="用户未找到"
          subTitle="抱歉，您要查看的用户不存在。"
        />
      ) : (
        <div className={styles.container}>
          {/* 个人资料头部 */}
          <Card
            style={{ borderRadius: 16, height: "100%" }}
            styles={{
              body: {
                padding: 16,
                height: "100%",
              },
            }}
          >
            <div className={styles.profile}>
              <div className={styles.header}>
                <div>{JoinUsBtn}</div>
                <div>{ShareBtn}</div>
              </div>
              <div className={styles.avatarSection}>
                <EditAvatarBtn
                  userId={userId}
                  client={client}
                  messageApi={messageApi}
                  afterUpdate={flushUser}
                  disabled={!isSelf}
                  oldAvatar={avatar}
                >
                  <Avatar
                    size={96}
                    className={styles.avatar}
                    src={avatar}
                    style={{
                      fontSize: 48,
                      backgroundColor: avatar ? "transparent" : "#22CCEE",
                      border: "none",
                      cursor: isSelf ? "pointer" : "default",
                    }}
                  >
                    {userInfo.username.charAt(0).toUpperCase() || (
                      <UserOutlined />
                    )}
                  </Avatar>
                </EditAvatarBtn>
              </div>
              <div className={styles.profileInfo}>
                <div className={styles.username} onClick={handleUsername}>
                  {userInfo.username}
                </div>
                <div
                  className={styles.bio}
                  onClick={handleDesc}
                  style={{ cursor: isSelf ? "pointer" : "default" }}
                >
                  {userInfo?.desc || t("user.profile.placeholder.desc")}
                </div>
                <div className={styles.socialLinks}>
                  {links.map((link, index) =>
                    link.visible ? (
                      <Tooltip title={link.label} key={index}>
                        {["editLinks", "email", "wx"].includes(link.key) ? (
                          <Button
                            type="text"
                            shape="circle"
                            icon={link.icon}
                            onClick={() => {
                              if (link.key === "editLinks") {
                                setLinksEditOpen(true);
                                return;
                              }
                              if (link.key === "email" || link.key === "wx") {
                                setShareUrl(link.url!);
                                setLinkShareModalOpen(true);
                              }
                            }}
                          ></Button>
                        ) : (
                          <Button
                            type="text"
                            shape="circle"
                            icon={link.icon}
                            onClick={() => {
                              console.warn("open link", link.url);
                              window.open(link.url!, "_blank");
                            }}
                          ></Button>
                        )}
                      </Tooltip>
                    ) : (
                      <></>
                    ),
                  )}
                </div>
                <div className={styles.metaInfo}>
                  <List
                    style={{ width: "100%" }}
                    dataSource={metaInfo}
                    split={false}
                    renderItem={(item) => (
                      <List.Item
                        onClick={item.onclick}
                        style={{
                          width: "100%",
                          display: "flex",
                          flexWrap: "wrap",
                        }}
                      >
                        <div className={styles.metaItem}>
                          <div className={styles.metaItem_content}>
                            <div>{item.icon}</div>
                            <div>{item.label}</div>
                          </div>
                          {item.open ? (
                            <DownOutlined></DownOutlined>
                          ) : (
                            <RightOutlined></RightOutlined>
                          )}
                        </div>
                        {item.collapsed && item.open && (
                          <div style={{ width: "100%" }}>{item.collapsed}</div>
                        )}
                      </List.Item>
                    )}
                  ></List>
                </div>
              </div>
              <footer className={styles.profileActions}>
                {isSelf ? (
                  <Button
                    icon={<PlusCircleFilled></PlusCircleFilled>}
                    type="primary"
                    shape="round"
                    size="large"
                    onClick={() => {
                      if (spaces.length >= 2) {
                        messageApi.error(t("space.pub.validation.limit2"));
                        return;
                      } else {
                        setCreateSpaceOpen(true);
                      }
                    }}
                    style={{ boxShadow: "0 4px 8px #136c7d" }}
                  >
                    {t("space.pub.title")}
                  </Button>
                ) : (
                  JoinUserBtn
                )}
              </footer>
            </div>
          </Card>
          {/* <Card className={styles.sectionCard}>
                <div className={styles.sectionCard_inner}>
                  <div className={styles.sectionTitle}>
                    <FireOutlined className={styles.icon} />
                    参与活动热力图
                  </div>

                  <div className={styles.calendarHeader}>
                    <span>过去一年的活动情况</span>
                    <div className={styles.yearNav}>
                      <Button
                        size="small"
                        onClick={() => setSelectedYear(selectedYear - 1)}
                      >
                        {selectedYear - 1}
                      </Button>
                      <Button size="small" type="primary">
                        {selectedYear}
                      </Button>
                    </div>
                  </div>

                  <div className={styles.activityCalendar}>
                    <div className={styles.heatmapGrid}>
                      {userStats.activity_heatmap.map((item, index) => (
                        <Tooltip
                          key={index}
                          title={`${item.date}: ${item.count}次参与, ${item.duration}分钟`}
                        >
                          <div
                            className={`${styles.heatmapCell} ${
                              styles[`level-${getHeatmapLevel(item.count)}`]
                            }`}
                          />
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  <div className={styles.calendarLegend}>
                    <span>较少</span>
                    <div className={styles.legendItem}>
                      <div
                        className={`${styles.heatmapCell} ${styles["level-0"]}`}
                      />
                      <div
                        className={`${styles.heatmapCell} ${styles["level-1"]}`}
                      />
                      <div
                        className={`${styles.heatmapCell} ${styles["level-2"]}`}
                      />
                      <div
                        className={`${styles.heatmapCell} ${styles["level-3"]}`}
                      />
                      <div
                        className={`${styles.heatmapCell} ${styles["level-4"]}`}
                      />
                    </div>
                    <span>较多</span>
                  </div>
                </div>
              </Card> */}
        </div>
      )}
      {JoinUsModal}
      {ShareModal}
      <Modal
        open={descEditOpen}
        onCancel={() => setDescEditOpen(false)}
        title={t("user.setting.desc")}
        okText={t("user.setting.save")}
        cancelText={t("user.setting.cancel")}
        onOk={saveDesc}
      >
        <TextArea
          placeholder={t("user.setting.placeholder.desc")}
          showCount
          maxLength={60}
          rows={4}
          value={desc}
          onChange={(e) => {
            setDesc(e.target.value);
          }}
          style={{ resize: "none", marginBottom: 16 }}
        />
      </Modal>
      <Modal
        open={usernameEditOpen}
        onCancel={() => setUsernameEditOpen(false)}
        title={t("user.setting.username")}
        footer={null}
      >
        <Form form={usernameForm}>
          <Form.Item
            name="username"
            label={t("user.onboarding.profile.username")}
            rules={[
              {
                required: true,
                message: t("user.onboarding.usernameRequired"),
              },
              { min: 2, message: t("user.onboarding.usernameLength") },
              { max: 30, message: t("user.onboarding.usernameLength") },
              {
                // 允许空格，方便包含多个单词的姓名
                pattern: /^[a-zA-Z0-9\u4e00-\u9fa5 _-]+$/,
                message: t("user.onboarding.usernamePattern"),
              },
            ]}
          >
            <Input
              size="large"
              placeholder={t("user.onboarding.profile.usernamePlaceholder")}
              maxLength={30}
            />
          </Form.Item>
          <Button type="primary" onClick={saveUsername}>
            {t("user.setting.username_change_btn")}
          </Button>
        </Form>
      </Modal>
      <Modal
        open={linksEditOpen}
        onCancel={() => setLinksEditOpen(false)}
        title={t("user.setting.links")}
        okText={t("user.setting.save")}
        cancelText={t("user.setting.cancel")}
        onOk={saveLinks}
      >
        <div>
          {links.map((link, index) => {
            if (
              link.key === "vocespace" ||
              link.key === "email" ||
              link.key === "editLinks"
            ) {
              return null;
            }
            return (
              <Input
                style={{
                  margin: "8px 0",
                }}
                key={index}
                placeholder={link.placeholder}
                prefix={link.icon}
                size="large"
                value={link.value}
                onChange={link.onChange}
              />
            );
          })}
        </div>
      </Modal>
      {userInfo && (
        <Modal
          title={t("share.copy")}
          open={linkShareModalOpen}
          onCancel={() => setLinkShareModalOpen(false)}
          footer={null}
          width={480}
        >
          <div className={styles.share}>
            <Avatar
              size={88}
              // className={styles.avatar}
              src={userInfo?.avatar}
              style={{
                fontSize: 52,
                backgroundColor: userInfo?.avatar ? "transparent" : "#22CCEE",
                border: "none",
              }}
            >
              {userInfo.username.charAt(0).toUpperCase() || <UserOutlined />}
            </Avatar>
            <div className={styles.share_username}>{userInfo.username}</div>
            <div className={styles.share_url}>{shareUrl}</div>
          </div>
          <Button
            size="large"
            type="primary"
            block
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
            }}
          >
            {t("share.copy")}
          </Button>
        </Modal>
      )}
      <EasyPubSpaceModal
        ownerId={userId}
        open={createSpaceOpen}
        setOpen={setCreateSpaceOpen}
        messageApi={messageApi}
        onSave={createNewSpace}
      ></EasyPubSpaceModal>
    </div>
  );
}
