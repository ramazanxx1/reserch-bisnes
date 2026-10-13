import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlacesSearch} from '../lib/search-client.ts';
const point={lat:55.7612482,lon:37.6080742};
const config=()=>Response.json({overpassUrl:'https://overpass.example.test'});
const transport=(reply:()=>Promise<Response>)=>(async(url:any)=>url==='/api/sources'?config():reply()) as typeof fetch;
const run=(fetcher:typeof fetch,timeout=100)=>createPlacesSearch(fetcher,timeout)(point,1000,'coffee',new AbortController().signal);

test('actual client transport rejects unavailable API, HTTP errors, HTML and partial JSON',async()=>{
 for(const reply of [
  async()=>{throw new TypeError('offline')},
  async()=>new Response('down',{status:503}),
  async()=>new Response('busy',{status:429}),
  async()=>new Response('<html>not JSON</html>'),
  async()=>Response.json({elements:[],remark:'runtime error: timed out'}),
 ]) await assert.rejects(()=>run(transport(reply)));
});
test('client distinguishes successful empty response and caches only success',async()=>{
 let calls=0;
 const search=createPlacesSearch(transport(async()=>{calls++;return Response.json({elements:[]})}));
 const result=await search(point,1000,'coffee',new AbortController().signal);
 assert.deepEqual(result.places,[]);
 assert.equal(await search(point,1000,'coffee',new AbortController().signal),result);
 assert.equal(calls,1);
 await assert.rejects(()=>search(point,500,'coffee',new AbortController().signal),/Подождите/);
});
test('client timeout and caller cancellation stop pending network requests',async()=>{
 const pending=(async(url:any,options:any)=>url==='/api/sources'?config():new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason)))) as typeof fetch;
 await assert.rejects(()=>run(pending,5),/не ответил вовремя/);
 const c=new AbortController(),search=createPlacesSearch(pending);
 const request=search(point,1000,'coffee',c.signal);
 await new Promise(resolve=>setTimeout(resolve,5));c.abort();
 await assert.rejects(()=>request,{name:'AbortError'});
});
