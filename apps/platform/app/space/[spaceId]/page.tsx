"use client";
import { message } from "antd";
import SpaceAbout from "./about";

export default function Page({ params }: { params: { spaceId: string } }) {
  console.warn("space about page render", params.spaceId);
  const [messageApi, contextHolder] = message.useMessage();
  return <div>
    {contextHolder}
    <SpaceAbout spaceId={params.spaceId} messageApi={messageApi}></SpaceAbout>
  </div>;
}
