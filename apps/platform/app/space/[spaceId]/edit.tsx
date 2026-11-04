// "use client";

// import React, { useState, useEffect } from "react";
// import { useSearchParams, useRouter } from "next/navigation";
// import {
//   Form,
//   Input,
//   InputNumber,
//   Select,
//   Button,
//   DatePicker,
//   TimePicker,
//   Upload,
//   Tabs,
//   message,
//   Card,
//   Checkbox,
//   Row,
//   Col,
// } from "antd";
// import {
//   InfoCircleOutlined,
//   CalendarOutlined,
//   DollarOutlined,
//   FileImageOutlined,
//   EditOutlined,
//   DeleteOutlined,
//   PlusOutlined,
//   SaveOutlined,
//   CloseOutlined,
// } from "@ant-design/icons";
// import ReactMarkdown from "react-markdown";
// import { HomeHeader } from "@/app/home/header";
// import { SpaceCard } from "@/components/space/card";
// import {
//   Space,
//   SpaceState,
//   SpaceType,
//   FrequencyInterval,
//   Frequency,
// } from "@/lib/std/space";
// import styles from "./SpaceEdit.module.scss";
// import dayjs from "dayjs";

// const { TextArea } = Input;
// const { Option } = Select;
// const { TabPane } = Tabs;

// interface SpaceEditProps {
//   spaceId?: string;
// }

// // 星期映射
// const weekDays = [
//   { key: 0, label: "周日" },
//   { key: 1, label: "周一" },
//   { key: 2, label: "周二" },
//   { key: 3, label: "周三" },
//   { key: 4, label: "周四" },
//   { key: 5, label: "周五" },
//   { key: 6, label: "周六" },
// ];

// export default function SpaceEdit({ spaceId }: SpaceEditProps) {
//   const [form] = Form.useForm();
//   const searchParams = useSearchParams();
//   const router = useRouter();
//   const [loading, setLoading] = useState(false);
//   const [uploading, setUploading] = useState(false);
//   const [images, setImages] = useState<string[]>([]);
//   const [markdownContent, setMarkdownContent] = useState("");
//   const [activeTab, setActiveTab] = useState("edit");
//   const [selectedDays, setSelectedDays] = useState<number[]>([]);
//   const [previewSpace, setPreviewSpace] = useState<Space | null>(null);

//   const id = spaceId || searchParams?.get("id");
//   const isEdit = !!id;

//   useEffect(() => {
//     if (isEdit) {
//       loadSpaceData();
//     } else {
//       // 新建空间的默认值
//       setInitialValues();
//     }
//   }, [id]);

//   // 监听表单变化，实时更新预览
//   useEffect(() => {
//     const values = form.getFieldsValue();
//     updatePreview(values);
//   }, [images, markdownContent, selectedDays]);

//   const loadSpaceData = async () => {
//     try {
//       setLoading(true);
//       // 模拟API调用 - 实际项目中需要根据ID获取空间数据
//       await new Promise(resolve => setTimeout(resolve, 1000));
      
//       // Mock数据用于演示
//       const mockSpace: Space = {
//         id: id!,
//         name: "技术交流空间",
//         desc: "分享最新的技术趋势和开发经验",
//         created_at: Date.now() / 1000,
//         start_at: Date.now() / 1000 + 3600,
//         end_at: Date.now() / 1000 + 7200,
//         freq: {
//           interval: FrequencyInterval.Weekly,
//           in_week: [1, 3, 5],
//         },
//         fee: 0,
//         owner_id: "user1",
//         owner_name: "张三",
//         state: SpaceState.Waiting,
//         sub_count: 0,
//         online_count: 0,
//         url: "https://example.com/space1",
//         images: [
//           "https://picsum.photos/400/200?random=1",
//           "https://picsum.photos/400/200?random=2",
//         ],
//         ty: SpaceType.Tech,
//         readme: "# 技术交流空间\\n\\n欢迎来到技术交流空间！",
//       };

//       // 设置表单值
//       form.setFieldsValue({
//         name: mockSpace.name,
//         desc: mockSpace.desc,
//         ty: mockSpace.ty,
//         fee: mockSpace.fee,
//         freq_interval: mockSpace.freq.interval,
//         start_time: dayjs(mockSpace.start_at * 1000),
//         end_time: dayjs(mockSpace.end_at * 1000),
//         state: mockSpace.state,
//       });

