import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readConfig} from '../config';
import {database} from '../database/db';
const c=readConfig(),db=database(c.DATABASE_URL,c.DATABASE_CA);
try{await db.transaction(async tx=>{await tx.query('SELECT pg_advisory_xact_lock(72842601)');await tx.query('CREATE TABLE IF NOT EXISTS public.festival_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');const dir=fileURLToPath(new URL('../database/',import.meta.url));for(const file of (await readdir(dir)).filter(n=>/^\d+.*\.sql$/.test(n)).sort()){if((await tx.query('SELECT name FROM public.festival_migrations WHERE name=$1',[file])).rows.length)continue;await tx.query(await readFile(dir+file,'utf8'));await tx.query('INSERT INTO public.festival_migrations(name) VALUES($1)',[file]);console.log('Applied '+file);}});}finally{await db.close();}
