const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const legacyUploadDir = path.join(backendRoot, 'backend', 'uploads');
const secondaryLegacyUploadDir = path.join(backendRoot, 'uploads');

function resolveUploadDir() {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }

  return legacyUploadDir;
}

const uploadDir = resolveUploadDir();
fs.mkdirSync(uploadDir, { recursive: true });

const legacyUploadDirs = [legacyUploadDir, secondaryLegacyUploadDir].filter(
  (dir, index, arr) => dir !== uploadDir && arr.indexOf(dir) === index
);

module.exports = {
  uploadDir,
  legacyUploadDirs
};