//       setImages(mockSpace.images);
//       setMarkdownContent(mockSpace.readme || "");
//       setSelectedDays(mockSpace.freq.in_week || []);
      
//     } catch (error) {
//       message.error("加载空间数据失败");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const setInitialValues = () => {
//     const now = dayjs();
//     form.setFieldsValue({
//       name: "",
//       desc: "",
//       ty: SpaceType.Tech,
//       fee: 0,
//       freq_interval: FrequencyInterval.Weekly,
//       start_time: now.add(1, "hour"),
//       end_time: now.add(2, "hour"),
//       state: SpaceState.Waiting,
//     });
//     setMarkdownContent("# 空间介绍\\n\\n在这里编写您的空间详细介绍...");
//   };

//   const updatePreview = (formValues: any) => {
//     const now = Date.now() / 1000;
//     const preview: Space = {
//       id: id || "preview",
//       name: formValues.name || "空间名称",
//       desc: formValues.desc || "空间描述",
//       created_at: now,
//       start_at: formValues.start_time ? formValues.start_time.unix() : now + 3600,
//       end_at: formValues.end_time ? formValues.end_time.unix() : now + 7200,
//       freq: {
//         interval: formValues.freq_interval || FrequencyInterval.Weekly,
//         in_week: selectedDays,
//       },
//       fee: formValues.fee || 0,
//       owner_id: "current_user",
//       owner_name: "当前用户",
//       state: formValues.state || SpaceState.Waiting,
//       sub_count: 0,
//       online_count: 0,
//       url: "https://example.com/preview",
//       images,
//       ty: formValues.ty || SpaceType.Tech,
//       readme: markdownContent,
//     };
//     setPreviewSpace(preview);
//   };

//   const handleImageUpload = async (file: File) => {
//     try {
//       setUploading(true);
      
//       // 模拟图片上传 - 实际项目中需要调用上传API
//       await new Promise(resolve => setTimeout(resolve, 1000));
      
//       // 使用FileReader创建预览URL
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const imageUrl = e.target?.result as string;
//         setImages(prev => [...prev, imageUrl]);
//         message.success("图片上传成功");
//       };
//       reader.readAsDataURL(file);
      
//     } catch (error) {
//       message.error("图片上传失败");
//     } finally {
//       setUploading(false);
//     }
    
//     return false; // 阻止默认上传行为
//   };

//   const handleImageRemove = (index: number) => {
//     setImages(prev => prev.filter((_, i) => i !== index));
//   };

//   const handleDayToggle = (day: number) => {
//     setSelectedDays(prev => {
//       if (prev.includes(day)) {
//         return prev.filter(d => d !== day);
//       } else {
//         return [...prev, day].sort();
//       }
//     });
//   };

//   const handleSave = async () => {
//     try {
//       await form.validateFields();
//       const values = form.getFieldsValue();
      
//       setLoading(true);
      
//       const spaceData: Partial<Space> = {
//         name: values.name,
//         desc: values.desc,
//         ty: values.ty,
//         fee: values.fee,
//         start_at: values.start_time.unix(),
//         end_at: values.end_time.unix(),
//         freq: {
//           interval: values.freq_interval,
//           in_week: values.freq_interval === FrequencyInterval.Weekly ? selectedDays : undefined,
//         },
//         state: values.state,
//         images,
//         readme: markdownContent,
//       };

//       // 模拟API调用
//       await new Promise(resolve => setTimeout(resolve, 2000));
      
//       message.success(isEdit ? "空间更新成功" : "空间创建成功");
//       router.push("/"); // 返回首页
      
//     } catch (error) {
//       message.error("保存失败，请检查表单信息");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCancel = () => {
//     router.back();
//   };
//     const [messageApi, contextHolder] = message.useMessage();
//   return (
//     <div className={styles.spaceEdit}>
//       {contextHolder}
//       <HomeHeader messageApi={messageApi} />

//       <div className={styles.container}>
//         <h1 className={styles.pageTitle}>
//           {isEdit ? "编辑空间" : "创建新空间"}
//         </h1>

