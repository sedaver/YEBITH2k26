import {readConfig} from '../config';
import {database} from '../database/db';
const c=readConfig();if(c.NODE_ENV==='production'||process.env.ALLOW_DEVELOPMENT_SEED!=='yes')throw new Error('Development seed requires NODE_ENV=development and ALLOW_DEVELOPMENT_SEED=yes.');
const db=database(c.DATABASE_URL,c.DATABASE_CA);try{await db.transaction(async tx=>{await tx.query("INSERT INTO festival.houses(name,color) VALUES('Development Red House','#cc3344'),('Development Blue House','#3355cc')");await tx.query("INSERT INTO festival.events(name,category,event_date,status) VALUES('Development Classical Dance','Dance',now(),'upcoming')");});console.log('Development fixtures added. No scores or images were created.');}finally{await db.close();}
