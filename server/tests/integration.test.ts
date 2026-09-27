import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import request from 'supertest';
import sharp from 'sharp';
import type {DB} from '../database/db';
import type {Config} from '../config';
import {createApp} from '../app';
import type {ObjectStore} from '../storage/images';
import {optimizeImage} from '../storage/images';
import type {AuthProvider} from '../auth/provider';
import {Repository} from '../database/repository';
import {HouseSchema,ProgramCategorySchema,EventSchema,ResultSchema,GallerySchema,RankingEntrySchema,ProgramRankingSchema,SessionSchema,StatsSchema,SettingsSchema,pageSchema} from '../../services/models';

const pg=new PGlite();const wrap=(client:any):DB=>({query:async(sql,values)=>client.query(sql,values),transaction:fn=>client.transaction((tx:any)=>fn(wrap(tx)))});const db=wrap(pg);
const adminId=randomUUID(),editorId=randomUUID(),visitorId=randomUUID();const origin='http://127.0.0.1:5173';
const config:Config={NODE_ENV:'test',PORT:3001,DATABASE_URL:'test-only',SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'test-only',SUPABASE_SERVICE_ROLE_KEY:'test-only',STORAGE_BUCKET:'test',APP_ORIGIN:origin,ALLOWED_ORIGINS:origin,CSRF_SECRET:'test-only-secret-with-at-least-32-characters',SESSION_HOURS:8,TRUST_PROXY_HOPS:0,COOKIE_SAME_SITE:'lax'};
// Only external providers are substituted. SQL, transactions, validation, image decoding,
// session cookies, HTTP routes, permissions and SSE use the actual application code.
const auth:AuthProvider={async login(email,password){if(password!=='test-only-password')return null;return {id:email==='admin@example.test'?adminId:email==='editor@example.test'?editorId:visitorId,email};},async reset(){},async changePassword(token){return token==='test-only-valid-recovery-token'?adminId:null;}};
const objects=new Map<string,Buffer>();let failStorage=false;
const store:ObjectStore={async put(key,buffer){if(failStorage)throw new Error('Test storage failure');objects.set(key,buffer);return 'https://test.supabase.co/storage/v1/object/public/test/'+key;},async remove(keys){keys.forEach(k=>objects.delete(k));}};
const {app,live,images}=createApp({db,config,auth,store});
let admin:ReturnType<typeof request.agent>,csrf:string;
async function agent(email='admin@example.test'){const a=request.agent(app);const c=await a.get('/api/auth/csrf').expect(200);const token=c.body.data.csrfToken;const login=await a.post('/api/auth/login').set('Origin',origin).set('X-CSRF-Token',token).send({email,password:'test-only-password'});return {a,token,login};}
function write(method:'post'|'patch'|'delete',url:string,body?:Record<string,unknown>){const req=admin[method](url).set('Origin',origin).set('X-CSRF-Token',csrf);return body===undefined?req:req.send(body);}
async function house(name='House '+randomUUID()){const r=await write('post','/api/houses',{name,color:'#cc3344',enabled:true,logoUrl:null}).expect(201);HouseSchema.parse(r.body.data);return r.body.data;}
async function event(name='Event '+randomUUID(),programCategory='Other'){const r=await write('post','/api/events',{name,category:'Dance',programCategory,description:'Annual performance',date:'2026-09-27T12:00:00.000Z',status:'upcoming',imageUrl:null,venue:'Main stage'}).expect(201);EventSchema.parse(r.body.data);return r.body.data;}
before(async()=>{await pg.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)');await pg.exec(await readFile(new URL('../database/001_initial.sql',import.meta.url),'utf8'));await pg.exec(await readFile(new URL('../database/002_provider_access.sql',import.meta.url),'utf8'));await db.query("INSERT INTO festival.events(name,category,event_date,status) VALUES('Legacy Programme','Dance','2026-09-27T08:00:00.000Z','upcoming')");await pg.exec(await readFile(new URL('../database/003_program_categories.sql',import.meta.url),'utf8'));await pg.exec(await readFile(new URL('../database/004_candidate_results.sql',import.meta.url),'utf8'));await db.query('INSERT INTO auth.users(id) VALUES($1),($2)',[adminId,editorId]);await db.query("INSERT INTO festival.admin_users(id,email,name,role) VALUES($1,'admin@example.test','Test Admin','admin'),($2,'editor@example.test','Test Editor','editor')",[adminId,editorId]);const result=await agent();admin=result.a;csrf=result.token;assert.equal(result.login.status,200);});
after(async()=>{live.close();await pg.close();});

test('authentication: incorrect login, public visitor, valid session, logout, expiry and role revocation',async()=>{
 const a=request.agent(app);const c=(await a.get('/api/auth/csrf')).body.data.csrfToken;
 await a.post('/api/auth/login').set('Origin',origin).set('X-CSRF-Token',c).send({email:'admin@example.test',password:'wrong'}).expect(401);
 assert.equal((await agent('visitor@example.test')).login.status,403);
 const session=await admin.get('/api/auth/session').expect(200);SessionSchema.parse(session.body.data);assert.equal(session.body.data.user.id,adminId);
 const temp=await agent();await temp.a.post('/api/auth/logout').set('Origin',origin).set('X-CSRF-Token',temp.token).expect(200);assert.equal((await temp.a.get('/api/auth/session')).body.data.user,null);
 await db.query("UPDATE festival.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[editorId]);
 const editor=await agent('editor@example.test');await db.query('UPDATE festival.admin_users SET is_active=false WHERE id=$1',[editorId]);await editor.a.get('/api/admin/stats').expect(401);await db.query('UPDATE festival.admin_users SET is_active=true WHERE id=$1',[editorId]);
 await db.query("UPDATE festival.sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[editorId]);await editor.a.get('/api/admin/stats').expect(401);
});
test('all writes and dashboard reject anonymous users; CSRF and origin are enforced',async()=>{
 const a=request.agent(app),c=(await a.get('/api/auth/csrf')).body.data.csrfToken;
 for(const endpoint of ['houses','events','results','gallery'])await a.post('/api/'+endpoint).set('Origin',origin).set('X-CSRF-Token',c).send({}).expect(401);
 await a.get('/api/admin/stats').expect(401);
 await admin.post('/api/houses').set('Origin',origin).send({}).expect(403);
 await admin.post('/api/houses').set('Origin','https://attacker.test').set('X-CSRF-Token',csrf).send({}).expect(403);
 const cors=await request(app).options('/api/results').set('Origin','https://attacker.test').set('Access-Control-Request-Method','POST');assert.equal(cors.headers['access-control-allow-origin'],undefined);
});
test('editors manage events and results but cannot manage houses or settings',async()=>{
 const {a,token}=await agent('editor@example.test');await a.post('/api/houses').set('Origin',origin).set('X-CSRF-Token',token).send({name:'Forbidden',color:'#ffffff'}).expect(403);
 await a.patch('/api/settings').set('Origin',origin).set('X-CSRF-Token',token).send({}).expect(403);
 await a.post('/api/events').set('Origin',origin).set('X-CSRF-Token',token).send({name:'Editor Event',category:'Music',programCategory:'Group',date:'2026-09-27T12:00:00.000Z',status:'live'}).expect(201);
});
test('program categories migrate legacy data, validate writes and filter programs',async()=>{
 const categories=await request(app).get('/api/program-categories').expect(200);assert.deepEqual(categories.body.data.map((c:any)=>ProgramCategorySchema.parse(c).name),['Individual','Group','Off-Stage','Other']);
 const legacy=await request(app).get('/api/events').query({search:'Legacy Programme'}).expect(200);assert.equal(legacy.body.data.items[0].programCategory,'Other');
 const created=await event('Category Programme','Individual');assert.equal(created.programCategory,'Individual');
 const offStage=await event('Essay Writing','Off-Stage');assert.equal(offStage.programCategory,'Off-Stage');
 await write('patch','/api/events/'+created.id,{programCategory:'Group'}).expect(200);
 const filtered=await request(app).get('/api/events').query({programCategory:'Group',search:'Category Programme'}).expect(200);assert.equal(filtered.body.data.total,1);assert.equal(filtered.body.data.items[0].programCategory,'Group');
 const offStageFiltered=await request(app).get('/api/events').query({programCategory:'Off-Stage'}).expect(200);assert.ok(offStageFiltered.body.data.items.some((x:any)=>x.id===offStage.id));
 await write('patch','/api/events/'+created.id,{programCategory:'Not A Category'}).expect(400);
 await write('post','/api/events',{name:'Missing category',category:'Dance',date:'2026-09-27T12:00:00.000Z',status:'upcoming'}).expect(400);
});
test('acceptance: result add 10, edit 15, delete recalculates official total',async()=>{
 const h=await house('Red House'),e=await event('Classical Dance');
 const result=await write('post','/api/results',{eventId:e.id,houseId:h.id,position:1,points:10}).expect(201);ResultSchema.parse(result.body.data);
 assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,10);
 await write('patch','/api/results/'+result.body.data.id,{points:15}).expect(200);assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,15);
 await write('delete','/api/results/'+result.body.data.id).expect(200);assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,0);
});
test('duplicates, invalid foreign keys, negative points, non-integer position and score tampering rejected',async()=>{
 const h=await house(),e=await event();const data={eventId:e.id,houseId:h.id,position:1,points:10};
 await write('post','/api/results',data).expect(201);await write('post','/api/results',data).expect(409);
 for(const patch of [{eventId:randomUUID()},{points:-1},{position:1.5},{points:Infinity},{position:0},{houseId:'invalid'}])await write('post','/api/results',{...data,...patch}).expect(400);
 await write('patch','/api/houses/'+h.id,{points:99999}).expect(400);
 const before=(await request(app).get('/api/houses/'+h.id)).body.data.points;assert.equal(before,10);
});
test('candidate and team results preserve marks separately from house points across item types',async()=>{
 const h=await house('Candidate House');
 for(const category of ['Individual','Off-Stage','Group']){
  const item=await event('Candidate item '+category,category);
  const data={eventId:item.id,houseId:h.id,category:'Junior',candidateName:'Anu',score:87.5,position:1,points:5};
  const first=ResultSchema.parse((await write('post','/api/results',data).expect(201)).body.data);
  assert.equal(first.candidateName,'Anu');assert.equal(first.score,87.5);assert.equal(first.programCategory,category);
  const second=ResultSchema.parse((await write('post','/api/results',{...data,candidateName:'Binu',score:0,position:2,points:3}).expect(201)).body.data);
  assert.equal(second.score,0);
  await write('post','/api/results',{...data,candidateName:'  ANU  '}).expect(409);
  await write('patch','/api/results/'+second.id,{candidateName:'anu'}).expect(409);
  for(const patch of [{score:-1},{score:1000001},{score:1.234},{score:'90'},{candidateName:'a'.repeat(251)}]){
   await write('patch','/api/results/'+first.id,patch).expect(400);
  }
  const found=(await request(app).get('/api/results').query({search:'Anu',eventId:item.id,programCategory:category}).expect(200)).body.data;
  assert.equal(found.total,1);assert.equal(found.items[0].id,first.id);
  const rankings=(await request(app).get('/api/scores/program-rankings').query({eventId:item.id}).expect(200)).body.data;
  assert.equal(rankings[0].entries[0].points,8);
  const updated=ResultSchema.parse((await write('patch','/api/results/'+first.id,{score:95,candidateName:'Anu Updated'}).expect(200)).body.data);
  assert.equal(updated.score,95);assert.equal(updated.points,5);
  const cleared=ResultSchema.parse((await write('patch','/api/results/'+first.id,{score:null}).expect(200)).body.data);
  assert.equal(cleared.score,null);assert.equal(cleared.candidateName,'Anu Updated');
  await write('delete','/api/results/'+second.id).expect(200);
 }
 assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,15);
 const item=await event('Legacy house-only result');
 const legacy=ResultSchema.parse((await write('post','/api/results',{eventId:item.id,houseId:h.id,position:1,points:2}).expect(201)).body.data);
 assert.equal(legacy.candidateName,'');assert.equal(legacy.score,null);
 // The incremental migration can also be run safely after a manual SQL setup.
 await pg.exec(await readFile(new URL('../database/004_candidate_results.sql',import.meta.url),'utf8'));
 const preserved=ResultSchema.parse((await request(app).get('/api/results/'+legacy.id).expect(200)).body.data);
 assert.equal(preserved.points,2);
});

