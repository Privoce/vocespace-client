# AVO 自定义 / VibeCoding 形象技术评估

## 背景

当前 VoceSpace 的 AVO 形象系统是一个基于 p5.js 的程序化渲染方案，核心特点是：

- 前端运行时在 [app/pages/participant/avo.tsx](/Users/shengyifei/projects/livekit/vocespace/vocespace/app/pages/participant/avo.tsx) 中完成
- 数据结构是轻量参数模型，定义在 [lib/std/space.ts](/Users/shengyifei/projects/livekit/vocespace/vocespace/lib/std/space.ts)
- 用户编辑面板在 [app/pages/participant/avo_conf.tsx](/Users/shengyifei/projects/livekit/vocespace/vocespace/app/pages/participant/avo_conf.tsx)
- 当前可配置项只有 `variant`、`hue`、`style`、`energy`、`enabled`、`isUsed`、`name`
- 最终渲染结果是代码实时生成的 blob / ring / wave 三种风格，不依赖外部素材文件

这意味着当前系统很适合“轻量、统一风格、低存储成本、低同步成本”的动态 AVO，但并不天然适合“用户上传自己的复杂自定义形象资源”。

---

## 结论先行

结论是：

可以做，但不建议直接把“用户上传任意形象”硬塞进现有这套 p5 参数系统。

更合理的方向是把 AVO 系统拆成两层：

- 第一层：保留现有程序化 AVO，作为默认和兜底方案
- 第二层：新增“自定义形象资源协议”，让用户上传图片或结构化素材，再由新的渲染器显示

也就是说，后续如果要支持“用户自己 VibeCoding 形象”，建议演进成“多渲染后端”的 AVO 架构，而不是继续只靠 `ParticipantAvoParams` 扩字段。

---

## 当前实现的技术特征

### 1. 当前 AVO 是参数驱动，不是素材驱动

现有 `ParticipantAvoParams` 结构非常轻：

- `variant`: 用于生成伪随机差异
- `hue`: 主色调
- `style`: blob / ring / wave
- `energy`: 动画强度
- `enabled`: 是否开启
- `isUsed`: 当前是否使用
- `name`: 展示名

这类数据适合：

- 用少量字段推导出一个统一视觉风格
- 同步成本极低
- 可以很容易做实时预览
- 不需要文件管理系统

但它不适合：

- 存用户上传的图片
- 存可编辑的形象图层
- 存骨骼、动作、锚点、碰撞区等复杂描述
- 存用户“自己画出来 / AI 生成出来”的自定义资产

### 2. 当前渲染器是单一 p5 runtime

[app/pages/participant/avo.tsx](/Users/shengyifei/projects/livekit/vocespace/vocespace/app/pages/participant/avo.tsx) 中的 `Creature` 类，本质上是一个固定算法生成器：

- 身体形状由 style 决定
- 表情、眨眼、粒子、呼吸感是代码逻辑驱动
- 音量驱动动画强度
- 鼠标 / 远程指针驱动 lean、hover、pet 效果

这套设计的优点是：

- 表现统一
- 动态自然
- 无资源加载复杂度
- 每个实例都可互动

问题是：

- 渲染逻辑和角色形态强耦合
- 角色不是“数据描述”而是“代码行为”
- 用户上传一个 png / json / svg 后，现有 runtime 无法直接消费

### 3. 当前配置面板本质是参数编辑器，不是资源编辑器

[app/pages/participant/avo_conf.tsx](/Users/shengyifei/projects/livekit/vocespace/vocespace/app/pages/participant/avo_conf.tsx) 当前提供的是：

- 风格切换
- 配色选择
- energy 调节
- 名字输入
- 预设保存 / 导入 / 导出

这意味着：

- 现在的导入导出只是“参数 JSON”
- 不是“角色资源包”
- 也没有文件上传、资源预处理、缩略图生成、校验管线

如果以后要做用户上传形象，配置面板就不再只是调参数，而要承担：

