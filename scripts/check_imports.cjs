const fs = require('fs');
const Babel = require('/tmp/node_modules/@babel/standalone');
const html = fs.readFileSync('/home/z/my-project/download/fault-to-recovery.html', 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
const code = m[1];
// Force classic runtime so output uses React.createElement (no jsx-runtime import)
const out = Babel.transform(code, { presets: [['react', { runtime: 'classic' }]] }).code;
const importMatches = out.match(/\bimport\b/g) || [];
const jsxRuntime = (out.match(/jsx-runtime/g) || []).length;
const rce = (out.match(/React\.createElement/g) || []).length;
console.log('imports:', importMatches.length, '| jsx-runtime refs:', jsxRuntime, '| React.createElement refs:', rce, '| len:', out.length);
fs.writeFileSync('/home/z/my-project/scripts/compiled.js', out);
console.log('Wrote compiled.js');
