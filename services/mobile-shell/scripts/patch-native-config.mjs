#!/usr/bin/env node
/**
 * RNOS-M3 — Idempotent patch: Android deep links + iOS Associated Domains (when platforms exist).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'RNOS-M3-DEEP-LINK';

function patchAndroidManifest() {
  const manifestPath = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!existsSync(manifestPath)) {
    console.log('SKIP  android/AndroidManifest.xml (run cap add android first)');
    return false;
  }

  let xml = readFileSync(manifestPath, 'utf8');
  if (xml.includes(marker)) {
    console.log('OK    Android deep-link intent filters already patched');
    return true;
  }

  const snippet = readFileSync(join(root, 'resources', 'android', 'deep-link-intent-filter.snippet.xml'), 'utf8')
    .replace(/<\?xml[^>]*>\s*/i, '')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .trim()
    .replace(/^/gm, '            ')
    .replace(/\n/g, '\n');

  const block = `\n            <!-- ${marker} -->\n${snippet}\n`;
  const updated = xml.replace(/(\s*<\/activity>)/, `${block}$1`);
  if (updated === xml) {
    console.error('FAIL  Could not insert Android intent filters');
    process.exit(1);
  }
  writeFileSync(manifestPath, updated);
  console.log('OK    Android AndroidManifest.xml patched (deep links + app links)');
  return true;
}

function patchIosEntitlements() {
  const entPath = join(root, 'ios', 'App', 'App', 'App.entitlements');
  const templatePath = join(root, 'resources', 'ios', 'App.entitlements.template.plist');
  if (!existsSync(join(root, 'ios', 'App', 'App', 'Info.plist'))) {
    console.log('SKIP  ios App.entitlements (run cap add ios on macOS + Xcode first)');
    return false;
  }

  if (!existsSync(entPath) && existsSync(templatePath)) {
    writeFileSync(entPath, readFileSync(templatePath, 'utf8'));
    console.log('OK    Created ios/App/App/App.entitlements from template');
  }

  if (!existsSync(entPath)) {
    console.log('SKIP  ios App.entitlements file missing');
    return false;
  }

  let xml = readFileSync(entPath, 'utf8');
  const domain = 'applinks:portal.pttads.vn';
  if (xml.includes(domain)) {
    console.log('OK    iOS Associated Domains configured in App.entitlements');
  } else {
    const insert = `\t<key>com.apple.developer.associated-domains</key>\n\t<array>\n\t\t<string>${domain}</string>\n\t</array>\n`;
    writeFileSync(entPath, xml.replace('</dict>', `${insert}</dict>`));
    console.log('OK    iOS Associated Domains patched:', domain);
  }

  patchIosXcodeproj(entPath);
  return true;
}

function patchIosXcodeproj(entitlementsPath) {
  const pbxPath = join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  if (!existsSync(pbxPath)) return;
  let pbx = readFileSync(pbxPath, 'utf8');
  const setting = 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;';
  if (pbx.includes(setting)) {
    console.log('OK    Xcode project CODE_SIGN_ENTITLEMENTS set');
    return;
  }
  const updated = pbx.replace(
    /INFOPLIST_FILE = App\/Info.plist;\n/g,
    `INFOPLIST_FILE = App/Info.plist;\n\t\t\t\t${setting}\n`,
  );
  if (updated === pbx) {
    console.log('WARN  Could not patch project.pbxproj CODE_SIGN_ENTITLEMENTS — set in Xcode');
    return;
  }
  writeFileSync(pbxPath, updated);
  console.log('OK    Xcode project linked App.entitlements');
}

function patchIosInfoPlist() {
  const candidates = [
    join(root, 'ios', 'App', 'App', 'Info.plist'),
    join(root, 'ios', 'App', 'Info.plist'),
  ];
  const plistPath = candidates.find((p) => existsSync(p));
  if (!plistPath) {
    console.log('SKIP  ios Info.plist');
    return false;
  }

  let xml = readFileSync(plistPath, 'utf8');
  if (xml.includes('pttads')) {
    console.log('OK    iOS URL scheme pttads present');
    return true;
  }

  const urlTypes = `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>vn.pttads.portal</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>pttads</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`;
  const updated = xml.replace('</dict>\n</plist>', `${urlTypes}</dict>\n</plist>`);
  if (updated === xml) {
    console.log('WARN  Could not auto-patch Info.plist — set CFBundleURLSchemes manually');
    return false;
  }
  writeFileSync(plistPath, updated);
  console.log('OK    iOS Info.plist URL scheme pttads patched');
  return true;
}

console.log('== patch-native-config ==');
patchAndroidManifest();
patchIosEntitlements();
patchIosInfoPlist();
