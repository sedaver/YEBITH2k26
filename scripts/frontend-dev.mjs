import {createServer} from 'vite';import config from './frontend-config.mjs';const server=await createServer(config);await server.listen();server.printUrls();