- 文件上传
- 资源校验
- 预览回显
- 协议转换
- 失败回退
- 资源版本管理

---

## 如果要做“用户自己 VibeCoding 形象”，有哪些实现方向

## 方案 A：上传静态图片，作为头像型 AVO

### 方案 A 说明

允许用户上传一张图片，然后在 AVO 区域显示这张图片，而不是 p5 程序化角色。

例如：

- png
- webp
- 带透明背景头像
- 方图 / 圆图 / 裁切图

### 方案 A 优点

- 实现成本最低
- 最容易接入现有上传链路
- 最容易理解和运营
- 对用户来说门槛最低

### 方案 A 难点

- 表现力弱，基本没有“活物感”
- 无法复用现有 p5 的 hover / blink / audio reactive 逻辑
- 如果只是静态图，看起来会退化成普通头像
- 图片尺寸、透明背景、裁切质量会参差不齐

### 方案 A 折中方式

可以做“静态图 + 外层动态特效”模式：

- 中间是用户上传图片
- 外围保留现有 p5 粒子、hover glow、音量 pulse
- 鼠标互动只作用在外框，不作用在图片本体变形

这会比纯静态图更像 AVO，同时复杂度仍然比较可控。

### 方案 A 结论

如果你们想先验证用户需求，这是最适合的第一步。

---

## 方案 B：上传 SVG / 图层描述，前端做轻量动画

### 方案 B 说明

让用户上传：

- 标准 SVG
- 或一份你们自定义的 JSON 图层协议

前端再基于这些图层做简单动画：

- 整体呼吸缩放
- 眼睛眨动
- 头部轻微偏移
- 音量驱动 scale / glow

### 方案 B 优点

- 保留“用户自定义”能力
- 仍然可做部分动态效果
- 图层化后可做更细的动画控制
- 画质比位图更稳定

### 方案 B 难点

- 通用 SVG 很难直接安全消费
- 不同用户导出的 SVG 结构差异极大
- 如果不限制协议，后续维护会非常重
- 你们需要定义自己的“可渲染 SVG/JSON 子集”

### 方案 B 折中方式

不要支持任意 SVG。

只支持两种输入之一：

1. 你们自己定义的 JSON 角色协议
2. 受限 SVG 模板导出结果

例如规定：

- 必须有 `face`、`body`、`eyes`、`mouth` 等层
- 坐标归一化到固定视口
- 不允许脚本、滤镜、外部资源引用
- 允许的元素只有 path / circle / rect / group

### 方案 B 结论

这是“可持续”的中期方案，但前提是你们愿意定义并维护一套资产协议。

---

## 方案 C：上传角色资源包，切换渲染器

### 方案 C 说明

把 AVO 系统升级为：

- `procedural` 渲染器：现有 p5 creature
- `image` 渲染器：静态或动态贴图
- `puppet` 渲染器：图层 / 骨骼 / 受限动画资源
- 未来甚至可扩到 `live2d-lite` / `rive-like`

也就是不再假设所有 AVO 都必须由同一个 `Creature` 类画出来，而是让 AVO 变成：

- 一份 metadata
- 指向一个 renderer type
- 再由对应 renderer 渲染

### 方案 C 优点

- 架构最正确
- 扩展性最好
- 后续可以逐步支持更多类型形象
- 不会污染现有 p5 creature 逻辑

### 方案 C 难点

- 需要改 `ParticipantAvoParams` 数据结构
- 需要把 `normalizeAvoParams` 改成多协议 normalize
- `ParticipantAvoPlaceholder` 需要变成渲染器分发器
- 预览面板、导入导出、默认值、回退逻辑都要重构

### 方案 C 推荐的数据结构方向

建议未来改成类似：

```ts
interface ParticipantAvatarModel {
  id: string;
  name: string;
  isUsed: boolean;
  enabled: boolean;
  renderer: 'procedural' | 'image' | 'puppet';
  payload: ProceduralPayload | ImagePayload | PuppetPayload;
}
```

示意：

