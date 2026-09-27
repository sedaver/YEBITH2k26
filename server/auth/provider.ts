import {createClient} from '@supabase/supabase-js';
import type {Config} from '../config';
export interface AuthProvider {login(email:string,password:string):Promise<{id:string;email:string}|null>;reset(email:string):Promise<void>;changePassword(token:string,password:string):Promise<string|null>}
export function authProvider(config:Config):AuthProvider {
 const make=()=>createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {
  async login(email,password){const client=make();const {data,error}=await client.auth.signInWithPassword({email,password});return !error&&data.user?{id:data.user.id,email:data.user.email!}:null;},
  async reset(email){const {error}=await make().auth.resetPasswordForEmail(email,{redirectTo:config.APP_ORIGIN+'/admin/reset-password'});if(error)throw error;},
  async changePassword(token,password){const client=createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.getUser(token);if(error||!data.user)return null;
   // Call GoTrue with the recovery access token; never accept a user id from the browser.
   const response=await fetch(config.SUPABASE_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:config.SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(15000)});return response.ok?data.user.id:null;
  }
 };
}
