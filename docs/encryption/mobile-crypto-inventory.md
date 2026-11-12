# VoceSpace Mobile 加密盘点

核对日期：2026-11-10。用途：支持 SNAP-R 技术描述；不是 CCATS、ECCN 判定或完整第三方密码学认证。

## 范围与结论

- 实物核对：iOS `com.privoce.vocespace` 1.0.0 (2)，`build/ios-20261110-build2/app-store-export/VoceSpace.ipa`。IPA 与 WebRTC 二进制 SHA-256 见同目录 `ios-build2-binary-evidence.txt`。
- 源码核对：Mobile、其 client-sdk/contracts/domain/ui/meeting-core 工作区、Expo 原生模块、React Native WebRTC 适配器及锁定依赖。Android 仅核对当前依赖源码，不宣称已审计之前 APK 的全部二进制。
- **未发现 VoceSpace 自行设计的加密算法、修改密码学原语或自行实现的密钥交换协议。** UI 中头像/颜色的整数 hash 属于非密码学计算；Base64、UUID、JSON、Protobuf 不属于加密算法。
- **不能将这个结论扩展为“所有第三方二进制绝无非标准密码学”。** 二进制包含多种未启用算法的名称、兼容常量和 SDK E2EE 能力；名称存在不等于算法实现存在，更不等于运行时使用。以下明确区分。
- 未进行真实设备握手抓取，未获得供应商正式的全部编译能力声明。完整、无遗漏的第三方算法清单仍需供应商 BOM/声明支持。
- Web/API/Supabase/LiveKit 服务器自身的 JWT 签名、密码散列、磁盘加密不是本次 iOS 可执行产品的算法。App 持有授权 token 不等于 App 签发或验证其密码学签名。

## 加密库与版本

| 组件 | 锁定版本/来源 | 在 App 中的作用与链接方式 |
| --- | --- | --- |
| livekit-client | 2.22.3 | JS 会话、信令、RTC 编排；业务不启用 E2EE |
| @livekit/react-native | 3.0.0 | Native LiveKit 适配；SDK 带 E2EE API |
| @livekit/react-native-webrtc | 144.2.0 | WebRTC RN 原生桥接；配置 SRTP 能力 |
| LiveKitWebRTC | 144.7559.15 | IPA 动态 framework；内部包含 BoringSSL、libSRTP |
| BoringSSL | 上游 DEPS：b94d71f87ff943a617d77f3ff029f9a01a1ec6bc | 编入 WebRTC framework；DTLS/TLS、证书、密码学原语。不是另外一个独立 OpenSSL 包；OpenSSL 风格 API/字符串不代表额外依赖 |
| libSRTP | 上游 DEPS：a52756acb1c5e133089c798736dd171567df11f5 | 编入 WebRTC framework；RTP/RTCP 媒体加密与鉴别 |
| expo-crypto | 55.0.19 | 原生模块；iOS 使用 CommonCrypto、CryptoKit、Security/Foundation；Android 使用 JCA/JCE |
| expo-secure-store | 55.0.18 | iOS Keychain；Android Keystore + AES-GCM；原生模块 |
| React Native | 0.83.10 | fetch/WebSocket 原生网络栈；iOS TLS 由系统网络能力提供 |
| expo-video | 55.0.21 | iOS AVPlayer HLS 播放；HTTPS 由系统提供；未发现业务 DRM/内容密钥配置 |
| socket.io-client | client-sdk 声明 ^4.8.1 | HTTP/WebSocket 消息传输；不另行实现消息加密 |

WebRTC 版本链：发布页 144.7559.15 → webrtc-build `5c75bb9` 的 **build/VERSION** → WebRTC `30d5e63ae91da483e06577b5c35ee91cc5e5c3db` → DEPS。同一仓库旧 `webrtc_version.yaml` 仍指 M92，不能用它代表本次发布。DEPS commit 是上游构建来源证据，不是供应商对最终二进制的认证。

## 业务使用及已配置能力

