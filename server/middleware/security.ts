import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {Request,Response,RequestHandler,CookieOptions} from 'express';
import type {DB} from '../database/db';
import type {Config} from '../config';
import {ApiError} from '../utils/errors';
export type Admin={id:string;email:string;name:string;role:'admin'|'editor'};
declare global {namespace Express {interface Request {admin?:Admin;}}}
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export function security(db:DB,c:Config){
 const secure=c.NODE_ENV==='production';const sessionName=secure?'__Host-festival_session':'festival_session';const csrfName=secure?'__Host-festival_csrf':'festival_csrf';
 const cookie:CookieOptions={httpOnly:true,secure,sameSite:c.COOKIE_SAME_SITE,path:'/'};
 const csrf=(seed:string)=>createHmac('sha256',c.CSRF_SECRET).update(seed).digest('hex');
 const equal=(a:string,b:string)=>/^[a-f0-9]{64}$/.test(b)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const issueCsrf=(req:Request,res:Response)=>{let seed=req.cookies[csrfName];if(typeof seed!=='string'||!/^[\w-]{43}$/.test(seed)){seed=randomToken();res.cookie(csrfName,seed,{...cookie,maxAge:24*3600000});}return csrf(seed);};
 const protect:RequestHandler=(req,_res,next)=>{if(['GET','HEAD','OPTIONS'].includes(req.method)){next();return;}const origin=req.get('origin');const allowed=[...c.ALLOWED_ORIGINS.split(',').map(s=>s.trim()),'https://www.yebith2k26.in','https://yebith2k26.in'];if(!origin||!allowed.includes(origin))throw new ApiError(403,'ORIGIN_REJECTED','This request origin is not permitted.');const seed=req.cookies[csrfName],token=req.get('x-csrf-token');if(typeof seed!=='string'||typeof token!=='string'||!equal(csrf(seed),token))throw new ApiError(403,'CSRF_REJECTED','Please reload the page and try again.');next();};
 async function session(req:Request){const raw=req.cookies[sessionName];if(typeof raw!=='string'||raw.length>200)return null;const {rows}=await db.query<Admin>(`SELECT a.id,a.email,a.name,a.role FROM festival.sessions s JOIN festival.admin_users a ON a.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.is_active`,[hash(raw)]);return rows[0]??null;}
 const requireAdmin:RequestHandler=async(req,_res,next)=>{const admin=await session(req);if(!admin)throw new ApiError(401,'UNAUTHORIZED','Please sign in to continue.');req.admin=admin;next();};
 const adminOnly:RequestHandler=(req,_res,next)=>{if(req.admin?.role!=='admin')throw new ApiError(403,'FORBIDDEN','Only administrators can manage houses or festival settings.');next();};
 async function establish(req:Request,res:Response,id:string){const token=randomToken();await db.transaction(async tx=>{if(typeof req.cookies[sessionName]==='string')await tx.query('DELETE FROM festival.sessions WHERE token_hash=$1',[hash(req.cookies[sessionName])]);await tx.query(`INSERT INTO festival.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+$3::int*interval '1 hour')`,[hash(token),id,c.SESSION_HOURS]);});res.cookie(sessionName,token,{...cookie,maxAge:c.SESSION_HOURS*3600000});}
 async function logout(req:Request,res:Response){if(typeof req.cookies[sessionName]==='string')await db.query('DELETE FROM festival.sessions WHERE token_hash=$1',[hash(req.cookies[sessionName])]);res.clearCookie(sessionName,cookie);res.clearCookie(csrfName,cookie);}
 const limit=(scope:string,max:number,seconds:number):RequestHandler=>async(req,res,next)=>{const identity=scope==='login-email'?String(req.body?.email??'').trim().toLowerCase():req.admin?.id||req.ip||'unknown';const key=scope+':'+hash(identity);const result=await db.query<{hits:number}>(`INSERT INTO festival.rate_limits(key,hits,expires_at) VALUES($1,1,now()+$2::int*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN festival.rate_limits.expires_at<=now() THEN 1 ELSE festival.rate_limits.hits+1 END,expires_at=CASE WHEN festival.rate_limits.expires_at<=now() THEN excluded.expires_at ELSE festival.rate_limits.expires_at END RETURNING hits`,[key,seconds]);if(result.rows[0].hits>max){res.set('Retry-After',String(seconds));throw new ApiError(429,'RATE_LIMITED','Too many requests. Please wait and try again.');}next();};
 return {session,issueCsrf,protect,requireAdmin,adminOnly,establish,logout,limit};
}
