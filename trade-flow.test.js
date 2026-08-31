const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTracker}=require('./public/trade-flow-core');
const quote=(overrides={})=>({symbol:'2330',bids:[{price:100}],asks:[{price:101}],lastTrade:{key:'a',price:101,lots:50,time:'09:00:01'},...overrides});
test('門檻、買賣方向、淨額與重複快照',()=>{
  const t=createTracker(50);t.reset('2330');
  t.add(quote());assert.equal(t.totals.large.buy,50);
  assert.equal(t.add(quote()),null);assert.equal(t.totals.count,1);
  t.add(quote({lastTrade:{key:'b',price:100,lots:49,time:'09:00:02'}}));
  assert.equal(t.totals.small.sell,49);assert.equal(t.points.at(-1).largeNet,50);assert.equal(t.points.at(-1).smallNet,-49);
});
test('價差內採升降 tick rule，首筆價差內列方向不明',()=>{
  const t=createTracker(50);t.reset('2330');
  t.add(quote({lastTrade:{key:'a',price:100.5,lots:10,time:'1'}}));assert.equal(t.totals.unknown,10);
  t.add(quote({lastTrade:{key:'b',price:100.7,lots:10,time:'2'}}));assert.equal(t.totals.small.buy,10);
  t.add(quote({lastTrade:{key:'c',price:100.6,lots:10,time:'3'}}));assert.equal(t.totals.small.sell,10);
});
test('錯誤股票、缺成交與歸零不污染統計',()=>{
  const t=createTracker();t.reset('2330');assert.equal(t.add(quote({symbol:'6488'})),null);assert.equal(t.add({symbol:'2330'}),null);
  t.add(quote());t.reset('6488');assert.equal(t.totals.large.buy,0);assert.equal(t.points.length,0);
});
