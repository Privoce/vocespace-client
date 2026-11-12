"""Check the final IPA's ReplayKit metadata before uploading to App Store Connect."""

import plistlib
import sys
import zipfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check(ipa_path):
    with zipfile.ZipFile(ipa_path) as ipa:
        main_paths = [
            name for name in ipa.namelist()
            if name.startswith('Payload/') and name.endswith('.app/Info.plist')
            and name.count('/') == 2
        ]
        require(len(main_paths) == 1, 'Expected one main App Info.plist')
        main_path = main_paths[0]
        app = plistlib.loads(ipa.read(main_path))
        extension_path = main_path.removesuffix('Info.plist') + (
            'PlugIns/VoceSpaceBroadcast.appex/Info.plist'
        )
        extension = plistlib.loads(ipa.read(extension_path))
        metadata = extension.get('NSExtension', {})
        require(
            metadata.get('RPBroadcastProcessMode') == 'RPBroadcastProcessModeSampleBuffer',
            'RPBroadcastProcessMode must be directly under NSExtension and equal '
            'RPBroadcastProcessModeSampleBuffer (not inside NSExtensionAttributes)',
        )
        require(
            'RPBroadcastProcessMode' not in metadata.get('NSExtensionAttributes', {}),
            'Remove the misplaced RPBroadcastProcessMode from NSExtensionAttributes',
        )
        require(
            metadata.get('NSExtensionPointIdentifier') == 'com.apple.broadcast-services-upload',
            'Unexpected broadcast extension point',
        )
        require(
            metadata.get('NSExtensionPrincipalClass', '').endswith('.SampleHandler'),
            'Missing broadcast SampleHandler principal class',
        )
        require(
            extension['CFBundleIdentifier'] == app['CFBundleIdentifier'] + '.broadcast'
            == app.get('RTCScreenSharingExtension'),
            'Main App and broadcast extension identifiers do not match',
        )
        require(
            app.get('RTCAppGroupIdentifier')
            and app['RTCAppGroupIdentifier'] == extension.get('RTCAppGroupIdentifier'),
            'Main App and broadcast extension App Groups do not match',
        )
        for key in ('CFBundleVersion', 'CFBundleShortVersionString'):
            require(app[key] == extension[key], f'Main App / extension {key} mismatch')
        print(
            f"PASS: ReplayKit IPA metadata for {app['CFBundleIdentifier']} "
            f"{app['CFBundleShortVersionString']} ({app['CFBundleVersion']})"
        )


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 scripts/check-ios-broadcast.py PATH_TO_IPA')
    try:
        check(sys.argv[1])
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        sys.exit(f'FAIL: {error}')
