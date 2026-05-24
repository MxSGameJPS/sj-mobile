const fs = require('fs');
const path = require('path');

function writeGoogleServicesFromEnv() {
  const base64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
  if (!base64) {
    console.log('[app.config] GOOGLE_SERVICES_JSON_BASE64 not set; skipping google-services.json generation.');
    return;
  }

  const targetPath = path.join(__dirname, 'google-services.json');
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(targetPath, buffer, { mode: 0o600 });
  console.log(`[app.config] Wrote ${targetPath} (${buffer.length} bytes)`);
}

writeGoogleServicesFromEnv();

const appJson = require('./app.json');

module.exports = () => appJson;