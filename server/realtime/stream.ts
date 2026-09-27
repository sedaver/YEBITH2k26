import type {Request,Response} from 'express';
import type {DB} from '../database/db';
import {ApiError} from '../utils/errors';
export class LiveStream {
 private clients=new Map<Response,string>();private revision='';private timer:ReturnType<typeof setTimeout>|undefined;private closed=false;
 constructor(private db:DB,private interval=1000){}
 connect(req:Request,res:Response){const ip=req.ip||'unknown';if(this.clients.size>=2000||[...this.clients.values()].filter(v=>v===ip).length>=250)throw new ApiError(429,'TOO_MANY_CONNECTIONS','Too many live connections.');res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();res.write('retry: 3000\ndata: {"refresh":true}\n\n');this.clients.set(res,ip);req.on('close',()=>this.clients.delete(res));}
 async tick(){const {rows}=await this.db.query<{value:string}>('SELECT value::text FROM festival.revision WHERE id=1');const next=rows[0].value;if(next!==this.revision){this.revision=next;for(const res of this.clients.keys()){if(!res.write(`id: ${next}\ndata: {"refresh":true}\n\n`)){res.end();this.clients.delete(res);}}}else for(const res of this.clients.keys()){if(!res.write(': heartbeat\n\n')){res.end();this.clients.delete(res);}}}
 start(){const run=async()=>{if(this.closed)return;try{if(this.clients.size)await this.tick();}catch{console.error('Live revision check failed');}if(!this.closed)this.timer=setTimeout(run,this.interval);};void run();}
 close(){this.closed=true;clearTimeout(this.timer);for(const res of this.clients.keys())res.end();this.clients.clear();}
}
