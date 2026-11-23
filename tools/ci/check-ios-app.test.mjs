import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";

it("validates distinct native iPad and iPhone targets, rotation and complete payloads", () => {
  const result = spawnSync("python3", ["-c", `
import os, runpy, tempfile, plistlib
from pathlib import Path
inspect = runpy.run_path('tools/ci/check-ios-app.py')['inspect_app']
with tempfile.TemporaryDirectory() as folder:
    app = Path(folder)
    info = {'UIDeviceFamily': [1], 'CFBundleIdentifier': 'app.soireecrew.mobile', 'CFBundleExecutable': 'Crew', 'MinimumOSVersion': '16.4'}
    info['CrewStartupDiagnosticsVersion'] = 1
    info['UIApplicationSceneManifest'] = {'UISceneConfigurations': {'UIWindowSceneSessionRoleApplication': [{'UISceneDelegateClassName': 'SceneDelegate'}]}}
    def save():
        (app / 'Info.plist').write_bytes(plistlib.dumps(info))
    save()
    (app / 'Crew').write_bytes(b'binary')
    (app / 'main.jsbundle').write_bytes(b'bundle')
    assert inspect(app)['deviceFamily'] == [1]
    assert inspect(app)['startupDiagnostics'] == 1
    scene = info['UIApplicationSceneManifest']['UISceneConfigurations']['UIWindowSceneSessionRoleApplication'][0]
    scene['UISceneDelegateClassName'] = 'Crew.SceneDelegate'
    save()
    try:
        inspect(app)
        raise AssertionError('Mismatched Objective-C scene delegate accepted')
    except ValueError:
        pass
    scene['UISceneDelegateClassName'] = 'SceneDelegate'
    info['CrewStartupDiagnosticsVersion'] = 0
    save()
    try:
        inspect(app)
        raise AssertionError('Missing native diagnostics accepted')
    except ValueError:
        pass
    info['CrewStartupDiagnosticsVersion'] = 1
    save()
    assert inspect(app, 'iphone', 'public')['channel'] == 'public'
    try:
        inspect(app, 'iphone', 'preview')
        raise AssertionError('Preview accepted with public bundle ID')
    except ValueError:
        pass
    info['CFBundleIdentifier'] = 'app.soireecrew.mobile.preview'
    save()
    assert inspect(app, 'iphone', 'preview')['channel'] == 'preview'
    info.update(CFBundleShortVersionString='0.2.12', CFBundleVersion='310')
    save()
    project = '12345678-1234-1234-1234-123456789012'
    os.environ['CREW_EXPO_PROJECT_ID'] = project
    expo = {
        'EXUpdatesEnabled': True, 'EXUpdatesURL': f'https://u.expo.dev/{project}',
        'EXUpdatesRequestHeaders': {'expo-channel-name': 'preview-iphone'},
        'EXUpdatesRuntimeVersion': 'crew-preview-iphone-310',
        'EXUpdatesCheckOnLaunch': 'ALWAYS', 'EXUpdatesLaunchWaitMs': 0,
    }
    (app / 'Expo.plist').write_bytes(plistlib.dumps(expo))
    assert inspect(app, 'iphone', 'preview')['updates']['runtime'] == 'crew-preview-iphone-310'
    expo['EXUpdatesRequestHeaders']['expo-channel-name'] = 'public-iphone'
    (app / 'Expo.plist').write_bytes(plistlib.dumps(expo))
    try:
        inspect(app, 'iphone', 'preview')
        raise AssertionError('Public OTA channel accepted in Preview')
    except ValueError:
        pass
    del os.environ['CREW_EXPO_PROJECT_ID']
    info['CFBundleIdentifier'] = 'app.soireecrew.mobile'
    info['UIDeviceFamily'] = [2]
    info['UISupportedInterfaceOrientations~ipad'] = ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
    save()
    assert inspect(app, 'ipad')['ipadMode'] == 'native tablet'
    try:
        inspect(app, 'iphone')
        raise AssertionError('Tablet accepted as phone target')
    except ValueError:
        pass
    info['UIDeviceFamily'] = [1]
    save()
    try:
        inspect(app, 'ipad')
        raise AssertionError('Phone compatibility app accepted as native tablet')
    except ValueError:
        pass
    info['UIDeviceFamily'] = [2]
    info['UISupportedInterfaceOrientations~ipad'] = ['UIInterfaceOrientationPortrait']
    save()
    try:
        inspect(app, 'ipad')
        raise AssertionError('Tablet without landscape accepted')
    except ValueError:
        pass
    info['UIDeviceFamily'] = [1]
    save()
    (app / 'main.jsbundle').write_bytes(b'')
    try:
        inspect(app)
        raise AssertionError('Empty JavaScript bundle accepted')
    except ValueError:
        pass
`], { encoding: "utf8" });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});
