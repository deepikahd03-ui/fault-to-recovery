const fs = require('fs');
const Babel = require('/tmp/node_modules/@babel/standalone');
const html = fs.readFileSync('/home/z/my-project/download/fault-to-recovery.html', 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
const code = m[1];
const out = Babel.transform(code, { presets: ['react'] }).code;
const imports = out.match(/\bimport\b/g) || [];
const exports = out.match(/\bexport\b/g) || [];
console.log('import count:', imports.length, 'export count:', exports.length);
// Show first occurrence context if any
const idx = out.search(/\b(import|export)\b/);
if (idx >= 0) console.log('Context:', out.slice(Math.max(0, idx - 120), idx + 120));
console.log('Output length:', out.length);