//         <div className={styles.editContent}>
//           {/* 左侧编辑面板 */}
//           <div className={styles.leftPanel}>
//             <Form
//               form={form}
//               layout="vertical"
//               onValuesChange={updatePreview}
//             >
//               {/* 基本信息 */}
//               <div className={styles.formSection}>
//                 <div className={styles.sectionTitle}>
//                   <InfoCircleOutlined className={styles.sectionIcon} />
//                   基本信息
//                 </div>
//                 <div className={styles.formGrid}>
//                   <Form.Item
//                     label="空间名称"
//                     name="name"
//                     className={styles.fullWidth}
//                     rules={[{ required: true, message: "请输入空间名称" }]}
//                   >
//                     <Input placeholder="输入空间名称" />
//                   </Form.Item>
                  
//                   <Form.Item
//                     label="空间描述"
//                     name="desc"
//                     className={styles.fullWidth}
//                     rules={[{ required: true, message: "请输入空间描述" }]}
//                   >
//                     <TextArea 
//                       rows={3} 
//                       placeholder="简要描述您的空间内容和特色" 
//                     />
//                   </Form.Item>

//                   <Form.Item
//                     label="空间类型"
//                     name="ty"
//                     rules={[{ required: true, message: "请选择空间类型" }]}
//                   >
//                     <Select placeholder="选择空间类型">
//                       <Option value={SpaceType.Tech}>技术</Option>
//                       <Option value={SpaceType.Meeting}>会议</Option>
//                       <Option value={SpaceType.Class}>课程</Option>
//                       <Option value={SpaceType.Hobbies}>兴趣爱好</Option>
//                     </Select>
//                   </Form.Item>

//                   <Form.Item
//                     label="参与费用 (¥)"
//                     name="fee"
//                     rules={[{ required: true, message: "请设置参与费用" }]}
//                   >
//                     <InputNumber
//                       min={0}
//                       placeholder="0表示免费"
//                       style={{ width: "100%" }}
//                     />
//                   </Form.Item>
//                 </div>
//               </div>

//               {/* 时间安排 */}
//               <div className={styles.formSection}>
//                 <div className={styles.sectionTitle}>
//                   <CalendarOutlined className={styles.sectionIcon} />
//                   时间安排
//                 </div>
//                 <div className={styles.formGrid}>
//                   <Form.Item
//                     label="频率"
//                     name="freq_interval"
//                     rules={[{ required: true, message: "请选择频率" }]}
//                   >
//                     <Select placeholder="选择频率">
//                       <Option value={FrequencyInterval.Daily}>每天</Option>
//                       <Option value={FrequencyInterval.Weekly}>每周</Option>
//                       <Option value={FrequencyInterval.Monthly}>每月</Option>
//                       <Option value={FrequencyInterval.Flexible}>灵活安排</Option>
//                     </Select>
//                   </Form.Item>

//                   <Form.Item
//                     label="空间状态"
//                     name="state"
//                     rules={[{ required: true, message: "请选择空间状态" }]}
//                   >
//                     <Select placeholder="选择状态">
//                       <Option value={SpaceState.Waiting}>等待中</Option>
//                       <Option value={SpaceState.Active}>活跃</Option>
//                     </Select>
//                   </Form.Item>

//                   <Form.Item
//                     label="开始时间"
//                     name="start_time"
//                     rules={[{ required: true, message: "请选择开始时间" }]}
//                   >
//                     <DatePicker
//                       showTime
//                       format="YYYY-MM-DD HH:mm"
//                       style={{ width: "100%" }}
//                     />
//                   </Form.Item>

//                   <Form.Item
//                     label="结束时间"
//                     name="end_time"
//                     rules={[{ required: true, message: "请选择结束时间" }]}
//                   >
//                     <DatePicker
//                       showTime
//                       format="YYYY-MM-DD HH:mm"
//                       style={{ width: "100%" }}
//                     />
//                   </Form.Item>
//                 </div>