```ts
interface ProceduralPayload {
  variant: number;
  hue: number;
  style: 'blob' | 'ring' | 'wave';
  energy: number;
}

interface ImagePayload {
  fileUrl: string;
  crop?: { x: number; y: number; w: number; h: number };
  fit?: 'contain' | 'cover';
  reactive?: boolean;
}

interface PuppetPayload {
  manifestUrl: string;
  version: string;
}
```

### 方案 C 结论

如果你们明确要长期做“用户上传自己的形象”，这是最值得投资的方向。

---

## 我认为当前会遇到的核心难点

## 1. 数据模型不够表达“自定义资产”

当前 `ParticipantAvoParams` 明显偏参数化。

如果继续往里面硬加字段，比如：

- `imageUrl`
- `maskUrl`
- `layers`
- `anchorPoints`
- `animationConfig`

最后会变成一个混杂结构：

- 程序化 AVO 用一部分字段
- 图片 AVO 用另一部分字段
- 图层 AVO 用第三部分字段

这会让：

- normalize 逻辑越来越难维护
- 预览逻辑分叉严重
- 默认值和兼容逻辑变复杂

所以从工程角度看，不建议继续只靠扩字段顶下去。

## 2. 渲染器能力不匹配

当前 p5 creature 渲染器能做的是：

- 程序化形状
- 粒子
- 面部变化
- 简单交互

它不擅长：

- 通用图片资源装载与裁切
- 多图层资源管理
- 骨骼动画
- 复杂素材命中区 / 交互区域映射

如果你硬把上传素材也塞给这个 runtime，后面会很快变成一个过重的“万能渲染器”。

## 3. 上传资源的安全性和规范化

用户上传自定义形象，技术问题不只是“能不能显示”，还包括：

- 文件大小限制
- 图片格式限制
- SVG 安全问题
- 恶意 payload
- 透明背景质量差
- 宽高比例极端
- 动图性能和内存问题
- 多人同时在线时的下载与缓存压力

尤其 SVG 是高风险点：

- 可能包含脚本
- 可能包含外链资源
- DOM 结构不稳定
- 很难直接当可信运行时资产

如果支持 SVG，必须做服务端清洗或只接受受限导出格式。

## 4. 互动语义会变弱

当前 creature 的一个很大优势是：

- 鼠标移上去会有 lean / hover
- 点击会 pop
- 音量会驱动“活着”的反应

如果用户上传的是静态形象：

- 这些互动行为要么消失
- 要么变成外层统一特效
- 很难对任意素材做一致又自然的局部动画

所以“用户自定义形象”做出来后，很可能会更自由，但也更没灵魂。

这是产品上必须接受的 tradeoff。

## 5. 预设导入导出协议需要升级

当前 [app/pages/participant/avo_conf.tsx](/Users/shengyifei/projects/livekit/vocespace/vocespace/app/pages/participant/avo_conf.tsx) 的导出是参数 JSON。

如果支持上传型形象，导入导出会变成两个层次：

- 导出配置 JSON
- 导出资源包 manifest

否则只导出 JSON，没有资源文件；只导出文件，又没有配置元数据。

这意味着需要明确：

- 是只在云端保存资源 URL
- 还是支持本地完整导入 / 导出角色包
- 是否做资源去重与版本号

---

## 推荐的分阶段实施方案

## 第一阶段：最小验证版

目标：验证用户是否真的需要“上传自定义形象”。

建议只做：

- 允许上传一张透明背景图片
- 新增 `renderer: 'image'`
- 前端把它当头像型 AVO 显示
- 保留外围 pulse / glow / hover 特效
- 不做骨骼、不做图层编辑

### 第一阶段优点

- 改动范围可控
- 可以复用现有上传接口思路
- 最快上线验证需求
- 失败成本低

### 第一阶段需要改的地方

1. 扩展 AVO 数据结构，不再只有 procedural 参数
2. 新增图片资源存储字段
3. `ParticipantAvoPlaceholder` 改为 renderer 分发
4. AvoConfigPanel 增加上传入口与预览
5. 做图片尺寸、大小、透明度、格式校验

