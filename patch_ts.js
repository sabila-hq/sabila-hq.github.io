const fs = require('fs');
const path = require('path');

// 1. Fix aiService.ts
let aiServicePath = path.join(__dirname, 'src/main/aiService.ts');
let aiServiceContent = fs.readFileSync(aiServicePath, 'utf8');
aiServiceContent = aiServiceContent.replace(/catch\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*\{/g, 'catch ($1: any) {');
fs.writeFileSync(aiServicePath, aiServiceContent, 'utf8');
console.log('Fixed aiService.ts catch statements.');

// 2. Fix Settings.tsx window.api
let settingsPath = path.join(__dirname, 'src/renderer/src/pages/Settings.tsx');
let settingsContent = fs.readFileSync(settingsPath, 'utf8');
settingsContent = settingsContent.replace(/window\.api/g, '(window as any).api');
fs.writeFileSync(settingsPath, settingsContent, 'utf8');
console.log('Fixed Settings.tsx window.api references.');

// 3. Fix translations.ts missing keys
let translationsPath = path.join(__dirname, 'src/renderer/src/translations.ts');
let translationsContent = fs.readFileSync(translationsPath, 'utf8');

// The file exports `export const translations = { ... };`
// Let's extract the object by removing the export declaration temporarily, eval it, and then...
// Wait, we can't eval it because it has TypeScript types if any. But translations.ts is mostly an object literal.
// Let's use a regex approach to extract keys from `id` or `en` block and inject missing ones into others.
let blockRegex = /([a-z]{2}):\s*\{([\s\S]*?)\}(?=\s*,|\s*\})/g;
let blocks = {};
let match;
while ((match = blockRegex.exec(translationsContent)) !== null) {
  blocks[match[1]] = match[2];
}

if (blocks['en'] && blocks['id']) {
  // Find all keys in id and en
  let keys = new Set();
  let keyRegex = /^\s*([a-zA-Z0-9_]+)\s*:/gm;
  let keyMap = {};
  
  [blocks['en'], blocks['id']].forEach(block => {
    let kmatch;
    while ((kmatch = keyRegex.exec(block)) !== null) {
      keys.add(kmatch[1]);
    }
  });

  // For each language, find missing keys and add them with English/ID translation as fallback
  for (let lang in blocks) {
    if (lang === 'id' || lang === 'en') continue; // assuming they are mostly complete
    
    let langBlock = blocks[lang];
    let langKeys = new Set();
    let kmatch;
    while ((kmatch = keyRegex.exec(langBlock)) !== null) {
      langKeys.add(kmatch[1]);
    }

    let toAppend = [];
    keys.forEach(k => {
      if (!langKeys.has(k)) {
        // find the line in en or id
        let lineRegex = new RegExp('^\\s*' + k + '\\s*:.*$', 'm');
        let lineMatch = lineRegex.exec(blocks['en']) || lineRegex.exec(blocks['id']);
        if (lineMatch) {
          toAppend.push('    ' + lineMatch[0].trim());
        }
      }
    });

    if (toAppend.length > 0) {
      let replacement = langBlock.trimEnd() + '\n\n    // Added automatically\n' + toAppend.join('\n') + '\n  ';
      translationsContent = translationsContent.replace(langBlock, replacement);
      console.log(`Added ${toAppend.length} missing keys to language: ${lang}`);
    }
  }
  
  // also add missing keys to 'id' or 'en' if one of them has it and the other doesn't
  ['id', 'en'].forEach(lang => {
    let otherLang = lang === 'id' ? 'en' : 'id';
    let langBlock = blocks[lang];
    let langKeys = new Set();
    let kmatch;
    while ((kmatch = keyRegex.exec(langBlock)) !== null) {
      langKeys.add(kmatch[1]);
    }
    let toAppend = [];
    keys.forEach(k => {
      if (!langKeys.has(k)) {
        let lineRegex = new RegExp('^\\s*' + k + '\\s*:.*$', 'm');
        let lineMatch = lineRegex.exec(blocks[otherLang]);
        if (lineMatch) {
          toAppend.push('    ' + lineMatch[0].trim());
        }
      }
    });
    if (toAppend.length > 0) {
      let replacement = langBlock.trimEnd() + '\n\n    // Added automatically\n' + toAppend.join('\n') + '\n  ';
      translationsContent = translationsContent.replace(langBlock, replacement);
      console.log(`Added ${toAppend.length} missing keys to language: ${lang}`);
    }
  });

  fs.writeFileSync(translationsPath, translationsContent, 'utf8');
} else {
  console.log('Could not find en or id blocks.');
}
