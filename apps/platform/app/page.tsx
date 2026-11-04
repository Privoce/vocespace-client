"use client";
import { HomeHeader } from "./home/header";
import { DisplaySpaces } from "./home/main";
import styles from "@/styles/home.module.scss";
import { HomeSearch } from "./home/search";
import { HomeFooter } from "./home/footer";
import { message } from "antd";

export default function Home() {
  const [messageApi, contextHolder] = message.useMessage();
  return (
    <main className={styles.main}>
      {contextHolder}
      <HomeHeader messageApi={messageApi} />
      <HomeSearch />
      <DisplaySpaces />
      <HomeFooter />
    </main>
  );
}
