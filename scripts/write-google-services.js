const fs = require('fs');
const path = require('path');

function writeFileFromBase64(envVarName, targetPath) {
  const b64 = process.env[envVarName];
  if (!b64) {
    console.log(`[prebuild] Environment variable ${envVarName} not set — skipping file write.`);
    return;
  }

  try {
    const buffer = Buffer.from(b64, 'base64');
    fs.writeFileSync(targetPath, buffer, { mode: 0o600 });
    console.log(`[prebuild] Wrote file ${targetPath} from env ${envVarName} (size=${buffer.length} bytes)`);
  } catch (err) {
    console.error(`[prebuild] Failed writing ${targetPath}:`, err);
    process.exit(1);
  }
}

// Defensive: print cwd and some env info for debugging in build logs
try {
  console.log('[prebuild] CWD:', process.cwd());
  console.log('[prebuild] ENV keys available:', Object.keys(process.env).filter(k => k.includes('GOOGLE') || k.includes('EAS')).join(', '));
} catch (e) {
  // ignore
}

// Write google-services.json to project root (expected by expo config plugin)
const projectRoot = process.cwd();
const targetGoogleServices = path.join(projectRoot, 'google-services.json');
writeFileFromBase64('GOOGLE_SERVICES_JSON_BASE64', targetGoogleServices);

// Also support iOS GoogleService-Info.plist if needed
const targetPlist = path.join(projectRoot, 'GoogleService-Info.plist');
writeFileFromBase64('GOOGLE_PLIST_BASE64', targetPlist);

console.log('[prebuild] write-google-services.js finished');
process.exit(0);
