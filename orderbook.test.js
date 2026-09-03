const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseOrderBook}=require('./orderbook');
test('MIS 買賣欄位方向、張數與比例',()=>{
  const q=parseOrderBook({c:'2330',d:'20260831',b:'100_99_',g:'20_30_',a:'101_102_',f:'10_40_',z:'-'},'TWSE');
  assert.equal(q.bids[0].price,100);assert.equal(q.asks[0].price,101);
  assert.equal(q.bidLots,50);assert.equal(q.askLots,50);assert.equal(q.bidPercent,50);
  assert.equal(q.marketPoint,null);
  assert.equal(q.date,'2026-08-31'); // No last trade needed to display waiting orders.
});
test('最後成交事件需要完整欄位並產生穩定去重鍵',()=>{
  const q=parseOrderBook({c:'2330',d:'20260831',t:'09:01:02',z:'101',s:'50',b:'100_',g:'1_',a:'101_',f:'1_'},'TWSE');
  assert.deepEqual(q.lastTrade,{key:'20260831|09:01:02|101|50',price:101,lots:50,time:'09:01:02'});
  assert.equal(q.marketPoint.price,101);assert.equal(q.marketPoint.kind,'trade');
  assert.equal(parseOrderBook({c:'2330',d:'20260831',t:'09:01:02',z:'-',s:'50'},'TWSE').lastTrade,null);
});
test('即使 z 暫時缺值，仍保留今日先前看見的最近成交價',()=>{
  const first=parseOrderBook({c:'2330',d:'20260831',t:'09:01:02',z:'101',s:'50',y:'99',o:'100',h:'102',l:'98',v:'1234',b:'100_',g:'1_',a:'101_',f:'1_'},'TWSE');
  const next=parseOrderBook({c:'2330',d:'20260831',t:'09:01:07',z:'-',s:'-',y:'99',b:'100_',g:'1_',a:'102_',f:'1_'},'TWSE',new Date(),first.marketPoint);
  assert.equal(next.close,101);assert.equal(next.priceKind,'trade');assert.equal(next.marketPoint.retained,true);
  assert.equal(first.prev,99);assert.equal(first.open,100);assert.equal(first.volumeLots,1234);
});
test('沒有今日成交可保留時，主報價使用並標示買賣中間價',()=>{
  const q=parseOrderBook({c:'2330',d:'20260831',t:'09:02:03',z:'-',s:'-',y:'99',b:'100_',g:'1_',a:'102_',f:'2_'},'TWSE');
  assert.equal(q.close,101);assert.equal(q.priceKind,'midquote');
});
test('沒有成交價時以最佳買賣中間價提供分時點，且不偽裝成成交',()=>{
  const q=parseOrderBook({c:'2330',d:'20260831',t:'09:02:03',z:'-',s:'-',b:'100_',g:'1_',a:'101_',f:'2_'},'TWSE');
  assert.equal(q.lastTrade,null);assert.deepEqual(q.marketPoint,{key:'20260831|09:02:03|100.5|mid',price:100.5,lots:0,time:'09:02:03',kind:'midquote'});
});
test('缺檔不錯配價量，缺值不能當零張',()=>{
  const q=parseOrderBook({b:'100_-_98_',g:'20_-_30_',a:'101_',f:'10_'},'TPEx');
  assert.equal(q.bids[1].level,3);assert.equal(q.bids[1].lots,30);
  const missing=parseOrderBook({b:'100_',g:'-_',a:'101_',f:'10_'},'TWSE');
  assert.equal(missing.bidLots,null);assert.equal(missing.bidPercent,null);
});
test('零量、單邊缺失與畸形資料不產生假比例',()=>{
  for(const raw of [{},{b:'100_',g:'0_',a:'101_',f:'0_'},{b:'100_',g:'10_'},{b:'100_',g:'-10_',a:'101_',f:'10_'}]){
    assert.equal(parseOrderBook(raw,'TWSE').bidPercent,null);
  }
});
