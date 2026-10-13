import {buildQuery,normalizePlaces,validateSearch,type Point,type CategoryId} from './geo.ts';
import {validateOverpass,UpstreamError,createCache} from './upstream.ts';
// One instance per browser tab. Dependency injection is used only by unit tests.
export function createPlacesSearch(fetcher:typeof fetch=fetch, timeoutMs=30000){
const cache=createCache(300000,30);
let lastStarted=0;
return async function searchPlaces(point:Point,radius:number,category:CategoryId,signal:AbortSignal){
 signal.throwIfAborted();
 const params=validateSearch(point.lat,point.lon,radius,category),key=JSON.stringify(params),cached=cache.get(key);if(cached)return cached;
 if(Date.now()-lastStarted<2500)throw new Error('Подождите несколько секунд перед следующим поиском.');lastStarted=Date.now();
 const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),timeoutMs);
 try{
 const combined=AbortSignal.any([signal,timeout.signal]);
 const configResponse=await fetcher('/api/sources',{signal:combined});if(!configResponse.ok)throw new Error('Не удалось получить настройки источника.');const config:any=await configResponse.json();
 const r=await fetcher(config.overpassUrl,{method:'POST',body:new URLSearchParams({data:buildQuery(params,radius,category)}),signal:combined,credentials:'omit'});
 if(!r.ok){if(r.status===429||r.status===406)lastStarted=Date.now()+27500;throw new UpstreamError(r.status===429||r.status===406?'Источник ограничил запросы. Подождите 30 секунд и повторите.':`Источник данных недоступен (HTTP ${r.status}). Попробуйте позже.`);}
 const text=await r.text();if(text.length>8000000)throw new Error('Ответ слишком большой. Уменьшите радиус.');let data;try{data=JSON.parse(text)}catch{throw new Error('Источник вернул некорректный ответ. Попробуйте позже.');}
 const places=normalizePlaces(validateOverpass(data),point,radius,category);const result={places,fetchedAt:new Date().toISOString(),dataTimestamp:data.osm3s?.timestamp_osm_base};cache.set(key,result);return result;
 }catch(e){if(signal.aborted)throw e;if(timeout.signal.aborted)throw new Error('Источник не ответил вовремя. Уменьшите радиус или повторите позже.');if(e instanceof TypeError)throw new Error('Не удалось соединиться с источником данных. Проверьте интернет и повторите позже.');throw e;}finally{clearTimeout(timer)}
}
}
export const searchPlaces=createPlacesSearch();