| 用途 | 算法/协议、参数 | 实现与状态 |
| --- | --- | --- |
| API、账号、信令、HLS、埋点传输 | HTTPS/WSS 上的 TLS；具体 TLS 版本、套件和证书密钥长度随系统、服务器协商 | iOS 系统网络栈；不能把 SDK 中所有套件都写成当前连接使用 |
| RTC 音视频/屏幕共享 | DTLS-SRTP；AES-128 Counter Mode + HMAC-SHA1，80-bit 认证标签；AEAD AES-128-GCM / AES-256-GCM，128-bit 标签 | libSRTP/BoringSSL。RN 适配器启用 GCM，禁用 SHA1_32；源码配置能力已确认，实际选中套件未抓取 |
| RTC 数据通道 | SCTP over DTLS；DTLS 握手、证书及数据保护由 BoringSSL 处理 | SDK 传输能力；不等同于 App 另外启用端到端消息加密 |
| DTLS 密钥协商 | 上游默认组 X25519（255-bit 曲线）、P-256、P-384；协商对称密钥 | 上游 ssl_stream_adapter.cc；启用特定 field trial 才增加 X25519MLKEM768。未发现业务设置该 trial |
| DTLS 记录层/认证 | 上游配置涉及 AES-CBC 128/256、AES-GCM 128、ChaCha20-Poly1305 256；ECDHE、ECDSA/RSA、SHA/HMAC 等；准确套件取决于协商与构建 | 不以字符串列表作全部启用清单。openssl_stream_adapter.cc 的 cipher filter 排除 NULL/aNULL、PSK、3DES 和部分套件；TLS 1.3 不能仅从此 filter 推断 |
| 会话存储 key 名 | SHA-256，256-bit 输出，无加密密钥 | api/index.ts、account/client.ts；对 URL 生成命名空间，不是密码加密或密码 KDF |
| 随机标识 | expo-crypto randomUUID → iOS Foundation UUID | 房间/会话/消息 ID；不是自定义密钥生成 |
| iOS token 存储 | Keychain，WHEN_UNLOCKED_THIS_DEVICE_ONLY | expo-secure-store / Security；底层加密和密钥由 Apple 管理，App 不指定 AES 模式/密钥长度 |
| Android token 存储 | AES-256-GCM；新 IV；密钥位于 Android Keystore | 当前 expo-secure-store 源码确认。包含旧 RSA/None/PKCS1Padding 混合解密兼容路径，不代表新写入使用 RSA；RSA 模数未确认 |

SRTP AES-CM 的加密 key 为 128 bit，salt 112 bit；GCM key 为 128/256 bit，salt 96 bit。HMAC-SHA1 80 bit 是截断认证标签，不是 AES key 长度。对应 RFC 3711 / 5764 / 7714。

## 库提供、但未发现业务启用的能力

- ExpoCrypto：iOS CommonCrypto 的 MD2、MD4、MD5、SHA-1、SHA-224/256/384/512；CryptoKit AES-GCM 128/192/256；Security 随机字节。业务仅发现 SHA-256 与 randomUUID 调用。
- LiveKit E2EE：AES-GCM、PBKDF2、HKDF 及密钥轮换接口。NativeRoom 未传 encryption/e2ee/keyProvider；ManualJoin 的 E2EE checkbox 禁用且为 false。不能写“App 不包含 E2EE 库代码”，应写“当前产品功能未启用”。
- WebRTC/BoringSSL 二进制标识还包括 AES 各模式（CBC/CFB/CTR/ECB/OFB/XTS/CCM/GCM）、ChaCha20-Poly1305、RSA/DSA、X25519/X448、曲线名称、HKDF/PBKDF2、旧 DES/3DES/RC2/RC4/Blowfish/CAST 名称及多种摘要名称。部分可能仅是 ASN.1/OID/兼容名称；不得直接宣称这些旧算法可用于通话。
- 特别记录：`ML-KEM-768`、`ML-KEM-1024`、`X25519MLKEM768`、`X25519Kyber768Draft00`。上游默认 DTLS 组不包含 draft Kyber；未证明所有其他路径（例如 TURN TLS）均不可到达。**不能根据“未自研”直接替第三方库回答整个产品的 non-standard cryptography = No。**
- 完整本次提取的 228 条相关字符串见证据 TXT；这不是全部算法可达性证明。

