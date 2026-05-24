const fs = require("fs");
const path = require("path");

function writeFileFromBase64(envVarName, targetPath) {
  const b64 = process.env[envVarName];
  if (!b64) {
    console.log(
      `Environment variable ${envVarName} not set — skipping file write.`,
    );
    return;
  }

  try {
    const buffer = Buffer.from(b64, "base64");
    fs.writeFileSync(targetPath, buffer);
    console.log(`Wrote file ${targetPath} from env ${envVarName}`);
  } catch (err) {
    console.error(`Failed writing ${targetPath}:`, err);
    process.exit(1);
  }
}

// Write google-services.json to project root (expected by expo config plugin)
const projectRoot = process.cwd();
const targetGoogleServices = path.join(projectRoot, "google-services.json");
writeFileFromBase64("GOOGLE_SERVICES_JSON_BASE64", targetGoogleServices);

// Also support iOS GoogleService-Info.plist if needed
const targetPlist = path.join(projectRoot, "GoogleService-Info.plist");
writeFileFromBase64("GOOGLE_PLIST_BASE64", targetPlist);