---

## 第二阶段：结构化资源协议

目标：支持比静态图片更强的“自定义形象”。

建议做：

- 自定义 manifest 协议
- 图层 / 锚点 / 命中区域规范
- 统一渲染器
- 支持 blink / mouth / hover 等轻交互

此阶段不要直接支持“任意用户自由绘制任意协议”，而是支持：

- 由你们的编辑器导出的标准资源
- 或者由 AI / 脚本转换后的标准资源

也就是说，“VibeCoding 形象”可以有，但产出物必须进入你们的受控协议。

---

## 第三阶段：开放式创作

目标：让用户真正创造自己的动态 AVO。

这时可以考虑：

- Web 编辑器
- JSON 图层协议
- 受限动作模板
- 资源包导入导出
- 在线预处理与压缩

但这一阶段已经不是“给 AVO 加一个上传按钮”，而是在做一个小型 avatar platform。

---

## 如果现在就问“能不能做”

答案是：

能做。

但要区分三件完全不同的事：

1. 上传一张图片并显示
2. 上传一个结构化形象并做简单动画
3. 让用户自由创作一个可互动、可响应音量、可被远程指针驱动的动态角色

这三者的实现成本差距很大。

- 第 1 种：很快可做
- 第 2 种：中等复杂，需要设计协议
- 第 3 种：明显是长期项目

---

## 我对当前代码的具体判断

基于当前实现，我认为：

### 适合继续沿用的部分

- 现有 `ParticipantAvoPlaceholder` 作为统一入口组件的思路是对的
- 现有 `avoList` 预设机制值得保留
- 现有 `audioLevel`、`remotePointer`、`remotePopKey` 这些互动输入接口应该保留
- 现有面板的“预设保存 / 导入 / 导出”交互模型可以延续

### 不适合直接复用的部分

- `ParticipantAvoParams` 不能继续承担所有未来自定义形象描述
- `Creature` 不能作为所有形象的唯一 runtime
- `normalizeAvoParams()` 的职责太偏 procedural，后续不应继续无限膨胀

### 最应该优先重构的部分

优先建议重构成：

- `AvatarModel` 数据结构
- `AvatarRenderer` 分发层
- `procedural renderer` 和 `image renderer` 并存

这一步做完，后面所有扩展都会顺得多。

---

## 建议的 avo.opt 落地方案

如果按工程优先级，我建议这样排：

### 方案 1：近期可落地

- 支持上传 png / webp 透明头像
- 增加 `image` 类型 AVO
- 外层保留 hover / audio pulse 特效
- 不做局部骨骼或五官动画

### 方案 2：中期演进

- 定义 `AvatarModel` 多渲染协议
- AVO 配置面板支持“程序化 / 图片化”切换
- 增加资源校验、缩略图和 manifest

### 方案 3：长期规划

- 做受限图层协议
- 做自定义编辑器或 AI 生成后转换器
- 实现更强的用户创作能力

---

## 风险汇总

### 产品风险

- 用户以为“上传形象”就能拥有和现有 AVO 一样的动态效果，实际做不到
- 上传自由度提高后，整体空间风格会失控
- 自定义形象质量差异大，影响整体观感

### 工程风险

- 数据结构膨胀
- 运行时分支增多
- 资源缓存和上传管理复杂化
- 多人房间同时加载素材时的性能问题

### 维护风险

- 兼容旧版 `avoList`
- 导入导出协议版本演进
- 用户上传坏资源后的恢复和兜底

---

## 最终建议

如果你们只是想证明“用户想不想自定义自己的 AVO”，不要一上来做复杂创作系统。

建议第一步只做：

- 上传单张图片
- 作为新的 AVO renderer 显示
- 外围叠加现有交互特效
- 继续保留程序化 AVO 作为默认方案

如果这一步数据和反馈不错，再进入第二阶段，设计真正的自定义资源协议。

从当前代码出发，这样演进最稳，技术债也最少。