## 本地依据

- `apps/mobile/src/api/index.ts:24`；`apps/mobile/src/account/client.ts:28`：SHA-256 与 SecureStore。
- `apps/mobile/src/conference/room.ts:17`；`apps/mobile/src/screens/ManualJoin.tsx:114`：没有启用 E2EE。
- `apps/mobile/ios/Podfile.lock`：实际 Pod 版本；`apps/mobile/package.json`、`pnpm-lock.yaml`：JS 版本。
- `apps/mobile/node_modules/@livekit/react-native-webrtc/ios/RCTWebRTC/RCTConvert+WebRTC.m:94`：GCM YES、SHA1_32 NO、encrypted RTP headers NO、frame encryption NO。
- `apps/mobile/node_modules/expo-crypto/ios/{CryptoModule.swift,DigestAlgorithm.swift,AES/}`：系统 crypto API。
- `apps/mobile/node_modules/expo-secure-store/ios/SecureStoreModule.swift`：SecItem API。
- `apps/mobile/node_modules/expo-secure-store/android/src/main/java/expo/modules/securestore/encryptors/`：AES256 与旧 RSA 兼容逻辑。
- root package.json 唯一 patchedDependencies 为 Ant Design UI；未发现密码学库 patch。该事实不替代供应商自身 fork 的审计。

## 提交前需要补齐

1. 供应商确认此二进制全部可用算法、TLS/DTLS 版本、最大非对称 key/modulus、draft/PQC 路径是否编入/可启用及现有 CCATS（如有）。可附 IPA framework SHA-256 和锁定版本询问。
2. 实机报告 DTLS cipher、SRTP cipher、证书算法与 group；如支持 TURN/TLS，单独验证。一次握手只能证明那次协商，不证明完整支持上限。
3. 申请人确认既有 CCATS/ECCN、公司/技术联系人、开发/制造所在地、发行国家、价格/销售渠道与 mass-market 依据。代码无法推导这些事实。
4. `snap-r-technical-description.md` 提供英文技术草稿与 Block 22(j) 文案。补齐标注项后再用于正式申请；没有自动提交、没有修改 Info.plist 的合规声明。

## 官方来源

- BIS SNAP-R / Block 22(j)：https://www.bis.gov/learn-support/encryption-controls/encryption-review-ccats
- BIS 技术问卷： https://www.bis.gov/regulations/ear/742 （Supplement No. 6）
- LiveKit release：https://github.com/livekit/webrtc-xcframework/releases/tag/144.7559.15
- Build VERSION：https://github.com/webrtc-sdk/webrtc-build/blob/5c75bb9/build/VERSION
- WebRTC DEPS：https://github.com/webrtc-sdk/webrtc/blob/30d5e63ae91da483e06577b5c35ee91cc5e5c3db/DEPS
- DTLS 配置：https://github.com/webrtc-sdk/webrtc/blob/30d5e63ae91da483e06577b5c35ee91cc5e5c3db/rtc_base/openssl_stream_adapter.cc
- 默认组：https://github.com/webrtc-sdk/webrtc/blob/30d5e63ae91da483e06577b5c35ee91cc5e5c3db/rtc_base/ssl_stream_adapter.cc
- SRTP：https://github.com/webrtc-sdk/webrtc/blob/30d5e63ae91da483e06577b5c35ee91cc5e5c3db/api/crypto/crypto_options.cc
- LiveKit E2EE：https://docs.livekit.io/transport/encryption/
- SRTP 规范：https://www.rfc-editor.org/rfc/rfc3711 、https://www.rfc-editor.org/rfc/rfc5764 、https://www.rfc-editor.org/rfc/rfc7714
