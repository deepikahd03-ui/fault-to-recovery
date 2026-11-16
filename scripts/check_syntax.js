// Extract the text/babel script from the HTML and compile with @babel/standalone to catch syntax errors.
const fs = require('fs');
const Babel = require('/tmp/node_modules/@babel/standalone');

const html = fs.readFileSync('/home/z/my-project/download/fault-to-recovery.html', 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error('No babel script block found'); process.exit(2); }
const code = m[1];

try {
  const out = Babel.transform(code, { presets: ['env', 'react'] });
  console.log('BABEL COMPILE OK. Output length:', out.code.length);
} catch (e) {
  console.error('BABEL COMPILE FAILED:');
  console.error(e.message);
  if (e.loc) console.error('Location:', JSON.stringify(e.loc));
  process.exit(1);
}
