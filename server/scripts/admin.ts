import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {readConfig} from '../config';
import {database} from '../database/db';
// Password comes from an ignored local file, never a shell argument or source file.
const input=z.object({email:z.string().email(),name:z.string().min(1).max(100),password:z.string().min(12).max(128),role:z.enum(['admin','editor']).default('admin')}).parse(JSON.parse(await readFile(process.env.ADMIN_INPUT_FILE||'.admin-input.json','utf8')));
const c=readConfig(),db=database(c.DATABASE_URL,c.DATABASE_CA);const client=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
try{const {data,error}=await client.auth.admin.createUser({email:input.email,password:input.password,email_confirm:true,user_metadata:{name:input.name}});if(error)throw error;
 try{await db.query('INSERT INTO festival.admin_users(id,email,name,role) VALUES($1,$2,$3,$4)',[data.user.id,input.email.toLowerCase(),input.name,input.role]);}catch(error){await client.auth.admin.deleteUser(data.user.id);throw error;}
 console.log('Administrator created. Delete the local password input file after saving the password securely.');
}finally{await db.close();}
