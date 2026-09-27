import {createClient} from '@supabase/supabase-js';
import {readConfig} from '../config';
const c=readConfig();const supabase=createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await supabase.storage.listBuckets();if(error)throw error;
const options={public:true,fileSizeLimit:10*1024*1024,allowedMimeTypes:['image/webp']};
const result=data.some(b=>b.name===c.STORAGE_BUCKET)?await supabase.storage.updateBucket(c.STORAGE_BUCKET,options):await supabase.storage.createBucket(c.STORAGE_BUCKET,options);
if(result.error)throw result.error;
console.log('Gallery bucket ready. Images are public; uploads and deletes require the server key.');
