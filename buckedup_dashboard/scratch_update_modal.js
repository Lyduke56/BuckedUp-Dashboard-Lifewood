const fs = require('fs');
const file = 'components/organisms/RequestVideoModal.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/bg-white\/\[0\.02\]/g, 'bg-[var(--glass-bg)]');
c = c.replace(/bg-white\/\[0\.03\]/g, 'bg-[var(--glass-bg)]');
c = c.replace(/bg-\[\#0e1512\]/g, 'bg-[var(--glass-bg)]');
c = c.replace(/bg-black\/30/g, 'bg-[var(--glass-bg)]');
c = c.replace(/bg-black\/40/g, 'bg-[var(--glass-bg)]');
c = c.replace(/bg-white\/5(?![0-9])/g, 'bg-[var(--glass-bg)]');
c = c.replace(/hover:bg-white\/5/g, 'hover:bg-[var(--glass-hover)]');
c = c.replace(/hover:bg-white\/10/g, 'hover:bg-[var(--glass-hover)]');
c = c.replace(/border-white\/10/g, 'border-[var(--glass-border)]');
c = c.replace(/border-white\/5/g, 'border-[var(--glass-border)]');
c = c.replace(/text-white(?! flex-shrink-0 shadow-md)/g, 'text-[var(--text-main)]');
c = c.replace(/placeholder-white\/30/g, 'placeholder:text-[var(--ink-soft)]');
c = c.replace(/hover:text-white/g, 'hover:text-[var(--text-main)]');

fs.writeFileSync(file, c);
console.log("Updated styles in modal");
