
const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

function asNum(v){
  if(v === null || v === undefined) return null;
  const s = String(v).replaceAll(",", "").trim();
  if(!s || s === "-" || s === "--") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function rocDateToISO(s){
  const p = String(s).split("/");
  if(p.length !== 3) return s;
  return `${Number(p[0])+1911}-${String(p[1]).padStart(2,"0")}-${String(p[2]).padStart(2,"0")}`;
}
function yyyymmdd(d){
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}01`;
}
function monthList(count){
  const now = new Date();
  const out = [];
  for(let i=count-1;i>=0;i--) out.push(new Date(now.getFullYear(), now.getMonth()-i, 1));
  return out;
}

app.get("/api/snapshot/:symbol", async (req,res) => {
  try{
    const symbol = req.params.symbol.trim();
    const r = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
    if(!r.ok) return res.status(502).json({error:`TWSE OpenAPI ${r.status}`});
    const rows = await r.json();
    const x = rows.find(z => String(z.Code).trim() === symbol);
    if(!x) return res.status(404).json({error:"查不到此上市股票/ETF代號"});
    const close = asNum(x.ClosingPrice);
    const change = asNum(x.Change);
    res.json({
      symbol,
      name:x.Name,
      date:x.Date,
      open:asNum(x.OpeningPrice),
      high:asNum(x.HighestPrice),
      low:asNum(x.LowestPrice),
      close,
      change,
      prev:(close !== null && change !== null) ? close-change : null,
      volumeLots:(asNum(x.TradeVolume)||0)/1000,
      source:"TWSE OpenAPI 最新盤後資料"
    });
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.get("/api/realtime/:symbol", async (req,res) => {
  try{
    const symbol = req.params.symbol.trim();
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${encodeURIComponent(symbol)}.tw&json=1&delay=0&_=${Date.now()}`;
    const r = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0"}});
    if(!r.ok) return res.status(502).json({error:`TWSE MIS ${r.status}`});
    const j = await r.json();
    if(!j.msgArray || !j.msgArray.length) return res.status(404).json({error:"目前沒有即時行情"});
    const x = j.msgArray[0];
    const z = asNum(x.z), y = asNum(x.y);
    res.json({
      symbol,
      name:x.n || x.nf || symbol,
      open:asNum(x.o),
      high:asNum(x.h),
      low:asNum(x.l),
      close:z ?? y,
      prev:y,
      volumeLots:asNum(x.v),
      time:x.t || x.ot || "盤中",
      source:"TWSE MIS 即時行情"
    });
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.get("/api/history/:symbol", async (req,res) => {
  try{
    const symbol = req.params.symbol.trim();
    let months = Math.max(1, Math.min(12, Number(req.query.months)||3));
    const arrays = await Promise.all(monthList(months).map(async d => {
      const date = yyyymmdd(d);
      const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${date}&stockNo=${encodeURIComponent(symbol)}&response=json&_=${Date.now()}`;
      const r = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0"}});
      if(!r.ok) return [];
      const j = await r.json();
      if(j.stat !== "OK" || !Array.isArray(j.data)) return [];
      return j.data.map(row => ({
        date:rocDateToISO(row[0]),
        volumeShares:asNum(row[1]),
        open:asNum(row[3]),
        high:asNum(row[4]),
        low:asNum(row[5]),
        close:asNum(row[6])
      })).filter(x => [x.open,x.high,x.low,x.close].every(v => v !== null));
    }));
    const map = new Map();
    arrays.flat().forEach(x => map.set(x.date,x));
    const data = [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
    res.json({symbol, months, data});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.get("/health", (_,res)=>res.json({ok:true}));

app.listen(PORT, () => console.log(`Taiwan stock app running on port ${PORT}`));
