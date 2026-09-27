import {preview} from 'vite';import config from './frontend-config.mjs';const server=await preview({...config,preview:{host:'127.0.0.1',port:4173,strictPort:true}});server.printUrls();
