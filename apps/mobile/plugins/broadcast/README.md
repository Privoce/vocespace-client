# ReplayKit broadcast adapter

Based on the Apache-2.0 Jitsi sample at commit `18c35f7625b38233579ff34f761f4c126ba7e03a`, linked by the installed LiveKit React Native SDK 3.0.0 README:
https://github.com/jitsi/jitsi-meet-sdk-samples/tree/18c35f7625b38233579ff34f761f4c126ba7e03a/ios/swift-screensharing/JitsiSDKScreenSharingTest/Broadcast%20Extension

Original copyright notices and LICENSE retained. VoceSpace reads the App Group from Info.plist instead of the example's hard-coded group. The Expo config plugin creates and embeds the extension and its entitlements reproducibly. Only video samples are forwarded; system/microphone audio is not implicitly captured. Signing with a real Apple team/App Group and actual broadcast capture need device validation.
