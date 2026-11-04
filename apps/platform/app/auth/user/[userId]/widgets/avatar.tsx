"use client";

import { GetProp, Upload, UploadFile, UploadProps } from "antd";
import ImgCrop from "antd-img-crop";
import { dbApi } from "@/lib/api/db";
import { BucketApiErrMsg } from "@/lib/api/error";
import { useI18n } from "@/lib/i18n/i18n";
import { useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { MessageInstance } from "antd/es/message/interface";
import { Nullable } from "@/lib/std";

type FileType = Parameters<GetProp<UploadProps, "beforeUpload">>[0];

interface EditAvatarBtnProps {
  userId: string;
  oldAvatar: Nullable<string>;
  client: SupabaseClient;
  messageApi: MessageInstance;
  afterUpdate: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function EditAvatarBtn({
  userId,
  client,
  messageApi,
  afterUpdate,
  oldAvatar,
  children,
  disabled = false,
}: EditAvatarBtnProps) {
  const { t } = useI18n();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadToSupabase = async (file: File): Promise<string> => {
    try {
      setUploading(true);
      const path = await dbApi.storage.update(client, userId, file);
      if (oldAvatar) {
        await dbApi.storage.removeAvatar(client, oldAvatar);
      }
      return await dbApi.storage.url(client, path);
    } catch (error) {
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const updateUserAvatar = async (avatarUrl: string) => {
    try {
      const success = await dbApi.userInfo.update(client, userId, {
        avatar: avatarUrl,
      });

      if (success) {
        messageApi.success(t("user.setting.avatarUpdateSuccess"));
        afterUpdate && afterUpdate();
      } else {
        throw new Error("Update failed");
      }
    } catch (error) {
      console.error("Update avatar error:", error);
      messageApi.error(t("user.setting.avatarUpdateError"));
    }
  };

  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;

    try {
      const avatarUrl = await uploadToSupabase(file);
      await updateUserAvatar(avatarUrl);
      onSuccess(avatarUrl);
      setFileList([]);
    } catch (error) {
      onError(error);
      if (error === BucketApiErrMsg.FILE_NO_EXT) {
        messageApi.error(error);
      } else {
        messageApi.error(t("user.setting.uploadError"));
      }
    }
  };

  const beforeUpload = (file: File) => {
    const isAllowImg =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/webp" ||
      file.type === "image/svg+xml" ||
      file.type === "image/gif";

    if (!isAllowImg) {
      messageApi.error(t("user.setting.imageFormatError"));
      return false;
    }

    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      messageApi.error(t("user.setting.imageSizeError"));
      return false;
    }

    return true;
  };

  const onChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setFileList(newFileList);
  };

  const onPreview = async (file: UploadFile) => {
    let src = file.url as string;
    if (!src) {
      src = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file.originFileObj as FileType);
        reader.onload = () => resolve(reader.result as string);
      });
    }
    const image = new Image();
    image.src = src;
    const imgWindow = window.open(src);
    imgWindow?.document.write(image.outerHTML);
  };

  return (
    <ImgCrop
      rotationSlider
      modalTitle={t("user.setting.cropAvatar")}
      modalOk={t("common.save")}
      modalCancel={t("common.cancel")}
    >
      <Upload
        customRequest={customUpload}
        fileList={fileList}
        onChange={onChange}
        beforeUpload={beforeUpload}
        multiple={false}
        onPreview={onPreview}
        showUploadList={false}
        accept="image/*"
        disabled={disabled}
      >
        {/* <Button
          icon={<EditOutlined />}
          type="default"
          loading={uploading}
          disabled={uploading}
        >
          {uploading ? t("common.uploading") : t("user.setting.editAvatar")}
        </Button> */}
        {children}
      </Upload>
    </ImgCrop>
  );
}
