import { VocespaceLogo } from "@/components/widget/logo";
import { useI18n } from "@/lib/i18n/i18n";
import { UserAddOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Tooltip } from "antd";
import { useMemo, useState } from "react";
import styles from "@/styles/user_profile.module.scss";
import { useRouter } from "next/navigation";
interface UseJoinUsBtnProps {
  username?: string;
}

export const useJoinUsBtn = ({ username }: UseJoinUsBtnProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  /** 
   * join us button, after click open Join Us Modal
   */
  const JoinUsBtn = useMemo(() => {
    return (
      <Tooltip title={t("user.profile.joinUs.title")} trigger={"hover"}>
        <div onClick={() => setOpen(true)} className={styles.join_us_btn} style={{cursor: 'pointer'}}>
          <VocespaceLogo height={32} width={32}></VocespaceLogo>
        </div>
      </Tooltip>
    );
  }, [t]);

  const JoinUsModal = useMemo(() => {
    return (
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={480}
      >
        <div className={styles.join}>
          <div className={styles.join_content}>
            <h1 className={styles.join_title}>{t("join.title")}</h1>
            <p className={styles.join_subtitle}>{t("join.subTitle")}</p>
            <div style={{ width: "300px" }}>
              <Input
                size="large"
                prefix={"vocespace.com/"}
                placeholder="username"
                style={{ width: 300 }}
              ></Input>
              <Button
               onClick={() => {
                router.push("/auth/login");
               }}
                size="large"
                shape="round"
                type="primary"
                style={{ marginTop: 24, padding: "24px 48px" }}
              >
                {t("join.signUpNow")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }, [open]);

  const JoinUserBtn = useMemo(() => {
    return (
      <Button
        shape="round"
        size="large"
        type="primary"
        onClick={() => setOpen(true)}
        style={{ boxShadow: '0 4px 8px #136c7d' }}
      >
        {`${t("user.profile.joinUs.user")}${username?.substring(0, 16)}`}
      </Button>
    );
  }, [t, username]);

  return {
    JoinUsBtn,
    JoinUsModal,
    JoinUserBtn,
    joinUsModalOpen: open,
    setJoinUsModalOpen: setOpen,
  };
};