//                 {/* 星期选择 */}
//                 <Form.Item noStyle shouldUpdate={(prev, cur) => prev.freq_interval !== cur.freq_interval}>
//                   {({ getFieldValue }) => {
//                     const interval = getFieldValue("freq_interval");
//                     if (interval === FrequencyInterval.Weekly || interval === FrequencyInterval.Flexible) {
//                       return (
//                         <div className={styles.frequencySection}>
//                           <div style={{ marginBottom: 8, fontWeight: 500 }}>选择星期</div>
//                           <div className={styles.weekDays}>
//                             {weekDays.map(day => (
//                               <div
//                                 key={day.key}
//                                 className={`${styles.dayButton} ${selectedDays.includes(day.key) ? styles.selected : ""}`}
//                                 onClick={() => handleDayToggle(day.key)}
//                               >
//                                 {day.label}
//                               </div>
//                             ))}
//                           </div>
//                         </div>
//                       );
//                     }
//                     return null;
//                   }}
//                 </Form.Item>
//               </div>

//               {/* 图片上传 */}
//               <div className={styles.formSection}>
//                 <div className={styles.sectionTitle}>
//                   <FileImageOutlined className={styles.sectionIcon} />
//                   宣传图片
//                 </div>
//                 <div className={styles.imageUploadSection}>
//                   <Upload
//                     beforeUpload={handleImageUpload}
//                     showUploadList={false}
//                     accept="image/*"
//                     multiple
//                   >
//                     <div className={styles.uploadArea}>
//                       <PlusOutlined className={styles.uploadIcon} />
//                       <div className={styles.uploadText}>
//                         {uploading ? "上传中..." : "点击或拖拽上传图片"}
//                       </div>
//                       <div className={styles.uploadHint}>
//                         支持 JPG、PNG、GIF 格式，单张图片不超过 5MB
//                       </div>
//                     </div>
//                   </Upload>

//                   {images.length > 0 && (
//                     <div className={styles.imageList}>
//                       {images.map((image, index) => (
//                         <div key={index} className={styles.imageItem}>
//                           <img src={image} alt={`预览图 ${index + 1}`} />
//                           <button
//                             className={styles.removeButton}
//                             onClick={() => handleImageRemove(index)}
//                           >
//                             <DeleteOutlined />
//                           </button>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Markdown编辑器 */}
//               <div className={styles.formSection}>
//                 <div className={styles.sectionTitle}>
//                   <EditOutlined className={styles.sectionIcon} />
//                   详细介绍
//                 </div>
//                 <div className={styles.markdownEditor}>
//                   <div className={styles.editorContainer}>
//                     <Tabs
//                       activeKey={activeTab}
//                       onChange={setActiveTab}
//                       className={styles.editorTabs}
//                     >
//                       <TabPane tab="编辑" key="edit">
//                         <div className={styles.editorContent}>
//                           <TextArea
//                             value={markdownContent}
//                             onChange={(e) => setMarkdownContent(e.target.value)}
//                             placeholder="使用 Markdown 语法编写详细介绍..."
//                             rows={12}
//                             style={{ border: "none", resize: "vertical" }}
//                           />
//                         </div>
//                       </TabPane>
//                       <TabPane tab="预览" key="preview">
//                         <div className={styles.previewContent}>
//                           <ReactMarkdown>{markdownContent}</ReactMarkdown>
//                         </div>
//                       </TabPane>
//                     </Tabs>
//                   </div>
//                 </div>
//               </div>
//             </Form>
//           </div>

//           {/* 右侧预览面板 */}
//           <div className={styles.rightPanel}>
//             <div className={styles.previewSection}>
//               <div className={styles.previewTitle}>实时预览</div>
//               {previewSpace && (
//                 <div className={styles.previewCard}>
//                   <SpaceCard {...previewSpace} />
//                 </div>
//               )}
//             </div>

//             <div className={styles.actionButtons}>
//               <Button
//                 type="primary"
//                 size="large"
//                 icon={<SaveOutlined />}
//                 loading={loading}
//                 onClick={handleSave}
//                 className={styles.saveButton}
//               >
//                 {isEdit ? "保存修改" : "创建空间"}
//               </Button>
              
//               <Button
//                 size="large"
//                 icon={<CloseOutlined />}
//                 onClick={handleCancel}
//                 className={styles.cancelButton}
//               >
//                 取消
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
