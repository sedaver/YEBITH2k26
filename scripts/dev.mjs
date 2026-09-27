import {spawn} from 'node:child_process';
await import('./backend-build.mjs');
const children=[spawn(process.execPath,['build-server/server/index.js'],{stdio:'inherit'}),spawn(process.execPath,['scripts/frontend-dev.mjs'],{stdio:'inherit'})];
let stopping=false;function stop(){if(stopping)return;stopping=true;children.forEach(p=>p.kill());}children.forEach(p=>p.on('exit',code=>{stop();process.exitCode=code??1;}));process.on('SIGINT',stop);process.on('SIGTERM',stop);
