export type Point = { lat: number; lon: number };
export type CategoryId = 'coffee' | 'bakery' | 'grocery' | 'barber' | 'pharmacy' | 'carwash';
export const categories = [
  { id: 'coffee', label: 'Кофейня', note: 'Кафе и кофе навынос. В OSM кафе не всегда отделены от кофеен.', selectors: ['[amenity=cafe]', '[amenity=fast_food][cuisine~"(^|;)coffee_shop(;|$)"]'] },
  { id: 'bakery', label: 'Пекарня', note: 'Пекарни и булочные с категорией shop=bakery.', selectors: ['[shop=bakery]'] },
  { id: 'grocery', label: 'Продуктовый магазин', note: 'Супермаркеты, магазины у дома и продуктовые магазины.', selectors: ['[shop~"^(supermarket|convenience|grocery)$"]'] },
  { id: 'barber', label: 'Барбершоп', note: 'Мужские парикмахерские и явно обозначенные барбершопы. Обычные салоны без уточнения не включены.', selectors: ['[shop=hairdresser]["hairdresser"="barber"]','[shop=hairdresser][male=yes][female=no]','[shop=hairdresser][name~"barber|барбер",i]'] },
  { id: 'pharmacy', label: 'Аптека', note: 'Аптеки с тегом amenity=pharmacy или healthcare=pharmacy.', selectors: ['[amenity=pharmacy]', '[healthcare=pharmacy]'] },
  { id: 'carwash', label: 'Автомойка', note: 'Автомойки, включая самообслуживание, с тегом amenity=car_wash.', selectors: ['[amenity=car_wash]'] },
] as const;
export type Place = Point & { id: string; name: string; category: string; address: string; distance: number; website?: string; hours?: string; sourceUrl: string; tags: Record<string,string>; osmType: string; sourceIds: string[] };
export function haversine(a: Point, b: Point) {
  const rad = Math.PI / 180, p = (b.lat-a.lat)*rad, q=(b.lon-a.lon)*rad;
  const x=Math.sin(p/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(q/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
export function validateSearch(lat: unknown, lon: unknown, radius: unknown, category: unknown) {
  if (typeof lat!=='number'||typeof lon!=='number'||typeof radius!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(radius)||Math.abs(lat)>85||Math.abs(lon)>180||radius<100||radius>5000||!Number.isInteger(radius)||!categories.some(c=>c.id===category)) throw new Error('Укажите точку, категорию и целый радиус от 100 до 5 000 м.');
  return {lat,lon,radius,category:category as CategoryId};
}
export function buildQuery(p: Point, radius: number, category: CategoryId) {
  validateSearch(p.lat,p.lon,radius,category);
  return `[out:json][timeout:25][maxsize:33554432];(${categories.find(c=>c.id===category)!.selectors.map(s=>`nwr${s}(around:${radius},${p.lat},${p.lon});`).join('')});out center tags;`;
}
export function safeWebsite(value?: string) {
  if(!value)return undefined;
  try { const u=new URL(/^[a-z][a-z\d+.-]*:/i.test(value)?value:`https://${value}`); return ['http:','https:'].includes(u.protocol)?u.href:undefined; }catch{return undefined;}
}
const norm=(s?:string)=>(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]/gu,'');
function sourceCategory(t:Record<string,string>, category:CategoryId):string {
  if(category==='coffee') return t.cuisine?.split(';').includes('coffee_shop') ? (t.amenity==='fast_food'?'Кофе навынос':'Кофейня') : 'Кафе';
  if(category==='grocery' && t.shop==='supermarket') return 'Супермаркет';
  if(category==='grocery' && t.shop==='convenience') return 'Магазин у дома';
  return categories.find(c=>c.id===category)!.label;
}
export function normalizePlaces(elements: any[], center: Point, radius: number, category: CategoryId): Place[] {
  const seen = new Set<string>();
  const items: Place[]=[];
  for(const e of elements){
    const t:Record<string,string>=e.tags||{};
    if(t.disused==='yes'||t.abandoned==='yes'||t.shop==='vacant'||t.closed==='yes')continue;
    const lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const distance=haversine(center,{lat,lon});
    if(distance>radius)continue;
    const id=`${e.type}/${e.id}`; if(seen.has(id))continue; seen.add(id);
    const address=t['addr:full']||[t['addr:city'],[t['addr:street']||t['addr:place'],t['addr:housenumber']].filter(Boolean).join(', '),t['addr:unit']?`пом. ${t['addr:unit']}`:''].filter(Boolean).join(', ');
    const label=sourceCategory(t,category);
    items.push({id,name:t['name:ru']||t.name||t.brand||`${label} без названия`,lat,lon,distance,address:address||'Адрес не указан в OSM',category:label,website:safeWebsite(t.website||t['contact:website']),hours:t.opening_hours,sourceUrl:`https://www.openstreetmap.org/${id}`,tags:t,osmType:e.type,sourceIds:[id]});
  }
  // Merge only duplicate representations, never a whole chain. Conflicting branch/unit refs survive.
  const result:Place[]=[];
  for(const p of items.sort((a,b)=>(a.osmType==='node'?-1:1)-(b.osmType==='node'?-1:1)||a.distance-b.distance)){
    const duplicate=result.find(q=>{
      if(!p.tags.name&&!p.tags['name:ru'])return false;
      if(norm(p.name)!==norm(q.name))return false;
      if(['ref','branch','level','addr:unit'].some(k=>(p.tags[k]||q.tags[k])&&norm(p.tags[k])!==norm(q.tags[k])))return false;
      if(['addr:housenumber','addr:street'].some(k=>p.tags[k]&&q.tags[k]&&norm(p.tags[k])!==norm(q.tags[k])))return false;
      const d=haversine(p,q);
      if(d>35)return false;
      const sameAddress=p.address!=='Адрес не указан в OSM'&&norm(p.address)===norm(q.address);
      const sameContact=['phone','contact:phone'].some(k=>p.tags[k]&&norm(p.tags[k])===norm(q.tags[k]));
      return (p.osmType!==q.osmType&&(sameAddress||sameContact||d<10))||(d<3&&(sameAddress||sameContact));
    });
    if(duplicate){duplicate.sourceIds.push(...p.sourceIds);duplicate.website ||= p.website;duplicate.hours ||= p.hours;if(duplicate.address==='Адрес не указан в OSM')duplicate.address=p.address;}
    else result.push(p);
  }
  return result.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
}
export function formatDistance(m:number){return m<1000?`${Math.round(m)} м`:`${(m/1000).toLocaleString('ru-RU',{maximumFractionDigits:2})} км`;}
