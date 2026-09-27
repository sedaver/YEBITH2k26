import {z} from 'zod';import {request,mutate,clearSession,ensureCsrf,urlFor,ApiError} from './client';import {isConnected} from './config';
import {HouseSchema,ProgramCategorySchema,EventSchema,ResultSchema,GallerySchema,BreakdownSchema,RankingEntrySchema,ProgramRankingSchema,StatsSchema,SettingsSchema,SessionSchema,pageSchema,type Query} from './models';
const crud=<S extends z.ZodTypeAny>(path:string,schema:S)=>({
 list:async(query:Query={},signal?:AbortSignal)=>pageSchema(schema).parse(await request(path,{signal},query)),
 create:async(data:unknown)=>schema.parse(await mutate(path,'POST',data)),
 update:async(id:string,data:unknown)=>schema.parse(await mutate(path+'/'+encodeURIComponent(id),'PATCH',data)),
 remove:async(id:string)=>mutate<void>(path+'/'+encodeURIComponent(id),'DELETE'),
});
export const houseService={...crud('/houses',HouseSchema),all:async(signal?:AbortSignal)=>z.array(HouseSchema).parse(await request('/houses',{signal}))};
export const programCategoryService={all:async(signal?:AbortSignal)=>z.array(ProgramCategorySchema).parse(await request('/program-categories',{signal}))};
export const eventService=crud('/events',EventSchema);
export const resultService=crud('/results',ResultSchema);
export const galleryService={...crud('/gallery',GallerySchema),upload:async(file:File,metadata:{caption:string;category:string;eventId:string|null},onProgress:(value:number)=>void,signal?:AbortSignal)=>{
 if(!isConnected())throw new ApiError(0,'Uploads become available when the festival service is connected.');
 const token=await ensureCsrf();
 return new Promise<z.infer<typeof GallerySchema>>((resolve,reject)=>{
 const xhr=new XMLHttpRequest();xhr.open('POST',urlFor('/gallery'));xhr.withCredentials=true;xhr.timeout=60000;xhr.setRequestHeader('X-CSRF-Token',token);xhr.setRequestHeader('Accept','application/json');
 const abort=()=>xhr.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){reject(new ApiError(0,'Upload cancelled.'));return;}
 const cleanup=()=>signal?.removeEventListener('abort',abort);
 xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
 xhr.onload=()=>{cleanup();if(xhr.status<200||xhr.status>=300){if(xhr.status===401)window.dispatchEvent(new Event('festival:session-expired'));let message='Upload failed. Please try again.';try{message=JSON.parse(xhr.responseText)?.error?.message||message;}catch{}reject(new ApiError(xhr.status,message));return;}try{const data=GallerySchema.parse(JSON.parse(xhr.responseText).data);window.dispatchEvent(new Event('festival:changed'));resolve(data);}catch{reject(new ApiError(0,'Unable to read the upload confirmation. Please refresh the gallery.'));}};
 xhr.onerror=xhr.ontimeout=()=>{cleanup();reject(new ApiError(0,'Upload failed. Please try again.'));};xhr.onabort=()=>{cleanup();reject(new ApiError(0,'Upload cancelled.'));};
 const body=new FormData();body.append('image',file);body.append('metadata',JSON.stringify(metadata));xhr.send(body);
 });
}};
export const scoreService={
 breakdown:async(signal?:AbortSignal)=>z.array(BreakdownSchema).parse(await request('/scores/breakdown',{signal})),
 categoryStandings:async(programCategory?:string,signal?:AbortSignal)=>z.array(RankingEntrySchema).parse(await request('/scores/category-standings',{signal},{programCategory})),
 programRankings:async(query:Query={},signal?:AbortSignal)=>z.array(ProgramRankingSchema).parse(await request('/scores/program-rankings',{signal},query))
};
export const authService={
 session:async()=>SessionSchema.parse(await request('/auth/session')),
 login:async(email:string,password:string)=>{await ensureCsrf();return SessionSchema.parse(await mutate('/auth/login','POST',{email,password}));},
 resetPassword:async(email:string)=>mutate('/auth/reset-password','POST',{email}),
 changePassword:async(token:string,password:string)=>mutate('/auth/change-password','POST',{token,password}),
 logout:async()=>{await mutate('/auth/logout','POST');clearSession();},
};
export const settingsService={get:async()=>SettingsSchema.parse(await request('/settings')),save:async(data:unknown)=>SettingsSchema.parse(await mutate('/settings','PATCH',data))};
export const adminService={stats:async()=>StatsSchema.parse(await request('/admin/stats'))};

