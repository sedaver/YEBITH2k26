import type {DB} from './db';
import type {ListQuery} from '../validation';
import {ApiError} from '../utils/errors';

export type Entity='houses'|'events'|'results'|'gallery';

const projections:Record<Entity,string>={
 houses:`x.id,x.name,x.color,x.logo_url AS "logoUrl",x.is_active AS enabled,x.points,x.updated_at AS "updatedAt",CASE WHEN x.is_active THEN (SELECT count(*)::int+1 FROM festival.house_scores s WHERE s.is_active AND s.points>x.points) ELSE NULL END AS rank`,
 events:`x.id,x.name,x.category,pc.name AS "programCategory",x.description,x.event_date AS date,x.status,x.image_url AS "imageUrl",x.venue,x.updated_at AS "updatedAt",(SELECT count(*)::int FROM festival.results r WHERE r.event_id=x.id) AS "resultCount"`,
 results:`x.id,x.event_id AS "eventId",e.name AS "eventName",x.category,pc.name AS "programCategory",x.house_id AS "houseId",x.candidate_name AS "candidateName",x.score::float8 AS score,x.position,x.points::float8 AS points,x.result_date AS date,x.updated_at AS "updatedAt"`,
 gallery:`x.id,x.image_url AS url,x.image_url AS "imageUrl",x.thumbnail_url AS "thumbnailUrl",x.caption,x.category,x.event_id AS "eventId",coalesce(e.name,'') AS "eventName",x.uploaded_at AS "createdAt",x.uploaded_at AS "uploadedAt",x.updated_at AS "updatedAt",x.width,x.height`
};
const from:Record<Entity,string>={
 houses:'festival.house_scores x',
 events:'festival.events x JOIN festival.program_categories pc ON pc.id=x.program_category_id',
 results:'festival.results x JOIN festival.events e ON e.id=x.event_id JOIN festival.program_categories pc ON pc.id=e.program_category_id',
 gallery:'festival.gallery x LEFT JOIN festival.events e ON e.id=x.event_id'
};

export class Repository {
 constructor(readonly db:DB){}

 async one(kind:Entity,id:string,db=this.db){
  const {rows}=await db.query(`SELECT ${projections[kind]} FROM ${from[kind]} WHERE x.id=$1`,[id]);
  if(!rows[0])throw new ApiError(404,'NOT_FOUND','Record not found.');
  return rows[0];
 }

 async categories(){
  return (await this.db.query(`SELECT id,name,slug,sort_order AS "sortOrder" FROM festival.program_categories WHERE is_active ORDER BY sort_order,lower(name),id`)).rows;
 }

 async categoryId(db:DB,name:string){
  const {rows}=await db.query(`SELECT id,name FROM festival.program_categories WHERE lower(name)=lower($1) AND is_active`,[name]);
  if(!rows[0])throw new ApiError(400,'VALIDATION_ERROR','Choose an available program category.');
  return rows[0] as {id:string;name:string};
 }

 async houses(active?:boolean){
  return (await this.db.query(`SELECT ${projections.houses} FROM ${from.houses} ${active===undefined?'':'WHERE x.is_active=$1'} ORDER BY x.points DESC,lower(x.name),x.id`,active===undefined?[]:[active])).rows;
 }

 async leaderboard(){
  return (await this.db.query(`SELECT id AS "houseId",name AS "houseName",color,logo_url AS "logoUrl",points,rank() OVER(ORDER BY points DESC)::int AS rank FROM festival.house_scores WHERE is_active ORDER BY points DESC,lower(name),id`)).rows;
 }

 async breakdown(){
  return (await this.db.query(`SELECT r.house_id AS "houseId",r.category,sum(r.points)::float8 AS points FROM festival.results r JOIN festival.events e ON e.id=r.event_id WHERE e.status<>'cancelled' GROUP BY r.house_id,r.category ORDER BY r.house_id,r.category`)).rows;
 }

 async categoryStandings(programCategory?:string){
  const canonical=programCategory?(await this.categoryId(this.db,programCategory)).name:null;
  return (await this.db.query(`WITH totals AS (
   SELECT h.id AS "houseId",h.name AS "houseName",h.color,h.logo_url AS "logoUrl",
    coalesce(sum(r.points) FILTER(WHERE e.status<>'cancelled' AND ($1::text IS NULL OR pc.name=$1)),0)::float8 AS points
   FROM festival.houses h
   LEFT JOIN festival.results r ON r.house_id=h.id
   LEFT JOIN festival.events e ON e.id=r.event_id
   LEFT JOIN festival.program_categories pc ON pc.id=e.program_category_id
   WHERE h.is_active GROUP BY h.id
  ) SELECT *,rank() OVER(ORDER BY points DESC)::int AS rank FROM totals ORDER BY points DESC,lower("houseName"),"houseId"`,[canonical])).rows;
 }

