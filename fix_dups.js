const fs = require('fs');

const path = 'src/renderer/src/translations.ts';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const result = [];
const seenInCurrentLang = new Set();
let currentLang = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect language block start (e.g. "  en: {")
  const langMatch = line.match(/^  (id|en|su|jv|ar|zh):\s*\{/);
  if (langMatch) {
    currentLang = langMatch[1];
    seenInCurrentLang.clear();
  }

  // Check if line contains a key assignment
  const keyMatch = line.match(/^\s+([a-zA-Z0-9_]+)\s*:/);
  if (keyMatch && currentLang !== '') {
    const key = keyMatch[1];
    
    // Check if we should keep it
    if (seenInCurrentLang.has(key)) {
      // Duplicate, skip this line
      console.log(`Removed duplicate key '${key}' in lang '${currentLang}' at line ${i + 1}`);
      continue;
    } else {
      // First time seeing this key in this lang, keep it
      seenInCurrentLang.add(key);
    }
  }

  result.push(line);
}

fs.writeFileSync(path, result.join('\n'));
console.log('Done!');
