const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const {parseOrderBook}=require('./orderbook');

// MIS 的 z/s 是這一個 5 秒揭示是否有成交；沒有成交時會是「-」。
// 保留本服務已看見的今日最近成交價，避免下一個無成交快照把價格抹掉。
const latestTrades=new Map();

app.use('/api',(_req,res,next)=>{
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache');
  res.set('Expires','0');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; TaiwanStockKline/2.0)' };

function asNum(v){
  if(v === null || v === undefined) return null;
  const s = String(v).replace(/,/g,'').replace(/[＋+]/g,'').trim();
  if(!s || s === '-' || s === '--' || s === '---') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function rocDateToISO(s){
  const compact = String(s || '').replace(/[-/]/g,'');
  if(/^\d{7,8}$/.test(compact)){
    const year = compact.length === 7 ? Number(compact.slice(0,3))+1911 : Number(compact.slice(0,4));
    return `${year}-${compact.slice(-4,-2)}-${compact.slice(-2)}`;
  }
  const p = String(s).trim().split('/');
  if(p.length !== 3) return String(s);
  return `${Number(p[0])+1911}-${String(p[1]).padStart(2,'0')}-${String(p[2]).padStart(2,'0')}`;
}
function ymdMonth(d){
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}01`;
}
function slashMonth(d){
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/01`;
}
function monthList(count){
  const now = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Taipei'}));
  const out=[];
  for(let i=count-1;i>=0;i--) out.push(new Date(now.getFullYear(), now.getMonth()-i, 1));
  return out;
}
async function jsonFetch(url){
  const r = await fetch(url,{headers:UA,signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function twseSnapshot(symbol){
  const rows = await jsonFetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
  const x = rows.find(z => String(z.Code || '').trim() === symbol);
  if(!x) return null;
  const close=asNum(x.ClosingPrice), change=asNum(x.Change);
  return {
    market:'TWSE', symbol, name:String(x.Name||symbol).trim(), date:rocDateToISO(x.Date),
    open:asNum(x.OpeningPrice), high:asNum(x.HighestPrice), low:asNum(x.LowestPrice), close, change,
    prev:(close!==null&&change!==null)?close-change:null,
    volumeLots:(asNum(x.TradeVolume)||0)/1000,
    source:'TWSE OpenAPI 最新盤後資料'
  };
}

async function tpexSnapshot(symbol){
  const rows = await jsonFetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
  const x = rows.find(z => String(z.SecuritiesCompanyCode || z.Code || '').trim() === symbol);
  if(!x) return null;
  const close=asNum(x.Close), change=asNum(x.Change);
  return {
    market:'TPEx', symbol, name:String(x.CompanyName || x.SecuritiesCompanyName || x.Name || symbol).trim(), date:rocDateToISO(x.Date),
    open:asNum(x.Open), high:asNum(x.High), low:asNum(x.Low), close, change,
    prev:(close!==null&&change!==null)?close-change:null,
    volumeLots:(asNum(x.TradingShares)||0)/1000,
    source:'TPEx OpenAPI 最新盤後資料'
  };
}

async function detectMarket(symbol){
  let failed=false;
  const a = await twseSnapshot(symbol).catch(()=>{failed=true;return null});
  if(a) return a;
  const b = await tpexSnapshot(symbol).catch(()=>{failed=true;return null});
  if(b) return b;
  if(failed) throw new Error('官方行情來源暫時無法連線，請稍後重試');
  return null;
}
// V4：依股票／ETF 代號或中文名稱搜尋
async function searchInstruments(query){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return [];

  const results = [];

  // 上市 TWSE
  try{
    const rows = await jsonFetch(
      'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'
    );

    for(const x of rows){
      const symbol = String(x.Code || '').trim();
      const name = String(x.Name || '').trim();

      if(
        symbol.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      ){
        results.push({
          symbol,
          name,
          market:'TWSE'
        });
      }
    }
  }catch(_e){}

  // 上櫃 TPEx
  try{
    const rows = await jsonFetch(
      'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'
    );

    for(const x of rows){
      const symbol = String(
        x.SecuritiesCompanyCode || x.Code || ''
      ).trim();

      const name = String(
        x.CompanyName ||
        x.SecuritiesCompanyName ||
        x.Name ||
        ''
      ).trim();

      if(
        symbol.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      ){
        results.push({
          symbol,
          name,
          market:'TPEx'
        });
      }
    }
  }catch(_e){}

  return results.slice(0,20);
}

app.get('/api/search', async (req,res)=>{
  try{
    const q = String(req.query.q || '').trim();

    if(!q){
      return res.status(400).json({
        error:'請輸入股票／ETF 代號或名稱'
      });
    }

    const results = await searchInstruments(q);
    res.json({query:q,results});

  }catch(e){
    res.status(500).json({error:e.message});
  }
});
app.get('/api/snapshot/:symbol', async (req,res)=>{
  try{
    const symbol=req.params.symbol.trim();
    const q=await detectMarket(symbol);
    if(!q) return res.status(404).json({error:'查不到此上市／上櫃股票或 ETF 代號'});
    res.json(q);
  }catch(e){ res.status(500).json({error:e.message}); }
});

async function misQuote(symbol, market){
  const prefix = market === 'TPEx' ? 'otc' : 'tse';
  const url=`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${prefix}_${encodeURIComponent(symbol)}.tw&json=1&delay=0&_=${Date.now()}`;
  const j=await jsonFetch(url);
  if(!j.msgArray || !j.msgArray.length) return null;
  const x=j.msgArray.find(row=>row.c===symbol&&row.ex===prefix) || j.msgArray[0];
  const q=parseLiveRow(x,market);
  if(q.close===null || !q.date) return null;
  const isMid=q.priceKind==='midquote';
  return {
    market, symbol, name:x.n || x.nf || symbol,
    open:q.open, high:q.high, low:q.low, close:q.close, prev:q.prev, date:q.date,
    volumeLots:q.volumeLots, time:q.time || x.ot || '盤中', fetchedAt:q.fetchedAt,
    priceKind:q.priceKind,
    source:isMid
      ? `TWSE MIS ${market==='TPEx'?'上櫃':'上市'}最佳買賣中間價（此快照無成交，非成交價）`
      : `TWSE MIS ${market==='TPEx'?'上櫃':'上市'}最近成交價（5 秒行情快照）`
  };
}

function parseLiveRow(row,market){
  const key=`${market}:${row.c}`;
  const previous=latestTrades.get(key)||null;
  const q=parseOrderBook(row,market,new Date(),previous);
  if(q.marketPoint?.kind==='trade'&&!q.marketPoint.retained) latestTrades.set(key,q.marketPoint);
  return q;
}

app.get('/api/realtime/:symbol', async (req,res)=>{
  try{
    const symbol=req.params.symbol.trim();
    const snap=await detectMarket(symbol);
    if(!snap) return res.status(404).json({error:'查不到此股票代號'});
    const q=await misQuote(symbol,snap.market).catch(()=>null);
    if(!q) return res.status(404).json({error:'目前沒有即時行情'});
    res.json(q);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/api/orderbook/:symbol',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const symbol=req.params.symbol.trim();
  const market=req.query.market;
  if(!/^[0-9A-Za-z]{4,6}$/.test(symbol)||!['TWSE','TPEx'].includes(market)){
    return res.status(400).json({error:'請提供有效的股票代號與市場'});
  }
  try{
    const ex=market==='TPEx'?'otc':'tse';
    const j=await jsonFetch(`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex}_${encodeURIComponent(symbol)}.tw&json=1&delay=0&_=${Date.now()}`);
    const row=j.msgArray?.find(x=>x.c===symbol&&x.ex===ex);
    if(!row)return res.status(404).json({error:'官方目前未提供這檔股票的五檔資料'});
    const q=parseLiveRow(row,market);
    const marketName=market==='TPEx'?'上櫃':'上市';
    q.source=q.priceKind==='midquote'
      ? `TWSE MIS ${marketName}五檔快照；本次無成交價，價格點為買賣中間價`
      : `TWSE MIS ${marketName}五檔與最近成交快照`;
    res.json(q);
  }catch(e){res.status(502).json({error:'五檔來源暫時無法連線，請稍後重試'});}
});

async function twseMonth(symbol,d){
  const date=ymdMonth(d);
  // 官方歷史個股日成交資料。先用 exchangeReport；若官方路由調整，再退回 rwd 路由。
  const urls=[
    `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${encodeURIComponent(symbol)}`,
    `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${date}&stockNo=${encodeURIComponent(symbol)}&response=json`
  ];
  for(const url of urls){
    try{
      const j=await jsonFetch(url);
      if(Array.isArray(j.data) && j.data.length){
        return j.data.map(row=>({
          date:rocDateToISO(row[0]), volumeShares:asNum(row[1]), open:asNum(row[3]), high:asNum(row[4]), low:asNum(row[5]), close:asNum(row[6])
        })).filter(x=>[x.open,x.high,x.low,x.close].every(v=>v!==null));
      }
    }catch(_e){}
  }
  return [];
}

async function tpexMonth(symbol,d){
  const date=slashMonth(d);
  const url=`https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock?date=${encodeURIComponent(date)}&code=${encodeURIComponent(symbol)}&response=json`;
  try{
    const j=await jsonFetch(url);
    const table=Array.isArray(j.tables)?j.tables[0]:null;
    const rows=table && Array.isArray(table.data)?table.data:[];
    // TPEx 欄位：日期、成交張數、成交仟元、開盤、最高、最低、收盤、漲跌、筆數
    return rows.map(row=>({
      date:rocDateToISO(row[0]), volumeShares:(asNum(row[1])||0)*1000, open:asNum(row[3]), high:asNum(row[4]), low:asNum(row[5]), close:asNum(row[6])
    })).filter(x=>[x.open,x.high,x.low,x.close].every(v=>v!==null));
  }catch(_e){ return []; }
}

app.get('/api/history/:symbol', async (req,res)=>{
  try{
    const symbol=req.params.symbol.trim();
    const months=Math.max(1,Math.min(12,Math.floor(Number(req.query.months)||3)));
    const snap=await detectMarket(symbol);
    if(!snap) return res.status(404).json({error:'查不到此上市／上櫃股票或 ETF 代號'});
    const fn=snap.market==='TPEx'?tpexMonth:twseMonth;
    // 順序抓取，降低官方網站短時間大量請求被限流的機率。
    const arrays=[];
    const requestedMonths=monthList(months);
    const fetchMonths=monthList(months+4);
    for(const d of fetchMonths) arrays.push(await fn(symbol,d));
    const map=new Map();
    arrays.flat().forEach(x=>map.set(x.date,x));
    const allData=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
    const first=ymdMonth(requestedMonths[0]);
    const data=allData.filter(x=>x.date.replace(/-/g,'')>=first);
    const warmup=allData.filter(x=>x.date.replace(/-/g,'')<first);
    const missingMonths=fetchMonths.filter((_,i)=>!arrays[i].length).map(ymdMonth);
    res.json({symbol,market:snap.market,months,data,warmup,warning:missingMonths.length ? `有 ${missingMonths.length} 個月份未取得 K 線（含均線計算所需月份），K 線或均線可能不完整` : null});
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.get('/health',(_,res)=>res.json({ok:true,version:'2.0'}));
app.listen(PORT,()=>console.log(`Taiwan stock app V2 running on port ${PORT}`));
