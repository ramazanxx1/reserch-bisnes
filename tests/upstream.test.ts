import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchJson,validateOverpass,createCache,createLimiter,UpstreamError} from '../lib/upstream.ts';
const reply=(body:string,status=200)=>(async()=>new Response(body,{status})) as typeof fetch;
test('upstream 429, 500, HTML, connection failures produce explicit errors',async()=>{for(const f of [reply('busy',429),reply('error',500),reply('<html>'),(async()=>{throw new Error('offline')}) as typeof fetch])await assert.rejects(()=>fetchJson('https://example.test',{},100,f),UpstreamError)});
test('timeout aborts fetch, no invented data returned',async()=>{const f=((_:any,o:any)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(new Error('aborted'))))) as typeof fetch;await assert.rejects(()=>fetchJson('https://example.test',{},5,f),/не ответил вовремя/)});
test('partial Overpass response is not shown as success or empty',()=>{assert.throws(()=>validateOverpass({elements:[],remark:'runtime error'}));assert.throws(()=>validateOverpass({}));assert.deepEqual(validateOverpass({elements:[]}),[])});
test('bounded cache and limiter do not leak unbounded entries or concurrent requests',()=>{const c=createCache(1000,1);c.set('a',1);c.set('b',2);assert.equal(c.get('a'),undefined);assert.equal(c.get('b'),2);const l=createLimiter(0);l.enter();assert.throws(()=>l.enter());l.leave();l.enter();l.leave();l.cooldown();assert.throws(()=>l.enter());});
