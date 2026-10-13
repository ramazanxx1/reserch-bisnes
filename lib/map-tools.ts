'use client';
import {useEffect,useRef} from 'react';
import type {Place} from './geo';
export function useMapTools(places:Place[],status:string,select:(id:string)=>void){
 const live=useRef({places,status,select});live.current={places,status,select};
 useEffect(()=>{
 const context=(document as any).modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 const tools=[{name:'get_search_results',title:'Текущие результаты поиска',description:'Получить результаты текущего поиска и его состояние. Не выполняет новый сетевой запрос.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){return {status:live.current.status,results:live.current.places.map(({id,name,distance,lat,lon,address})=>({id,name,distance,lat,lon,address}))};}},
 {name:'select_search_result',title:'Показать организацию на карте',description:'Выделить существующий результат на карте и открыть информацию о нем.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input:unknown){const id=(input as any)?.id;if(typeof id!=='string'||!live.current.places.some(p=>p.id===id))throw new Error('Организация не найдена в текущих результатах.');live.current.select(id);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));return {selectedId:id};}}];
 for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
 return()=>lifecycle.abort();
 },[]);
}
