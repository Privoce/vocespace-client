"use client";

import React from "react";
import { GetProps, Input } from "antd";
import styles from "@/styles/home_search.module.scss";

type SearchProps = GetProps<typeof Input.Search>;

const { Search } = Input;

export function HomeSearch() {
  const onSearch: SearchProps["onSearch"] = (value, _e, info) =>
    console.log(info?.source, value);

  return (
    <div className={styles.home_search}>
      <div className={styles.description}>发现 Vocespace 空间</div>
      <Search
        size="large"
        placeholder="input search text"
        onSearch={onSearch}
        style={{ width: "60%", maxWidth: "1080px" }}
        enterButton
        allowClear
      />
    </div>
  );
}