 async programRankings(q:Pick<ListQuery,'programCategory'|'eventId'>){
  const values:any[]=[];const filters=[`e.status<>'cancelled'`,`h.is_active`];
  if(q.programCategory){const category=await this.categoryId(this.db,q.programCategory);values.push(category.name);filters.push(`pc.name=$${values.length}`);}
  if(q.eventId){values.push(q.eventId);filters.push(`e.id=$${values.length}`);}
  const {rows}=await this.db.query(`WITH totals AS (
   SELECT e.id AS "eventId",e.name AS "eventName",pc.name AS "programCategory",e.status,
    h.id AS "houseId",h.name AS "houseName",h.color,h.logo_url AS "logoUrl",sum(r.points)::float8 AS points
   FROM festival.results r JOIN festival.events e ON e.id=r.event_id
   JOIN festival.program_categories pc ON pc.id=e.program_category_id
   JOIN festival.houses h ON h.id=r.house_id
   WHERE ${filters.join(' AND ')}
   GROUP BY e.id,pc.name,h.id
  ), ranked AS (
   SELECT *,rank() OVER(PARTITION BY "eventId" ORDER BY points DESC)::int AS rank FROM totals
  ) SELECT "eventId","eventName","programCategory",status,
   jsonb_agg(jsonb_build_object('houseId',"houseId",'houseName',"houseName",'color',color,'logoUrl',"logoUrl",'points',points,'rank',rank) ORDER BY rank,lower("houseName"),"houseId") AS entries
   FROM ranked GROUP BY "eventId","eventName","programCategory",status ORDER BY lower("eventName"),"eventId"`,values);
  return rows;
 }

 async list(kind:Exclude<Entity,'houses'>,q:ListQuery){
  const values:any[]=[];const filters:string[]=[];const add=(sql:string,value:any)=>{values.push(value);filters.push(sql.replace('?',`$${values.length}`));};
  const dateCol=kind==='events'?'x.event_date':kind==='results'?'x.result_date':'x.uploaded_at';
  if(q.search){const pattern='%'+q.search.replace(/[\\%_]/g,'\\$&')+'%';add((kind==='events'?'x.name':kind==='results'?"(e.name || ' ' || x.category || ' ' || x.candidate_name || ' ' || (SELECT name FROM festival.houses WHERE id=x.house_id))":"(x.caption || ' ' || coalesce(e.name,''))")+' ILIKE ?',pattern);}
  if(q.category)add('x.category=?',q.category);
  if(q.division&&kind!=='gallery'){values.push(q.division);const placeholder=`$${values.length}`;const eventAlias=kind==='events'?'x':'e';filters.push(`(${eventAlias}.name ILIKE ('%- ' || ${placeholder}) OR ${eventAlias}.description ILIKE ('%Division: ' || ${placeholder} || '%') OR ${eventAlias}.description ILIKE ('%Divisions: ' || ${placeholder} || '%'))`);}
  if(q.programCategory&&kind!=='gallery')add('pc.name=?',(await this.categoryId(this.db,q.programCategory)).name);
  if(q.status&&kind==='events')add('x.status=?',q.status);
  if(q.eventId&&kind!=='events')add('x.event_id=?',q.eventId);
  if(q.houseId&&kind==='results')add('x.house_id=?',q.houseId);
  if(q.date)add(`(${dateCol} AT TIME ZONE 'Asia/Kolkata')::date=?::date`,q.date);
  if(q.dateFrom)add(`(${dateCol} AT TIME ZONE 'Asia/Kolkata')::date>=?::date`,q.dateFrom);
  if(q.dateTo)add(`(${dateCol} AT TIME ZONE 'Asia/Kolkata')::date<=?::date`,q.dateTo);
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  const sort=q.sort==='name'?(kind==='events'?'x.name':kind==='results'?'e.name':'x.caption')+' ASC':q.sort==='position'&&kind==='results'?'x.position ASC':q.sort==='-points'&&kind==='results'?'x.points DESC':dateCol+(q.sort==='date'||q.sort==='createdAt'?' ASC':' DESC');
  const offset=q.cursor?Number(q.cursor):(q.page-1)*q.limit;
  const result=await this.db.query<{items:any[];total:number}>(`WITH filtered AS (SELECT ${projections[kind]},row_number() OVER(ORDER BY ${sort},x.id) AS ordinal FROM ${from[kind]}${where}), page AS (SELECT * FROM filtered ORDER BY ordinal LIMIT $${values.length+1} OFFSET $${values.length+2}) SELECT coalesce((SELECT jsonb_agg(to_jsonb(page)-'ordinal' ORDER BY ordinal) FROM page),'[]'::jsonb) AS items,(SELECT count(*)::int FROM filtered) AS total`,[...values,q.limit,offset]);
  const data=result.rows[0];return {...data,nextCursor:offset+data.items.length<data.total?String(offset+q.limit):null};
 }

