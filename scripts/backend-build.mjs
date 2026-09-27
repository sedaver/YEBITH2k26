import ts from 'typescript';
import {mkdir,readdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
async function compile(file){
 const target=path.join('build-server',file.replace(/\.ts$/,'.js'));await mkdir(path.dirname(target),{recursive:true});
 if(file.endsWith('.sql')){await copyFile(file,target);return;}
 const source=await readFile(file,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,esModuleInterop:true}}).outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g,(_m,start,specifier,end)=>start+(path.extname(specifier)?specifier:specifier+'.js')+end);
 await writeFile(target,output);
}
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(ts|sql)$/.test(file))await compile(file);}}
await walk('server');await compile('services/models.ts');
console.log('Backend compiled to build-server.');
