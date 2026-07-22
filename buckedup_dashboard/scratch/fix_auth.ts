import fs from 'fs';
import path from 'path';

const files = [
  'app/api/super-admin/create-user/route.ts',
  'app/api/super-admin/users/[id]/route.ts'
];

for (const file of files) {
  const filePath = path.resolve(__dirname, '../', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content.replace(/\.auth\.super-admin\./g, '.auth.admin.');
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Fixed: ${file}`);
    }
  }
}
