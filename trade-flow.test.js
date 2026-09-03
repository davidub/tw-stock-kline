const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTracker}=require('./public/trade-flow-core');
const quote=(overrides={})=>({symbol:'2330',fetchedAt:'2026-09-03T01:00:00Z',lastTradeTime:'09:00:00',volumeLots:100,
  bids:[{price:100}],asks:[{price:101}],bidPercent:60,marketPoint:{price:100.5,kind:'midquote'},lastTrade:null,...overrides});
test('第一筆建立基準，後續即使沒有 lastTrade 仍計算五秒與一分鐘量能',()=>{
  const t=createTracker(50);t.reset('2330');
  const first=t.add(quote());assert.equal(first.baseline,true);assert.equal(t.stats.intervalLots,0);
  const next=t.add(quote({fetchedAt:'2026-09-03T01:00:05Z',lastTradeTime:'09:00:05',volumeLots:112}));
  assert.equal(next.intervalLots,12);assert.equal(t.stats.minuteLots,12);assert.equal(t.stats.samples,2);
});
test('一分鐘量能只保留最近六十秒，累計量保留本頁期間',()=>{
  const t=createTracker();t.reset('2330');t.add(quote());
  t.add(quote({fetchedAt:'2026-09-03T01:00:30Z',volumeLots:110}));
  t.add(quote({fetchedAt:'2026-09-03T01:01:31Z',volumeLots:125}));
  assert.equal(t.stats.minuteLots,15);assert.equal(t.stats.sessionLots,25);
});
test('累計成交量倒退時重新建立基準，不產生負量或假放量',()=>{
  const t=createTracker(5);t.reset('2330');t.add(quote({volumeLots:100}));
  const p=t.add(quote({fetchedAt:'2026-09-03T01:00:05Z',volumeLots:10}));
  assert.equal(p.intervalLots,0);assert.equal(p.baseline,true);assert.equal(t.stats.burst,false);
});
test('五檔壓力與中間價方向每個快照都會更新',()=>{
  const t=createTracker();t.reset('2330');t.add(quote());
  let p=t.add(quote({fetchedAt:'2026-09-03T01:00:05Z',bids:[{price:101}],asks:[{price:102}],bidPercent:40,volumeLots:101}));
  assert.equal(p.direction,'up');assert.equal(p.priceChange,1);
  p=t.add(quote({fetchedAt:'2026-09-03T01:00:10Z',bidPercent:40,volumeLots:101,bids:[{price:101}],asks:[{price:102}]}));
  assert.equal(p.direction,'sell-pressure');
});
test('放量只代表五秒合計量；實際成交快照另外去重計數',()=>{
  const t=createTracker(10);t.reset('2330');t.add(quote());
  const trade={key:'a',price:101,lots:3,time:'09:00:05'};
  let p=t.add(quote({fetchedAt:'2026-09-03T01:00:05Z',volumeLots:115,lastTrade:trade}));
  assert.equal(p.burst,true);assert.equal(t.stats.actualCount,1);
  p=t.add(quote({fetchedAt:'2026-09-03T01:00:10Z',volumeLots:116,lastTrade:trade}));
  assert.equal(p.actualTrade,null);assert.equal(t.stats.actualCount,1);
});