 async write(kind:Entity,id:string|null,input:Record<string,any>,actor:string){return this.db.transaction(async db=>{
  if(id)await this.one(kind,id,db);
  const data={...input};
  if(kind==='events'&&data.programCategory){const category=await this.categoryId(db,data.programCategory);data.programCategoryId=category.id;delete data.programCategory;}
  if(kind==='results'){
   const old=id?await this.one(kind,id,db):{};const merged={...old,...data};
   const events=await db.query('SELECT category,status FROM festival.events WHERE id=$1 FOR SHARE',[merged.eventId]);
   const houses=await db.query('SELECT is_active FROM festival.houses WHERE id=$1 FOR SHARE',[merged.houseId]);
   if(!events.rows[0]||!houses.rows[0])throw new ApiError(400,'VALIDATION_ERROR','Choose an existing event and house.');
   if(events.rows[0].status==='cancelled'||!houses.rows[0].is_active)throw new ApiError(400,'VALIDATION_ERROR','Results require an active house and an event that is not cancelled.');
   if(!id){data.category??=events.rows[0].category;data.date??=new Date().toISOString();}
   await db.query("UPDATE festival.events SET status='completed' WHERE id=$1",[merged.eventId]);
  }
  const columns:Record<Entity,Record<string,string>>={houses:{name:'name',color:'color',logoUrl:'logo_url',enabled:'is_active'},events:{name:'name',category:'category',programCategoryId:'program_category_id',description:'description',date:'event_date',status:'status',imageUrl:'image_url',venue:'venue'},results:{eventId:'event_id',houseId:'house_id',candidateName:'candidate_name',score:'score',category:'category',position:'position',points:'points',date:'result_date'},gallery:{caption:'caption',category:'category',eventId:'event_id'}};
  const keys=Object.keys(data).filter(k=>columns[kind][k]);if(!keys.length)throw new ApiError(400,'VALIDATION_ERROR','Provide at least one field to update.');
  const values=keys.map(k=>data[k]);const cols=keys.map(k=>columns[kind][k]);
  const saved=await db.query<{id:string}>(id?`UPDATE festival.${kind} SET ${cols.map((c,i)=>`${c}=$${i+1}`).join(',')} WHERE id=$${values.length+1} RETURNING id`:`INSERT INTO festival.${kind}(${cols.join(',')}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,id?[...values,id]:values);
  await this.audit(db,actor,`${kind}.${id?'update':'create'}`,saved.rows[0].id);return this.one(kind,saved.rows[0].id,db);
 });}

 async remove(kind:Entity,id:string,actor:string){await this.db.transaction(async db=>{
  await this.one(kind,id,db);
  if(kind==='gallery')await db.query(`INSERT INTO festival.storage_cleanup(object_key) SELECT image_key FROM festival.gallery WHERE id=$1 UNION ALL SELECT thumbnail_key FROM festival.gallery WHERE id=$1 ON CONFLICT DO NOTHING`,[id]);
  await db.query(`DELETE FROM festival.${kind} WHERE id=$1`,[id]);await this.audit(db,actor,`${kind}.delete`,id);
 });}

 async audit(db:DB,actor:string,action:string,id:string){await db.query('INSERT INTO festival.audit_log(actor_id,action,entity_id) VALUES($1,$2,$3)',[actor,action,id]);}
 async settings(){return (await this.db.query(`SELECT school_name AS "schoolName",festival_name AS "festivalName",description,to_char(start_date,'YYYY-MM-DD') AS "startDate",to_char(end_date,'YYYY-MM-DD') AS "endDate" FROM festival.settings WHERE id=1`)).rows[0];}
 async calculateFinalSnapshot(db:DB=this.db){
  const [housesResult,divisionsResult]=await Promise.all([
   db.query(`SELECT h.id AS "houseId",h.name AS "houseName",h.color,h.logo_url AS "logoUrl",coalesce(sum(CASE WHEN e.status<>'cancelled' THEN r.points ELSE 0 END),0)::float8 AS points FROM festival.houses h LEFT JOIN festival.results r ON r.house_id=h.id LEFT JOIN festival.events e ON e.id=r.event_id GROUP BY h.id ORDER BY lower(h.name),h.id`),
   db.query(`SELECT d.division,h.id AS "houseId",h.name AS "houseName",h.color,h.logo_url AS "logoUrl",coalesce(sum(CASE WHEN e.status<>'cancelled' AND (upper(trim(e.name)) LIKE '% - ' || d.division OR upper(e.description) LIKE '%DIVISION: ' || d.division || '%' OR upper(e.description) LIKE '%DIVISIONS: ' || d.division || '%') THEN r.points ELSE 0 END),0)::float8 AS points FROM (VALUES ('HS'),('LP'),('UP')) d(division) CROSS JOIN festival.houses h LEFT JOIN festival.results r ON r.house_id=h.id LEFT JOIN festival.events e ON e.id=r.event_id GROUP BY d.division,h.id ORDER BY d.division,lower(h.name),h.id`)
  ]);
  const rankEntries=(rows:any[])=>{const entries=rows.map(row=>{const {division:_division,...entry}=row;return {...entry,points:Number(entry.points)}}).sort((a,b)=>b.points-a.points||a.houseName.localeCompare(b.houseName)||a.houseId.localeCompare(b.houseId));let previous:number|undefined;let rank=0;return entries.map((entry,index)=>{if(previous!==entry.points)rank=index+1;previous=entry.points;return {...entry,rank};});};
  return {houses:rankEntries(housesResult.rows),divisions:['HS','LP','UP'].map(division=>({division,entries:rankEntries(divisionsResult.rows.filter(row=>row.division===division))}))};
 }
 async finalScores(){
  const settings=(await this.db.query(`SELECT final_published AS "published",final_published_at AS "publishedAt",final_snapshot AS "snapshot" FROM festival.settings WHERE id=1`)).rows[0]||{};
  const current=await this.calculateFinalSnapshot();const snapshot=settings.snapshot;
  const payload=settings.published&&snapshot&&Array.isArray(snapshot.houses)&&Array.isArray(snapshot.divisions)?snapshot:current;
  return {published:Boolean(settings.published),publishedAt:settings.publishedAt?new Date(settings.publishedAt).toISOString():null,...payload};
 }
 async publishFinalScores(actor:string){return this.db.transaction(async db=>{const snapshot=await this.calculateFinalSnapshot(db);const publishedAt=new Date().toISOString();await db.query(`UPDATE festival.settings SET final_published=true,final_published_at=$1,final_snapshot=$2 WHERE id=1`,[publishedAt,JSON.stringify(snapshot)]);await this.audit(db,actor,'final-scores.publish','1');return {published:true,publishedAt,...snapshot};});}
 async unpublishFinalScores(actor:string){return this.db.transaction(async db=>{await db.query(`UPDATE festival.settings SET final_published=false,final_published_at=NULL,final_snapshot=NULL WHERE id=1`);await this.audit(db,actor,'final-scores.unpublish','1');return this.finalScores();});}
 async saveSettings(data:Record<string,any>,actor:string){await this.db.transaction(async db=>{await db.query(`UPDATE festival.settings SET school_name=$1,festival_name=$2,description=$3,start_date=$4,end_date=$5 WHERE id=1`,[data.schoolName,data.festivalName,data.description,data.startDate,data.endDate]);await this.audit(db,actor,'settings.update','1');});return this.settings();}
 async stats(){
  const {rows}=await this.db.query(`SELECT (SELECT count(*)::int FROM festival.houses) AS "totalHouses",(SELECT count(*)::int FROM festival.events) AS events,(SELECT count(*)::int FROM festival.results) AS results,(SELECT count(*)::int FROM festival.gallery) AS images,(SELECT coalesce(max(points),0)::float8 FROM festival.house_scores) AS "totalPoints"`);
  const q={limit:5,page:1,sort:'-date'} as ListQuery;
  const [leaders,recentResults,recentImages]=await Promise.all([this.leaderboard(),this.list('results',q),this.list('gallery',q)]);
  return {...rows[0],totalEvents:rows[0].events,totalResults:rows[0].results,totalGalleryImages:rows[0].images,currentLeader:leaders[0]??null,currentLeaders:leaders.filter(l=>l.rank===1),recentResults:recentResults.items,recentGalleryImages:recentImages.items};
 }
}
