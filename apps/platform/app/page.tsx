"use client";
import { MobileHome } from "@/components/mobile/Home";
import { useLayoutDevice } from "@/hooks/useLayoutDevice";
import { HomeHeader } from "./home/header";
import { DisplaySpaces } from "./home/main";
import styles from "@/styles/home.module.scss";
import { HomeSearch } from "./home/search";
import { HomeFooter } from "./home/footer";
import { message } from "antd";

export default function Home() {
  const phone = useLayoutDevice();
  const [messageApi, contextHolder] = message.useMessage();
  return (
    <>
    <MobileHome active={phone} />
    <main className={styles.main} style={{ display: phone ? "none" : undefined }}>
      {contextHolder}
      <HomeHeader messageApi={messageApi} />
      <HomeSearch />
      <DisplaySpaces />
      <HomeFooter />
    </main>
    </>
  );
}
