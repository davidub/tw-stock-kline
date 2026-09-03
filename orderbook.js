// MIS: b/g = bid price/quantity; a/f = ask price/quantity. Quantities are lots.
function levels(prices, quantities){
  const p=String(prices??'').split('_'), q=String(quantities??'').split('_');
  const number=s=>s!=null && s.trim()!=='' && Number.isFinite(Number(s)) ? Number(s) : null;
  let incomplete=false;
  const rows=[];
  for(let i=0;i<5;i++){
    const price=number(p[i]), lots=number(q[i]);
    if(price===null && lots===null) continue;
    if(price===null || price<=0 || lots===null || lots<0){incomplete=true;continue;}
    rows.push({level:i+1,price,lots});
  }
  return {rows,incomplete};
}
function parseOrderBook(x, market, now=new Date(), previousTrade=null){
  const bid=levels(x.b,x.g), ask=levels(x.a,x.f);
  const bidLots=bid.rows.length && !bid.incomplete ? bid.rows.reduce((s,r)=>s+r.lots,0) : null;
  const askLots=ask.rows.length && !ask.incomplete ? ask.rows.reduce((s,r)=>s+r.lots,0) : null;
  const total=bidLots!==null && askLots!==null ? bidLots+askLots : null;
  const date=/^\d{8}$/.test(x.d||'') ? `${x.d.slice(0,4)}-${x.d.slice(4,6)}-${x.d.slice(6,8)}` : null;
  const tradePrice=asFinite(x.z), tradeLots=asFinite(x.s);
  const bestBid=bid.rows.find(r=>r.level===1)?.price??null;
  const bestAsk=ask.rows.find(r=>r.level===1)?.price??null;
  const midPrice=bestBid!==null&&bestAsk!==null ? (bestBid+bestAsk)/2 : null;
  const directTrade=tradePrice!==null&&x.t
    ? {key:`${x.d||''}|${x.t}|${tradePrice}|${tradeLots??0}`,price:tradePrice,lots:Math.max(0,tradeLots??0),time:x.t,kind:'trade',date}
    : null;
  const retainedTrade=!directTrade&&previousTrade?.date===date
    ? {...previousTrade,retained:true}
    : null;
  const quoteTrade=directTrade||retainedTrade;
  const lastTrade=directTrade&&tradeLots!==null&&tradeLots>=0
    ? {key:`${x.d||''}|${x.t}|${tradePrice}|${tradeLots}`,price:tradePrice,lots:tradeLots,time:x.t}
    : null;
  const marketPoint=quoteTrade || (midPrice!==null&&x.t
    ? {key:`${x.d||''}|${x.t}|${midPrice}|mid`,price:midPrice,lots:0,time:x.t,kind:'midquote'}
    : null);
  return {symbol:x.c,name:x.n||x.c,market,bids:bid.rows,asks:ask.rows,bidLots,askLots,
    bidPercent:total>0?bidLots/total*100:null,
    incomplete:bid.incomplete||ask.incomplete||!bid.rows.length||!ask.rows.length,
    date,lastTradeTime:x.t||null,fetchedAt:now.toISOString(),lastTrade,marketPoint,
    open:asFinite(x.o),high:asFinite(x.h),low:asFinite(x.l),prev:asFinite(x.y),volumeLots:asFinite(x.v),
    close:marketPoint?.price??null,time:marketPoint?.time||x.t||null,
    priceKind:marketPoint?.kind||null,
    source:'TWSE MIS 普通交易五檔委託快照（張）'};
}
module.exports={levels,parseOrderBook};

function asFinite(value){
  if(value===null||value===undefined||String(value).trim()===''||String(value).trim()==='-')return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}
