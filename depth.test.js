const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync(require('node:path').join(__dirname,'public/depth.js'),'utf8');
function fixture(iso){
  const elements={},timers=new Map(),events={},requests=[];let id=0;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[iso]));}}
  const document={hidden:false,getElementById(name){return elements[name]??={style:{},checked:true};},addEventListener(name,fn){events[name]=fn;},dispatchEvent(){return true;}};
  class CustomEvent {constructor(type,options){this.type=type;this.detail=options?.detail;}}
  const context={document,Date:Clock,Intl,AbortController,CustomEvent,
    setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(key){timers.delete(key);},
    fetch(url,options){return new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}));}};
  vm.createContext(context);vm.runInContext(script+';this.api=depthController;',context);
  return {...context,elements,timers,events,requests};
}
async function finish(request,symbol='2330'){
  request.resolve({ok:true,json:async()=>({symbol,bids:[],asks:[],bidLots:null,askLots:null,bidPercent:null,date:'2026-08-31',fetchedAt:'2026-08-31T02:00:00Z',source:'test'})});
  await new Promise(resolve=>setImmediate(resolve));
}
test('盤中每輪完成後排程，不重疊；背景與關閉自動更新皆停止排程',async()=>{
  const f=fixture('2026-08-31T02:00:00Z');f.api.start('2330','TWSE','test');
  f.elements.depthRefresh.onclick();assert.equal(f.requests.length,1);
  await finish(f.requests[0]);assert.ok([...f.timers.values()].some(x=>x.ms===5000));
  f.document.hidden=true;f.events.visibilitychange();assert.equal(f.timers.size,0);
  f.document.hidden=false;f.events.visibilitychange();assert.equal(f.requests.length,2);
  f.elements.depthAuto.checked=false;await finish(f.requests[1]);assert.equal(f.timers.size,0);
});
test('盤後時鐘檢查不抓取新行情；切換股票忽略舊回應',async()=>{
  const f=fixture('2026-08-31T12:00:00Z');f.api.start('2330','TWSE','test');
  await finish(f.requests[0]);[...f.timers.values()].find(x=>x.ms===5000).fn();assert.equal(f.requests.length,1);
  f.api.start('6488','TPEx','new');f.api.start('006208','TWSE','latest');
  assert.equal(f.requests[1].options.signal.aborted,true);
  await finish(f.requests[1],'6488');assert.equal(f.elements.depthStatus.textContent,'等待股票查詢完成');
  await finish(f.requests[2],'006208');assert.match(f.elements.depthStatus.textContent,/006208.*最後揭示/);
});
test('連線失敗清除舊掛單',async()=>{
  const f=fixture('2026-08-31T02:00:00Z');f.api.start('2330','TWSE','test');
  f.requests[0].reject(new Error('offline'));await new Promise(resolve=>setImmediate(resolve));
  assert.match(f.elements.depthStatus.textContent,/更新失敗/);assert.equal(f.elements.bidTotal.textContent,'—');
});
