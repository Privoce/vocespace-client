# VoceSpace iOS — Encryption technical description

Prepared 10 November 2026. Product: VoceSpace 1.0.0, iOS build 2, bundle ID com.privoce.vocespace.

Status: technical draft based on application source, dependency source and inspection of the exported IPA. The supplier capability questions and applicant facts below remain open. This is not an issued classification or a completed, signed export declaration. Scope is the iOS client, not the separately deployed servers or an Android binary.

## Suggested SNAP-R Block 22(j) description

VoceSpace is an iOS audio/video conferencing and screen-sharing application with room discovery, chat and account access. It uses HTTPS/WSS for service communications and LiveKit WebRTC with DTLS-SRTP for media transport, including AES-128 counter mode with HMAC-SHA1 and AES-128/256-GCM SRTP capabilities. Credentials are stored using Apple's Keychain. SHA-256 is used for local storage identifiers. Cryptographic functions are supplied by operating-system APIs and third-party libraries; no applicant-designed encryption algorithm was identified in the reviewed application code. See the attached technical inventory for component versions, unused library capabilities and outstanding supplier confirmation.

## Product and distribution

The product is an end-user conferencing client for general-purpose Apple iOS devices. Functions include audio/video communication, screen sharing, room discovery, HLS previews, chat and user account access. It is not presented as a standalone cryptographic toolkit, VPN, cryptanalytic tool or network penetration product. Servers provide authentication, room services and media routing separately from the submitted application.

Applicant/manufacturer legal name, address, technical contact, previous CCATS/ECCN and authorization references: **APPLICANT TO CONFIRM**. The signing identity names Privoce, Inc.; this does not itself establish the proper applicant or all manufacturing facts.

Intended store distribution, countries, pricing, sales volume, availability to the public and mass-market rationale: **APPLICANT TO CONFIRM**. General-purpose consumer functionality alone does not establish a legal classification.

## Data protection and algorithms

1. Service traffic: HTTPS and secure WebSockets protect account requests, service API calls and signaling in transit. HLS preview retrieval uses the platform media/network stack. TLS suites, certificate key sizes and negotiated versions are controlled by the operating system and remote endpoints; they have not been exhaustively measured for this submission.
2. Realtime media: the RN WebRTC adapter enables AES-GCM SRTP suites and disables the short HMAC-SHA1-32 suite. Supported configured profiles include AES_CM_128_HMAC_SHA1_80 (128-bit AES key, 112-bit salt, 80-bit authentication tag), AEAD_AES_128_GCM and AEAD_AES_256_GCM (128/256-bit AES keys, 96-bit salt, 128-bit authentication tags). SRTP/SRTCP protects media payloads; it is not a claim that every transport header is encrypted. DTLS negotiates/export-derives SRTP keying material.
3. WebRTC data transport capability: SCTP over DTLS. This transport security must be distinguished from application-level end-to-end encryption.
4. DTLS implementation: BoringSSL within LiveKitWebRTC. Upstream default key exchange groups are X25519, P-256 and P-384. ECDHE, ECDSA/RSA authentication, AES and ChaCha20-Poly1305 suites and SHA/HMAC functions are supplied by the library, subject to its cipher filters and negotiation. A maximum RSA modulus and an exhaustive enabled TLS/DTLS suite list are **PENDING SUPPLIER CONFIRMATION**; binary strings do not establish these limits.
5. Storage identifiers: SHA-256 via expo-crypto and Apple CommonCrypto hashes service URLs into local storage namespaces. It is unkeyed hashing, not password encryption or a password KDF.
6. Stored credentials: expo-secure-store calls Apple's Security/Keychain APIs with WHEN_UNLOCKED_THIS_DEVICE_ONLY. Storage encryption and key lifecycle are controlled by iOS; the application does not select a storage cipher or directly handle Keychain encryption keys.
7. Random identifiers: expo-crypto calls Foundation UUID for identifiers. The dependency also exposes operating-system random-byte APIs. No proprietary random-number generator or applicant-designed encryption key generator was identified.

## Key lifecycle and endpoints

TLS and WebRTC libraries generate and manage their transport keying material and perform protocol handshakes. The reviewed application does not expose user controls for transport algorithms, key size or key derivation parameters. Server-issued access tokens authorize sessions and are stored in Keychain; they are not the SRTP encryption keys. TLS endpoint authentication and WebRTC certificate fingerprint handling are delegated to the platform and SDK.

NativeRoom is created without e2ee/encryption options or a key provider. The corresponding UI option is disabled. Therefore this build does not intentionally enable LiveKit application-level E2EE or distribute E2EE group keys. The media server terminates transport protection; the product should not be described as preventing the media server from accessing conference content.

