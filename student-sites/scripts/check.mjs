import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p)}}
await walk(root);
const errors=[];let links=0;
for(const p of files.filter(p=>p.endsWith('.html'))){const html=await fs.readFile(p,'utf8');if(!html.includes('lang="ru"')||!html.includes('name="viewport"'))errors.push(p+': metadata');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);if(ids.length!==new Set(ids).size)errors.push(p+': duplicate id');for(const m of html.matchAll(/\b(?:href|src|action)="([^"]+)"/g)){const ref=m[1];if(/^(?:mailto:|https?:)/.test(ref))continue;const [part,hash]=ref.split('#');const target=part?path.resolve(path.dirname(p),decodeURIComponent(part.split('?')[0])):p;try{await fs.access(target);if(hash){const h=await fs.readFile(target,'utf8');if(!h.includes('id="'+hash+'"'))errors.push(p+': anchor '+ref)}}catch{errors.push(p+': missing '+ref)}links++}}
for(let n=1;n<=20;n++){const p=path.join(root,'variants','variant-'+String(n).padStart(2,'0')+'.html');const h=await fs.readFile(p,'utf8');if((h.match(/<li>/g)||[]).length!==20)errors.push(p+': expected 20 tasks')}
console.log(JSON.stringify({html:files.filter(p=>p.endsWith('.html')).length,links,errors},null,2));if(errors.length)throw Error('Validation failed');
