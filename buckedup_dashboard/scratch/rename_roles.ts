import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../');

const INCLUDED_EXTS = new Set(['.ts', '.tsx']);
const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.git', 'scratch', 'public', '.agents', '.gemini']);

function processDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        processDirectory(fullPath);
      }
    } else {
      const ext = path.extname(entry.name);
      if (INCLUDED_EXTS.has(ext)) {
        processFile(fullPath);
      }
    }
  }
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;

  // Replace function names
  newContent = newContent
    .replace(/\bcreateBuckyActionTools\b/g, 'createBuckySuperAdminActionTools')
    .replace(/\bcreateBuckyLeadActionTools\b/g, 'createBuckyAdminActionTools');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

processDirectory(rootDir);
console.log('Done fixing function names!');
