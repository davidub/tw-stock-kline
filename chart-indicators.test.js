const {test}=require('node:test');const assert=require('node:assert/strict');const {ema,add}=require('./public/chart-indicators');
const rows=Array.from({length:70},(_,i)=>({open:i+1,high:i+2,low:i,close:i+1,volumeShares:1000}));
test('EMA 常數序列保持常數',()=>assert.deepEqual(ema([5,5,5,5],3),[5,5,5,5]));
test('布林通道 20 日、KD 9 日與 MACD 欄位',()=>{const r=add(rows);assert.equal(r[18].bb,null);assert.ok(Math.abs(r[19].bb.middle-10.5)<1e-10);assert.ok(r[19].bb.upper>r[19].bb.middle&&r[19].bb.lower<r[19].bb.middle);assert.equal(r[7].kd,null);assert.ok(r[8].kd.k>=0&&r[8].kd.k<=100&&r[8].kd.d>=0&&r[8].kd.d<=100);assert.equal(r[69].macd.hist,r[69].macd.dif-r[69].macd.signal);});
test('不完整價格不捏造布林值',()=>{const x=rows.slice(0,20).map(x=>({...x}));x[5].close=null;assert.equal(add(x)[19].bb,null);});
