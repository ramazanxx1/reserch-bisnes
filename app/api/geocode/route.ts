import {fetchJson,createCache,createLimiter,errorResponse,UpstreamError} from '@/lib/upstream';
const cache=createCache(24*60*60*1000,100),limiter=createLimiter(1200);
export async function GET(request:Request){let entered=false;try{
 const q=new URL(request.url).searchParams.get('q')?.trim()||'';if(q.length<3||q.length>200)throw new Error('Введите адрес длиной от 3 до 200 символов.');
 const key=q.toLocaleLowerCase('ru');const cached=cache.get(key);if(cached)return Response.json(cached);
 limiter.enter();entered=true;const url=new URL(process.env.PHOTON_URL||'https://photon.komoot.io/api/');url.searchParams.set('q',q);url.searchParams.set('limit','8');
 const data=await fetchJson(url.toString(),{},15000);if(!Array.isArray(data.features))throw new UpstreamError('Сервис адресов вернул некорректный ответ.');
 const seen=new Set<string>();const results=data.features.flatMap((f:any)=>{const p=f.properties||{},[lon,lat]=f.geometry?.coordinates||[];if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)return [];const id=`${p.osm_type}/${p.osm_id}/${lat}/${lon}`;if(seen.has(id))return [];seen.add(id);const street=[p.street,p.housenumber].filter(Boolean).join(', ');const label=[p.city||p.town||p.village,p.name&&p.name!==p.street?p.name:null,street,p.country].filter(Boolean).join(', ');return label?[{id,lat,lon,label}]:[];});
 const result={results,source:'Photon / OpenStreetMap'};cache.set(key,result);return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof UpstreamError&&e.status===429)limiter.cooldown();return errorResponse(e);}finally{if(entered)limiter.leave();}}
