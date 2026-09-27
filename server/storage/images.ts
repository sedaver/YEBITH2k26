import sharp from 'sharp';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import type {Config} from '../config';
import type {DB} from '../database/db';
import {Repository} from '../database/repository';
import {ApiError} from '../utils/errors';
export interface ObjectStore {put(key:string,buffer:Buffer):Promise<string>;remove(keys:string[]):Promise<void>}
export function objectStore(c:Config):ObjectStore {
 const client=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const bucket=client.storage.from(c.STORAGE_BUCKET);
 return {async put(key,buffer){const {error}=await bucket.upload(key,buffer,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});if(error)throw error;return bucket.getPublicUrl(key).data.publicUrl;},async remove(keys){const {error}=await bucket.remove(keys);if(error)throw error;}};
}
export async function optimizeImage(buffer:Buffer,mime:string){
 if(buffer.length>10*1024*1024)throw new ApiError(413,'INVALID_IMAGE','Images must be 10 MB or smaller.');
 try{
  const metadata=await sharp(buffer,{limitInputPixels:25000000,failOn:'warning'}).metadata();
  const formats:Record<string,string>={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
  if(!metadata.format||formats[metadata.format]!==mime||!metadata.width||!metadata.height||(metadata.pages??1)>1)throw new Error('Invalid format');
  // Decode and re-encode; strips EXIF/GPS and discards appended executable payloads.
  const image=await sharp(buffer,{limitInputPixels:25000000,failOn:'warning'}).rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
  const thumbnail=await sharp(image.data).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).webp({quality:75}).toBuffer();
  return {image:image.data,thumbnail,width:image.info.width,height:image.info.height};
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'INVALID_IMAGE','Choose a valid, non-animated JPEG, PNG or WebP image under 25 megapixels.');}
}
export class ImageService {
 constructor(private db:DB,private store:ObjectStore){}
 async upload(file:Express.Multer.File,metadata:{caption:string;category:string;eventId:string|null},actor:string){
  const data=await optimizeImage(file.buffer,file.mimetype);const id=randomUUID();const imageKey=`gallery/${id}.webp`,thumbKey=`gallery/${id}-thumb.webp`;
  if(metadata.eventId&&!(await this.db.query('SELECT id FROM festival.events WHERE id=$1',[metadata.eventId])).rows.length)throw new ApiError(400,'VALIDATION_ERROR','Choose an existing event.');
  // Durable cleanup intents cover interrupted uploads as well as failed database inserts.
  await this.db.query('INSERT INTO festival.storage_cleanup(object_key) VALUES($1),($2)',[imageKey,thumbKey]);
  try {
   const imageUrl=await this.store.put(imageKey,data.image);const thumbnailUrl=await this.store.put(thumbKey,data.thumbnail);
   return await this.db.transaction(async tx=>{await tx.query(`INSERT INTO festival.gallery(id,image_url,thumbnail_url,image_key,thumbnail_key,caption,category,event_id,uploaded_by,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,imageUrl,thumbnailUrl,imageKey,thumbKey,metadata.caption,metadata.category,metadata.eventId,actor,data.width,data.height]);await tx.query('DELETE FROM festival.storage_cleanup WHERE object_key=ANY($1::text[])',[[imageKey,thumbKey]]);await new Repository(tx).audit(tx,actor,'gallery.create',id);return new Repository(tx).one('gallery',id);});
  }catch(error){try{await this.store.remove([imageKey,thumbKey]);await this.db.query('DELETE FROM festival.storage_cleanup WHERE object_key=ANY($1::text[])',[[imageKey,thumbKey]]);}catch{console.error('Storage cleanup pending');}throw error;}
 }
 async cleanup(){const rows=await this.db.query<{object_key:string}>(`SELECT object_key FROM festival.storage_cleanup c WHERE created_at<now()-interval '15 minutes' AND NOT EXISTS(SELECT 1 FROM festival.gallery g WHERE g.image_key=c.object_key OR g.thumbnail_key=c.object_key) LIMIT 100`);if(rows.rows.length){const keys=rows.rows.map(r=>r.object_key);await this.store.remove(keys);await this.db.query('DELETE FROM festival.storage_cleanup WHERE object_key=ANY($1::text[])',[keys]);}}
 async removeObjectsForDeleted(id:string,actor:string){
  const {rows}=await this.db.query<{image_key:string;thumbnail_key:string}>('SELECT image_key,thumbnail_key FROM festival.gallery WHERE id=$1',[id]);
  await new Repository(this.db).remove('gallery',id,actor);
  if(rows[0]){const keys=[rows[0].image_key,rows[0].thumbnail_key];try{await this.store.remove(keys);await this.db.query('DELETE FROM festival.storage_cleanup WHERE object_key=ANY($1::text[])',[keys]);}catch{console.error('Deleted gallery files queued for cleanup');}}
 }
}
