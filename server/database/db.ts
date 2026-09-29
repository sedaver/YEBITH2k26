import pg from 'pg';
import {existsSync, readFileSync} from 'node:fs';
export interface DB { query<T = Record<string, any>>(sql: string, values?: any[]): Promise<{rows:T[]; rowCount?:number|null}>; transaction<T>(fn:(db:DB)=>Promise<T>):Promise<T>; }
export function database(connectionString:string, ca?:string): DB & {close:()=>Promise<void>} {
 const certificate=ca&&existsSync(ca)?readFileSync(ca,'utf8'):ca;
 // Supabase session-mode poolers commonly cap a project at 15 clients. Keep
 // the application pool below that limit so rolling restarts cannot exhaust it.
 const pool=new pg.Pool({connectionString,max:4,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,
  ...(certificate?{ssl:{ca:certificate,rejectUnauthorized:true}}:{}),options:'-c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000'});
 pool.on('error',error=>console.error('Database connection error',error.message));
 const wrap=(q:typeof pool.query):DB=>({query:(sql,values)=>q(sql,values) as any,transaction:async fn=>{
  const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(wrap(client.query.bind(client) as typeof pool.query));await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }});
 return {...wrap(pool.query.bind(pool)),close:()=>pool.end()};
}
