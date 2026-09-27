import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import {z} from 'zod';
import path from 'node:path';
import type {Config} from './config';
import type {DB} from './database/db';
import {Repository,type Entity} from './database/repository';
import type {AuthProvider} from './auth/provider';
import {security} from './middleware/security';
import {ImageService,type ObjectStore} from './storage/images';
import {LiveStream} from './realtime/stream';
import {ApiError,ok,errorHandler} from './utils/errors';
import {uuid,queryInput,houseInput,eventInput,resultInput,galleryInput,settingsInput} from './validation';
export function createApp(deps:{db:DB;config:Config;auth:AuthProvider;store:ObjectStore}){
 const {db,config:c,auth,store}=deps;const app=express();const repo=new Repository(db);const sec=security(db,c);const images=new ImageService(db,store);const live=new LiveStream(db);
 app.disable('x-powered-by');app.set('trust proxy',c.TRUST_PROXY_HOPS);
 app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'},contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'https:','blob:','data:'],connectSrc:["'self'",c.SUPABASE_URL,...c.ALLOWED_ORIGINS.split(',').map(s=>s.trim())],objectSrc:["'none'"],frameAncestors:["'none'"]}}}));
 const origins=c.ALLOWED_ORIGINS.split(',').map(s=>s.trim());
 app.use('/api',cors({origin:(origin,cb)=>cb(null,!origin||origins.includes(origin)),credentials:true,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token'],maxAge:600}));
 app.use('/api',express.json({limit:'32kb'}),cookieParser(),sec.protect);
 const api=express.Router();app.use('/api',api);
 api.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 api.get('/health',async(_req,res)=>{await db.query('SELECT 1');ok(res,{status:'ok'});});
 api.use(sec.limit('api',6000,60));
 api.get('/auth/csrf',(req,res)=>{res.set('Cache-Control','no-store');ok(res,{csrfToken:sec.issueCsrf(req,res)});});
 api.get('/auth/session',async(req,res)=>{res.set('Cache-Control','no-store');ok(res,{user:await sec.session(req)});});
 api.post('/auth/login',sec.limit('login-ip',20,900),sec.limit('login-email',10,900),async(req,res)=>{
  const input=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(256)}).strict().parse(req.body);
  const identity=await auth.login(input.email,input.password);
  if(!identity)throw new ApiError(401,'INVALID_LOGIN','Incorrect email or password.');
  const {rows}=await db.query('SELECT id,email,name,role FROM festival.admin_users WHERE id=$1 AND is_active',[identity.id]);
  if(!rows[0])throw new ApiError(403,'FORBIDDEN','This account does not have festival administration access.');
  await sec.establish(req,res,identity.id);res.set('Cache-Control','no-store');ok(res,{user:rows[0]});
 });
 api.post('/auth/logout',async(req,res)=>{await sec.logout(req,res);ok(res,null);});
 api.post('/auth/reset-password',sec.limit('reset',5,3600),async(req,res)=>{
  const {email}=z.object({email:z.string().trim().email().max(254)}).strict().parse(req.body);
  // Same response for unknown addresses; reset links never grant an admin role.
  try{await auth.reset(email);}catch{console.error('Password reset provider request failed');}ok(res,{message:'If the address is registered, a reset link will be sent.'});
 });
 api.post('/auth/change-password',sec.limit('password-change',10,3600),async(req,res)=>{
  const {token,password}=z.object({token:z.string().min(20).max(8000),password:z.string().min(12).max(128)}).strict().parse(req.body);
  const id=await auth.changePassword(token,password);if(!id)throw new ApiError(401,'INVALID_RESET','The reset link has expired. Request another link.');await db.query('DELETE FROM festival.sessions WHERE user_id=$1',[id]);await sec.logout(req,res);ok(res,null);
 });
 api.get('/live',(req,res)=>live.connect(req,res));
 api.get('/leaderboard',async(_req,res)=>ok(res,await repo.leaderboard()));
 api.get('/scores/breakdown',async(_req,res)=>ok(res,await repo.breakdown()));
 api.get('/settings',async(_req,res)=>ok(res,await repo.settings()));
 api.patch('/settings',sec.requireAdmin,sec.adminOnly,async(req,res)=>ok(res,await repo.saveSettings(settingsInput.parse(req.body),req.admin!.id)));
 api.get('/admin/stats',sec.requireAdmin,async(_req,res)=>{res.set('Cache-Control','no-store');ok(res,await repo.stats());});
 api.get('/houses',async(req,res)=>{const q=queryInput.parse(req.query);ok(res,await repo.houses(q.active===undefined?undefined:q.active==='true'));});
 for(const kind of ['events','results','gallery'] as const)api.get('/'+kind,async(req,res)=>ok(res,await repo.list(kind,queryInput.parse(req.query))));
 for(const kind of ['houses','events','results','gallery'] as Entity[]){
  api.get('/'+kind+'/:id',async(req,res)=>ok(res,await repo.one(kind,uuid.parse(req.params.id))));
  const schema=kind==='houses'?houseInput:kind==='events'?eventInput:kind==='results'?resultInput:galleryInput;
  const access=kind==='houses'?[sec.requireAdmin,sec.adminOnly]:[sec.requireAdmin];
  if(kind!=='gallery')api.post('/'+kind,...access,async(req,res)=>ok(res,await repo.write(kind,null,schema.parse(req.body),req.admin!.id),201));
  api.patch('/'+kind+'/:id',...access,async(req,res)=>ok(res,await repo.write(kind,uuid.parse(req.params.id),schema.partial().parse(req.body),req.admin!.id)));
  api.delete('/'+kind+'/:id',...access,async(req,res)=>{const id=uuid.parse(req.params.id);if(kind==='gallery')await images.removeObjectsForDeleted(id,req.admin!.id);else await repo.remove(kind,id,req.admin!.id);ok(res,null);});
 }
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:1,fieldSize:4096,parts:2},fileFilter:(_req,file,cb)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.mimetype)){cb(new ApiError(400,'INVALID_IMAGE','Choose a JPEG, PNG or WebP image.'));return;}cb(null,true);}});
 let uploading=0;
 api.post('/gallery',sec.requireAdmin,sec.limit('upload',60,3600),(req,res,next)=>{
  if(uploading>=4)throw new ApiError(429,'UPLOAD_BUSY','Uploads are busy. Please try again shortly.');
  uploading++;let released=false;const release=()=>{if(!released){released=true;uploading--;}};res.once('finish',release);res.once('close',release);next();
 },upload.single('image'),async(req,res)=>{
  if(!req.file)throw new ApiError(400,'INVALID_IMAGE','Choose an image.');let metadata:unknown;try{metadata=JSON.parse(req.body.metadata);}catch{throw new ApiError(400,'VALIDATION_ERROR','Image metadata must be valid JSON.');}
  ok(res,await images.upload(req.file,galleryInput.parse(metadata),req.admin!.id),201);
 });
 api.use((_req,_res)=>{throw new ApiError(404,'NOT_FOUND','API endpoint not found.');});
 if(c.NODE_ENV==='production'){
  const dist=path.resolve('dist');app.use(express.static(dist,{index:false,maxAge:'1h',setHeaders:(res,file)=>{if(file.includes(path.sep+'assets'+path.sep))res.setHeader('Cache-Control','public,max-age=31536000,immutable');}}));
  app.get('/{*path}',(_req,res)=>{res.set('Cache-Control','no-cache');res.sendFile(path.join(dist,'index.html'));});
 }
 app.use(errorHandler);return {app,live,images};
}
