import {useState,useEffect,useCallback,useRef} from 'react';import {backendConfig,isConnected} from './config';
const cache=new Map<string,{data:unknown,time:number}>();export function invalidateResources(){cache.clear();window.dispatchEvent(new Event('festival:changed'));}
export function useResource<T>(key:string,loader:(signal:AbortSignal)=>Promise<T>){
 const [data,setData]=useState<T|undefined>();const [loading,setLoading]=useState(isConnected());const [error,setError]=useState(false);const [updatedAt,setUpdatedAt]=useState<Date>();const [refreshing,setRefreshing]=useState(false);const [revision,setRevision]=useState(0);const loadRef=useRef(loader);loadRef.current=loader;
 const refresh=useCallback(()=>{cache.delete(key);setRevision(v=>v+1)},[key]);
 useEffect(()=>{let active=true;let busy=false;let pending=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();const cached=cache.get(key);setData(cached?.data as T|undefined);setError(false);
 if(!isConnected()){setLoading(false);return;}
 async function run(){if(!active)return;if(busy){pending=true;return;}busy=true;setRefreshing(true);if(!cache.has(key))setLoading(true);
 try{const next=await loadRef.current(controller.signal);if(active){cache.set(key,{data:next,time:Date.now()});if(cache.size>60)cache.delete(cache.keys().next().value!);setData(next);setUpdatedAt(new Date());setError(false);}}
 catch{if(active)setError(true);}finally{busy=false;if(active){setLoading(false);setRefreshing(false);if(pending){pending=false;void run();}}}
 }
 if(cached&&Date.now()-cached.time<10000){setLoading(false);setUpdatedAt(new Date(cached.time));}else void run();
 function schedule(){timer=setTimeout(async()=>{if(document.visibilityState==='visible')await run();schedule();},backendConfig.pollIntervalMs)}schedule();
 const changed=()=>{cache.delete(key);void run();};const visible=()=>{if(document.visibilityState==='visible')void run();};window.addEventListener('festival:changed',changed);window.addEventListener('festival:realtime',changed);window.addEventListener('online',changed);document.addEventListener('visibilitychange',visible);
 return()=>{active=false;controller.abort();clearTimeout(timer);window.removeEventListener('festival:changed',changed);window.removeEventListener('festival:realtime',changed);window.removeEventListener('online',changed);document.removeEventListener('visibilitychange',visible)};
 },[key,revision]);return {data,loading,error,updatedAt,refreshing,refresh,connected:isConnected()};
}
export function LiveConnection(){useEffect(()=>{if(!isConnected()||!backendConfig.realtimeUrl)return;const stream=new EventSource(backendConfig.realtimeUrl,{withCredentials:true});let timer:ReturnType<typeof setTimeout>;const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>{cache.clear();window.dispatchEvent(new Event('festival:realtime'));},150);};stream.onmessage=changed;['houses','scores','results','events','gallery','settings'].forEach(name=>stream.addEventListener(name,changed));return()=>{clearTimeout(timer);stream.close();};},[]);return null;}
export function useDebounced<T>(value:T,delay=250){const [v,set]=useState(value);useEffect(()=>{const t=setTimeout(()=>set(value),delay);return()=>clearTimeout(t)},[value,delay]);return v;}

