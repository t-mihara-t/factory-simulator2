const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
for(const page of ['index.html','proposal.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert(html.includes('lang="ja"'));assert(html.includes('name="viewport"'));
 for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){const ref=m[1];if(/^(https?:|data:|\.\/)/.test(ref))continue;assert(fs.existsSync(path.join(root,ref.split('#')[0])),`${page} missing ${ref}`);}
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
for(const m of app.matchAll(/\$\('([a-z][a-z0-9-]+)'\)/g)){if(m[1]==='events-placeholder')continue;assert(html.includes(`id="${m[1]}"`),`Unknown control ${m[1]}`);}
for(const asset of ['assets/factory-buildings.png','assets/trains-v08.png','assets/worker-v08.png','assets/sunny-assembly.wav'])assert(fs.statSync(path.join(root,asset)).size>100);
assert(!fs.readFileSync(path.join(root,'style.css'),'utf8').includes('@import'));
console.log('Static entrypoints, controls and local assets verified.');