## Additional bundled capabilities and non-standard cryptography statement

No proprietary encryption algorithm, custom cryptographic primitive or applicant-designed key exchange protocol was found in the reviewed VoceSpace application/workspace code. Cryptographic library patches were not found in the project's declared dependency patches.

This finding is limited to applicant code. The package includes third-party functions not invoked by current application features:

- ExpoCrypto exposes OS-backed AES-GCM (128/192/256-bit) and additional digest APIs (MD2/MD4/MD5, SHA-1/224/256/384/512 on iOS).
- LiveKit libraries include E2EE/frame-cryptor APIs, AES-GCM and PBKDF2/HKDF key derivation functionality, not enabled by this application.
- LiveKitWebRTC binary inspection identifies algorithm names beyond active transport settings, including legacy algorithm names and ML-KEM/hybrid group identifiers. In particular X25519Kyber768Draft00, X25519MLKEM768 and ML-KEM-768/1024 strings are present. Upstream default DTLS groups omit the draft Kyber group; a field trial can add X25519MLKEM768. Names alone cannot prove implementation or runtime reachability in every transport path.

Consequently an unconditional assertion that the complete third-party package contains no non-standard cryptography is **NOT YET SUBSTANTIATED**. Supplier confirmation is requested for enabled/disabled algorithms, draft/hybrid mechanisms, all reachable TLS/DTLS paths and existing classifications. Do not replace this paragraph with a blanket “No” solely because no applicant-designed algorithm was found.

## Processing and protocols

Media is encoded/compressed by the standard codec paths exposed by WebRTC before media transport encryption. Exact codecs depend on device and session negotiation. The application adds no proprietary cryptographic preprocessing. Standard RTP/RTCP, SRTP/SRTCP, DTLS records, SCTP, UDP/TCP and ICE/STUN/TURN mechanisms provide transport/encapsulation. HTTPS/WebSocket traffic uses standard application serialization and TLS. No IPsec/IKE implementation was identified in the application.

## Components and implementation

The iOS client uses React Native 0.83.10, Expo 55.0.31, livekit-client 2.22.3, @livekit/react-native 3.0.0, @livekit/react-native-webrtc 144.2.0, LiveKitWebRTC 144.7559.15, expo-crypto 55.0.19 and expo-secure-store 55.0.18. LiveKitWebRTC is a bundled dynamic framework with BoringSSL/libSRTP incorporated internally. Expo native modules link into the application; Apple cryptographic/network services are supplied by iOS. JavaScript is packaged for the Hermes runtime. The inspected build was produced using Xcode 27.2 (27B52).

Published build provenance points to WebRTC commit 30d5e63ae91da483e06577b5c35ee91cc5e5c3db, whose DEPS pins BoringSSL b94d71f87ff943a617d77f3ff029f9a01a1ec6bc and libSRTP a52756acb1c5e133089c798736dd171567df11f5. These are source provenance references, not independent binary reproducibility attestations or FIPS certifications.

The distributed IPA contains compiled application and library code, not an applicant-provided SDK for third parties to develop encryption products. Separate public source availability and licensing statements, if relevant to the application, must be confirmed by the applicant. End users have no in-app interface to replace algorithms or import alternate transport cryptographic modules; this does not claim that publicly available source cannot be modified and rebuilt.

## Remaining applicant/supplier inputs for a formal submission

- Prior classification history and any component CCATS; requested ECCN and the justification for the applicable ENC paragraph.
- Legal entity, technical contact, development/manufacturing cities and countries, distribution channels/countries, price and mass-market facts.
- Complete supplier algorithm/key-length/mode inventory, actual build configuration and applicability of draft/PQC functionality, including TURN/TLS paths.
- Evidence of real-device negotiated ciphers and certificate/group settings, distinct from maximum supported capabilities.
- A paragraph-by-paragraph applicability assessment for EAR 740.17(b)(2)/(b)(3), including any relevant throughput/endpoint limits and interfaces. These legal criteria are not resolved by this source audit.

## References and accompanying evidence

- BIS filing guidance: https://www.bis.gov/learn-support/encryption-controls/encryption-review-ccats
- EAR Supplement No. 6 to Part 742: https://www.bis.gov/regulations/ear/742
- Component references, local source locations and review limits: `mobile-crypto-inventory.md`.
- Exact inspected artifact hashes and extracted algorithm-name evidence: `ios-build2-binary-evidence.txt`.

This draft supports the technical narrative and Block 22(j). It is not a substitute for completing every applicable questionnaire field or obtaining BIS's determination, and has not been filed through SNAP-R.