test('simultaneous results preserve both scores, ties share rank, disabled houses are excluded',async()=>{
 const h1=await house('Tie Alpha'),h2=await house('Tie Beta'),e1=await event(),e2=await event();
 await Promise.all([write('post','/api/results',{eventId:e1.id,houseId:h1.id,position:1,points:10}).expect(201),write('post','/api/results',{eventId:e2.id,houseId:h1.id,position:1,points:10}).expect(201)]);
 await write('post','/api/results',{eventId:e1.id,houseId:h2.id,position:1,points:20}).expect(201);
 let leaders=(await request(app).get('/api/leaderboard')).body.data;assert.equal(leaders.find((x:any)=>x.houseId===h1.id).points,20);assert.equal(leaders.find((x:any)=>x.houseId===h1.id).rank,leaders.find((x:any)=>x.houseId===h2.id).rank);
 await write('patch','/api/houses/'+h2.id,{enabled:false,color:'#3355aa'}).expect(200);leaders=(await request(app).get('/api/leaderboard')).body.data;assert.ok(!leaders.some((x:any)=>x.houseId===h2.id));
 await write('post','/api/results',{eventId:e2.id,houseId:h2.id,position:1,points:10}).expect(400);
});
test('program rankings and category standings derive from valid results with shared tie ranks',async()=>{
 const alpha=await house('Ranking Alpha'),beta=await house('Ranking Beta'),gamma=await house('Ranking Gamma');
 const solo=await event('Solo Ranking Programme','Individual');
 const r1=(await write('post','/api/results',{eventId:solo.id,houseId:alpha.id,category:'Senior',position:1,points:10}).expect(201)).body.data;
 const r2=(await write('post','/api/results',{eventId:solo.id,houseId:beta.id,category:'Senior',position:1,points:10}).expect(201)).body.data;
 await write('post','/api/results',{eventId:solo.id,houseId:gamma.id,category:'Senior',position:3,points:5}).expect(201);
 let rankings=await request(app).get('/api/scores/program-rankings').query({eventId:solo.id}).expect(200);const program=ProgramRankingSchema.parse(rankings.body.data[0]);
 assert.deepEqual(program.entries.map(x=>[x.houseName,x.points,x.rank]),[['Ranking Alpha',10,1],['Ranking Beta',10,1],['Ranking Gamma',5,3]]);
 let standings=await request(app).get('/api/scores/category-standings').query({programCategory:'Individual'}).expect(200);const alphaStanding=standings.body.data.find((x:any)=>x.houseId===alpha.id);RankingEntrySchema.parse(alphaStanding);assert.equal(alphaStanding.points,10);
 await write('patch','/api/results/'+r1.id,{points:15}).expect(200);rankings=await request(app).get('/api/scores/program-rankings').query({eventId:solo.id}).expect(200);assert.deepEqual(rankings.body.data[0].entries.map((x:any)=>[x.houseName,x.points,x.rank]),[['Ranking Alpha',15,1],['Ranking Beta',10,2],['Ranking Gamma',5,3]]);
 await write('patch','/api/events/'+solo.id,{programCategory:'Group'}).expect(200);standings=await request(app).get('/api/scores/category-standings').query({programCategory:'Individual'}).expect(200);assert.equal(standings.body.data.find((x:any)=>x.houseId===alpha.id).points,0);
 let group=await request(app).get('/api/scores/category-standings').query({programCategory:'Group'}).expect(200);assert.equal(group.body.data.find((x:any)=>x.houseId===alpha.id).points,15);
 await write('delete','/api/results/'+r2.id).expect(200);rankings=await request(app).get('/api/scores/program-rankings').query({eventId:solo.id}).expect(200);assert.ok(!rankings.body.data[0].entries.some((x:any)=>x.houseId===beta.id));
 await write('patch','/api/events/'+solo.id,{status:'cancelled'}).expect(200);rankings=await request(app).get('/api/scores/program-rankings').query({eventId:solo.id}).expect(200);assert.equal(rankings.body.data.length,0);group=await request(app).get('/api/scores/category-standings').query({programCategory:'Group'}).expect(200);assert.equal(group.body.data.find((x:any)=>x.houseId===alpha.id).points,0);
 await write('patch','/api/events/'+solo.id,{status:'completed'}).expect(200);await write('patch','/api/houses/'+gamma.id,{enabled:false,color:'#3355aa'}).expect(200);rankings=await request(app).get('/api/scores/program-rankings').query({eventId:solo.id}).expect(200);assert.ok(!rankings.body.data[0].entries.some((x:any)=>x.houseId===gamma.id));
 const overall=await request(app).get('/api/leaderboard').expect(200);assert.equal(overall.body.data.find((x:any)=>x.houseId===alpha.id).points,15);
});
test('event filtering, pagination, cancellation, cascade deletion and date validation',async()=>{
 const h=await house(),e=await event('Searchable Dance');await write('post','/api/results',{eventId:e.id,houseId:h.id,position:1,points:9}).expect(201);
 const found=await request(app).get('/api/events').query({search:'Searchable',category:'Dance',status:'upcoming',date:'2026-09-27',limit:1}).expect(200);pageSchema(EventSchema).parse(found.body.data);assert.equal(found.body.data.items[0].id,e.id);
 const first=(await request(app).get('/api/events?limit=1')).body.data;assert.ok(first.nextCursor);const second=(await request(app).get('/api/events').query({limit:1,cursor:first.nextCursor})).body.data;assert.notEqual(first.items[0].id,second.items[0].id);
 await request(app).get('/api/events?date=2026-02-30').expect(400);await request(app).get('/api/results?limit=999999').expect(400);
 await write('patch','/api/events/'+e.id,{status:'cancelled'}).expect(200);assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,0);
 await write('patch','/api/events/'+e.id,{status:'completed'}).expect(200);assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,9);
 await write('delete','/api/events/'+e.id).expect(200);assert.equal((await request(app).get('/api/houses/'+h.id)).body.data.points,0);
});
test('result search, house/event/category/date filters and bounded recent dashboard match frontend schemas',async()=>{
 const h=await house(),e=await event('Unique Filtering');await write('post','/api/results',{eventId:e.id,houseId:h.id,category:'Junior',position:2,points:7,date:'2026-09-27T20:00:00.000Z'}).expect(201);
 const found=await request(app).get('/api/results').query({eventId:e.id,houseId:h.id,category:'Junior',date:'2026-09-28',search:'Unique',sort:'-points'}).expect(200);pageSchema(ResultSchema).parse(found.body.data);assert.equal(found.body.data.total,1);
 const stats=await admin.get('/api/admin/stats').expect(200);StatsSchema.parse(stats.body.data);assert.ok(stats.body.data.recentResults.length<=5);
 SettingsSchema.parse((await request(app).get('/api/settings')).body.data);
 const injection=await request(app).get('/api/events').query({search:"'; DROP TABLE festival.houses; --"}).expect(200);assert.equal(injection.body.data.total,0);assert.ok((await request(app).get('/api/houses')).body.data.length>0);
});
test('gallery upload, thumbnail, metadata edit, filters, multiple uploads and deletion',async()=>{
 const png=await sharp({create:{width:900,height:700,channels:3,background:'#d45544'}}).png().toBuffer();const e=await event();
 async function upload(caption:string){return admin.post('/api/gallery').set('Origin',origin).set('X-CSRF-Token',csrf).field('metadata',JSON.stringify({caption,category:'Ceremony',eventId:e.id})).attach('image',png,{filename:'ceremony.png',contentType:'image/png'}).expect(201);}
 const [one,two]=await Promise.all([upload('Opening Ceremony'),upload('Second moment')]);const item=one.body.data;GallerySchema.parse(item);assert.equal(item.width,900);assert.ok(item.thumbnailUrl!==item.url);
 const thumb=[...objects.entries()].find(([key])=>key.includes(item.id)&&key.includes('-thumb'));assert.ok(thumb);assert.equal((await sharp(thumb[1]).metadata()).width,640);
 await write('patch','/api/gallery/'+item.id,{caption:'Updated Ceremony',category:'Dance'}).expect(200);
 const filtered=await request(app).get('/api/gallery').query({eventId:e.id,category:'Dance',limit:1});pageSchema(GallerySchema).parse(filtered.body.data);assert.equal(filtered.body.data.items[0].caption,'Updated Ceremony');
 await write('delete','/api/gallery/'+item.id).expect(200);await request(app).get('/api/gallery/'+item.id).expect(404);assert.ok(![...objects.keys()].some(k=>k.includes(item.id)));
 await write('delete','/api/events/'+e.id).expect(200);const detached=(await request(app).get('/api/gallery/'+two.body.data.id)).body.data;assert.equal(detached.eventId,null);GallerySchema.parse(detached);
});
test('malformed, disguised, unsupported and oversized image uploads rejected',async()=>{
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();
 for(const [buffer,mime] of [[Buffer.from('<script>alert(1)</script>'),'image/png'],[png,'image/jpeg'],[Buffer.from('<svg></svg>'),'image/svg+xml']] as const){await admin.post('/api/gallery').set('Origin',origin).set('X-CSRF-Token',csrf).field('metadata',JSON.stringify({caption:'invalid',category:'Other',eventId:null})).attach('image',buffer,{filename:'fake.png',contentType:mime}).expect(400);}
 await admin.post('/api/gallery').set('Origin',origin).set('X-CSRF-Token',csrf).field('metadata',JSON.stringify({category:'Other'})).attach('image',Buffer.alloc(10*1024*1024+1),{filename:'large.png',contentType:'image/png'}).expect(400);
 await assert.rejects(()=>optimizeImage(Buffer.alloc(10*1024*1024+1),'image/png'));
});
test('JPEG and WebP decode to safe WebP; gallery supports images without an event',async()=>{
 for(const format of ['jpeg','webp'] as const){const buffer=await sharp({create:{width:3,height:2,channels:3,background:'#123456'}}).toFormat(format).toBuffer();const result=await optimizeImage(buffer,'image/'+format);assert.equal((await sharp(result.image).metadata()).format,'webp');}
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#123456'}}).png().toBuffer();const response=await admin.post('/api/gallery').set('Origin',origin).set('X-CSRF-Token',csrf).field('metadata',JSON.stringify({caption:'No event',category:'Other',eventId:null})).attach('image',png,{filename:'image.png',contentType:'image/png'}).expect(201);GallerySchema.parse(response.body.data);pageSchema(GallerySchema).parse((await request(app).get('/api/gallery')).body.data);
});
test('storage failure cannot publish metadata or leave a partial gallery item',async()=>{
 const count=(await request(app).get('/api/gallery')).body.data.total;const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();failStorage=true;
 try{await admin.post('/api/gallery').set('Origin',origin).set('X-CSRF-Token',csrf).field('metadata',JSON.stringify({category:'Other'})).attach('image',png,{filename:'test.png',contentType:'image/png'}).expect(500);}finally{failStorage=false;}
 assert.equal((await request(app).get('/api/gallery')).body.data.total,count);await images.cleanup();
});
test('SSE notifies a separate connected visitor after database commit',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address=server.address() as {port:number};const controller=new AbortController();
 try{const response=await fetch(`http://127.0.0.1:${address.port}/api/live`,{signal:controller.signal});assert.match(response.headers.get('content-type')||'',/^text\/event-stream/);const reader=response.body!.getReader();await reader.read();await live.tick();await reader.read();
  const notification=async()=>{await live.tick();const message=await reader.read();assert.match(new TextDecoder().decode(message.value),/data:.*refresh/);};
  const h=await house(),e=await event();const created=await write('post','/api/results',{eventId:e.id,houseId:h.id,position:1,points:10}).expect(201);await notification();assert.equal((await new Repository(db).one('houses',h.id)).points,10);
  await write('patch','/api/results/'+created.body.data.id,{points:15}).expect(200);await notification();assert.equal((await new Repository(db).one('houses',h.id)).points,15);
  await write('delete','/api/results/'+created.body.data.id).expect(200);await notification();assert.equal((await new Repository(db).one('houses',h.id)).points,0);
  const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer();await admin.post('/api/gallery').set('Origin',origin).set('X-CSRF-Token',csrf).field('metadata',JSON.stringify({caption:'Live moment',category:'Ceremony'})).attach('image',png,{filename:'live.png',contentType:'image/png'}).expect(201);await notification();
 }finally{controller.abort();live.close();await new Promise<void>(r=>server.close(()=>r()));}
});
test('database revision rolls back with a failed transaction',async()=>{
 const before=(await db.query('SELECT value FROM festival.revision')).rows[0].value;
 await assert.rejects(()=>db.transaction(async tx=>{await tx.query("INSERT INTO festival.houses(name,color) VALUES('Rolled Back','#ffffff')");throw new Error('rollback');}));
 assert.equal((await db.query('SELECT value FROM festival.revision')).rows[0].value,before);assert.equal((await db.query("SELECT id FROM festival.houses WHERE name='Rolled Back'")).rows.length,0);
});
test('password reset rejects invalid tokens and revokes all local sessions after a change',async()=>{
 await write('post','/api/auth/reset-password',{email:'unknown@example.test'}).expect(200);
 await write('post','/api/auth/change-password',{token:'invalid-recovery-token-long',password:'new-test-password'}).expect(401);
 await write('post','/api/auth/change-password',{token:'test-only-valid-recovery-token',password:'new-test-password'}).expect(200);
 await admin.get('/api/admin/stats').expect(401);
 const result=await agent();admin=result.a;csrf=result.token;
});
test('deleting a Supabase identity revokes local sessions while retaining the audit profile',async()=>{
 const {a}=await agent('editor@example.test');await a.get('/api/admin/stats').expect(200);await db.query('DELETE FROM auth.users WHERE id=$1',[editorId]);await a.get('/api/admin/stats').expect(401);assert.equal((await db.query('SELECT is_active FROM festival.admin_users WHERE id=$1',[editorId])).rows[0].is_active,false);
});
test('login rate limit produces a safe response and retry time',async()=>{
 const a=request.agent(app),token=(await a.get('/api/auth/csrf')).body.data.csrfToken;let response;
 for(let i=0;i<11;i++)response=await a.post('/api/auth/login').set('Origin',origin).set('X-CSRF-Token',token).send({email:'rate-test@example.test',password:'wrong'});
 assert.equal(response!.status,429);assert.ok(response!.headers['retry-after']);assert.equal(response!.body.success,false);assert.ok(!response!.body.error.stack);
});
