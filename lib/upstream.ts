export class UpstreamError extends Error { status:number; constructor(message:string,status=503){super(message);this.status=status;} }
export async function fetchJson(url:string,options:RequestInit={},timeout=30000,fetcher:typeof fetch=fetch):Promise<any>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetcher(url,{...options,signal:controller.signal,headers:{'Accept':'application/json','User-Agent':'KonkurentyRyadomPrototype/1.0 (+https://konkurenty-ryadom.chirpywhale32.chatgpt.site)',...options.headers}});
 if(!response.ok)throw new UpstreamError(response.status===429||response.status===406?'Источник временно ограничил запросы. Подождите 30 секунд и повторите поиск.':`Источник данных недоступен (HTTP ${response.status}). Попробуйте позже.`,response.status===429||response.status===406?429:503);
 const text=await response.text();if(text.length>8_000_000)throw new UpstreamError('Ответ источника слишком большой. Уменьшите радиус.');
 try{return JSON.parse(text);}catch{throw new UpstreamError('Источник вернул некорректный ответ. Попробуйте позже.');}
 }catch(e){if(e instanceof UpstreamError)throw e;throw new UpstreamError(controller.signal.aborted?'Источник не ответил вовремя. Попробуйте уменьшить радиус или повторить позже.':'Не удалось соединиться с источником данных. Попробуйте позже.');}finally{clearTimeout(timer)}
}
export function validateOverpass(data:any){if(!data||!Array.isArray(data.elements)||data.remark)throw new UpstreamError('Источник не смог завершить поиск. Уменьшите радиус или повторите позже.');return data.elements;}
export function createCache(ttl:number,maxEntries=60){const values=new Map<string,{at:number,data:any}>();return {get(key:string){const e=values.get(key);if(e&&Date.now()-e.at<ttl)return e.data;values.delete(key);return undefined;},set(key:string,data:any){if(values.size>=maxEntries)values.delete(values.keys().next().value!);values.set(key,{at:Date.now(),data});}};}
// Deliberately small local limiter; replace with shared storage before scaling.
export function createLimiter(interval:number){let busy=false,last=0,cooldown=0;return {enter(){const now=Date.now();if(busy||now-last<interval||now<cooldown)throw new UpstreamError('Слишком частые запросы. Подождите несколько секунд и повторите.',429);busy=true;last=now;},leave(){busy=false;},cooldown(){cooldown=Date.now()+30000;}};}
export function errorResponse(e:unknown){return Response.json({error:e instanceof Error?e.message:'Не удалось выполнить запрос.'},{status:e instanceof UpstreamError?e.status:400,headers:{'Cache-Control':'no-store'}});}
