var fs = require('fs');
var path = require('path');

console.log();
console.log('update metadata');

var package = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

var p = path.join(__dirname, '..', 'dist', 'index.js');
var index = fs.readFileSync(p, 'utf-8');
index = index.replace(/const\s+version\s*=\s*'[^']*'\s*;/, `const version = '${package.version}';`);
console.log(`> version: ${package.version}`)

fs.writeFileSync(p, index);