// Build the final self-contained HTML: precompile JSX, inline plain JS, drop babel CDN.
// Source (editable, with text/babel) -> deliverable (compiled, runs without babel).
const fs = require('fs');
const Babel = require('/tmp/node_modules/@babel/standalone');

const srcPath = '/home/z/my-project/scripts/fault-to-recovery.src.html';
const outPath = '/home/z/my-project/download/fault-to-recovery.html';
let html = fs.readFileSync(srcPath, 'utf8');

// 1. Extract the text/babel script block.
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error('No text/babel script found'); process.exit(2); }
const code = m[1];

// 2. Compile with classic React runtime (React.createElement, no imports).
const compiled = Babel.transform(code, { presets: [['react', { runtime: 'classic' }]] }).code;

// 3. Replace the babel script block with a plain inline script.
const newScriptTag = '<script>\n' + compiled + '\n</script>';
html = html.replace(m[0], newScriptTag);

// 4. Remove the babel standalone CDN <script> line (no longer needed).
html = html.replace(/<script src="https:\/\/unpkg\.com\/@babel\/standalone\/babel\.min\.js"><\/script>\n?/, '');

fs.writeFileSync(outPath, html);
console.log('Final HTML written to', outPath);
console.log('HTML size:', html.length, 'bytes | Compiled JS size:', compiled.length);

