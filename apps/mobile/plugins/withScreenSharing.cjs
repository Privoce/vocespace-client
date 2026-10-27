const { withInfoPlist, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const targetName = 'VoceSpaceBroadcast';
/** Managed CNG: regenerate the extension from source, never hand-edit ignored ios/. */
module.exports = function withScreenSharing(config) {
  const bundle = config.ios.bundleIdentifier;
  const group = `group.${bundle}`;
  // CNG builds need the extension declared before Xcode generation so EAS can sign both targets.
  const eas = config.extra?.eas || {};
  const build = eas.build || {};
  const experimental = build.experimental || {};
  const ios = experimental.ios || {};
  config.extra = {
    ...config.extra,
    eas: {
      ...eas,
      build: {
        ...build,
        experimental: {
          ...experimental,
          ios: {
            ...ios,
            appExtensions: [
              ...(ios.appExtensions || []).filter((item) => item.targetName !== targetName),
              {
                targetName,
                bundleIdentifier: `${bundle}.broadcast`,
                entitlements: { 'com.apple.security.application-groups': [group] },
              },
            ],
          },
        },
      },
    },
  };
  config = withInfoPlist(config, (mod) => {
    mod.modResults.RTCAppGroupIdentifier = group;
    mod.modResults.RTCScreenSharingExtension = `${bundle}.broadcast`;
    mod.modResults.UIBackgroundModes = [
      ...new Set([...(mod.modResults.UIBackgroundModes || []), 'audio']),
    ];
    return mod;
  });
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.security.application-groups'] = [
      ...new Set([...(mod.modResults['com.apple.security.application-groups'] || []), group]),
    ];
    return mod;
  });
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const folder = path.join(mod.modRequest.platformProjectRoot, targetName);
    fs.mkdirSync(folder, { recursive: true });
    const sources = fs
      .readdirSync(path.join(__dirname, 'broadcast'))
      .filter((name) => name.endsWith('.swift'));
    for (const name of sources)
      fs.copyFileSync(path.join(__dirname, 'broadcast', name), path.join(folder, name));
    const xml = (inner) =>
      `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${inner}</dict></plist>`;
    fs.writeFileSync(
      path.join(folder, 'Info.plist'),
      xml(`
      <key>CFBundleDisplayName</key><string>VoceSpace Screen Sharing</string>
      <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
      <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
      <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
      <key>CFBundlePackageType</key><string>XPC!</string>
      <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
      <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
      <key>RTCAppGroupIdentifier</key><string>${group}</string>
      <key>NSExtension</key><dict>
        <key>NSExtensionPointIdentifier</key><string>com.apple.broadcast-services-upload</string>
        <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
        <key>NSExtensionAttributes</key><dict><key>RPBroadcastProcessMode</key><string>RPBroadcastProcessModeSampleBuffer</string></dict>
      </dict>`),
    );
    fs.writeFileSync(
      path.join(folder, `${targetName}.entitlements`),
      xml(
        `<key>com.apple.security.application-groups</key><array><string>${group}</string></array>`,
      ),
    );
    const existing = Object.entries(project.pbxNativeTargetSection()).find(
      ([key, value]) =>
        !key.endsWith('_comment') && String(value.name).replaceAll('"', '') === targetName,
    );
    const target = existing
      ? { uuid: existing[0], pbxNativeTarget: existing[1] }
      : project.addTarget(targetName, 'app_extension', targetName, `${bundle}.broadcast`);
    if (!existing) {
      const groupRef = project.addPbxGroup([], targetName, targetName);
      project.addToPbxGroup(groupRef.uuid, project.getFirstProject().firstProject.mainGroup);
      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      for (const name of sources)
        project.addSourceFile(name, { target: target.uuid }, groupRef.uuid);
    }
    const configurations = project.pbxXCBuildConfigurationSection();
    const list = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
    const main =
      project.pbxXCConfigurationList()[project.getFirstTarget().firstTarget.buildConfigurationList];
    for (const item of list.buildConfigurations) {
      const conf = configurations[item.value];
      const parent =
        main.buildConfigurations
          .map((item) => configurations[item.value])
          .find((value) => value.name === conf.name)?.buildSettings || {};
      Object.assign(conf.buildSettings, {
        INFOPLIST_FILE: `${targetName}/Info.plist`,
        CODE_SIGN_ENTITLEMENTS: `${targetName}/${targetName}.entitlements`,
        PRODUCT_BUNDLE_IDENTIFIER: `${bundle}.broadcast`,
        SWIFT_VERSION: '5.0',
        IPHONEOS_DEPLOYMENT_TARGET: '15.1',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        SKIP_INSTALL: 'YES',
        MARKETING_VERSION: config.version || parent.MARKETING_VERSION || '1.0',
        CURRENT_PROJECT_VERSION: config.ios.buildNumber || parent.CURRENT_PROJECT_VERSION || '1',
        CODE_SIGN_STYLE: 'Automatic',
        GENERATE_INFOPLIST_FILE: 'NO',
      });
      if (parent.DEVELOPMENT_TEAM) conf.buildSettings.DEVELOPMENT_TEAM = parent.DEVELOPMENT_TEAM;
    }
    return mod;
  });
};
