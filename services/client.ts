import {backendConfig,isConnected} from './config';
import type {Query} from './models';
export class ApiError extends Error {constructor(public status:number,message='Unable to complete the request. Please try again.') {super(message);}}
let csrfToken='';
export const urlFor=(path:string,query:Query={})=>{const url=new URL(backendConfig.apiBaseUrl.replace(/\/$/,'')+path,window.location.origin);Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!=='')url.searchParams.set(k,String(v));});return url.toString();};
export async function request<T>(path:string, options:RequestInit={},query:Query={}):Promise<T>{
 if(!isConnected())throw new ApiError(0,'The festival service is not connected yet.');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),backendConfig.requestTimeoutMs);
 const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)controller.abort();
 try{const response=await fetch(urlFor(path,query),{...options,signal:controller.signal,credentials:'include',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(csrfToken?{'X-CSRF-Token':csrfToken}:{}),...options.headers}});
 if(response.status===204)return undefined as T;
 const payload=await response.json() as {data:T;error?:{message?:string}};
 if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('festival:session-expired'));throw new ApiError(response.status,payload?.error?.message||'Unable to complete the request. Please try again.');}
 return payload.data as T;
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(0,'Unable to reach the festival service. Please try again.');}
 finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
}
export async function ensureCsrf(){if(!csrfToken){const data=await request<{csrfToken:string}>('/auth/csrf');if(typeof data.csrfToken!=='string'||!data.csrfToken)throw new ApiError(0);csrfToken=data.csrfToken;}return csrfToken;}
export function clearSession(){csrfToken='';}
export async function mutate<T>(path:string,method:string,body?:unknown){await ensureCsrf();const result=await request<T>(path,{method,body:body===undefined?undefined:JSON.stringify(body)});window.dispatchEvent(new Event('festival:changed'));return result;}
export const errorMessage=(e:unknown)=>e instanceof ApiError?e.message:'Unable to save changes. Please try again.';

