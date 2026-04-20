const fs = require('fs');
const path = 'c:/Users/ANSHUL/BhojAI/BhojAI/apps/frontend/src/app/components/shared.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace function signature
content = content.replace(
  /export function (Icon[A-Za-z]+)\(\{ className = '' \}: \{ className\?: string \}\) \{/g,
  'export function $1({ className = \'\', style }: { className?: string; style?: React.CSSProperties }) {'
);

// Replace `<svg className={className} `
content = content.replace(
  /<svg className=\{className\} /g,
  '<svg className={className} style={style} '
);

// IconStar is a bit different: `export function IconStar({ className = '' }: { className?: string }) {` and `<svg className={className} fill="currentColor" `
content = content.replace(
  /<svg className=\{className\} fill="currentColor"/g,
  '<svg className={className} style={style} fill="currentColor"'
);

fs.writeFileSync(path, content);
console.log('Done!');
