const depthController=(()=>{
  const el=id=>document.getElementById(id);
  const format=n=>n==null?'—':n.toLocaleString('zh-TW',{maximumFractionDigits:2});
  let target=null,timer=null,controller=null,generation=0,busy=false;
  function clock(){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const minute=Number(parts.hour)*60+Number(parts.minute);
    return {date:`${parts.year}-${parts.month}-${parts.day}`,session:!['Sat','Sun'].includes(parts.weekday)&&minute>=540&&minute<810};
  }
  function empty(){
    el('bidTotal').textContent=el('askTotal').textContent='—';
    el('bidBar').style.width=el('askBar').style.width='0%';
    el('depthRatio').textContent='無可比較的完整雙邊數量';
    el('depthTime').textContent='尚未取得資料';
    el('depthRows').innerHTML=Array.from({length:5},(_,i)=>`<tr><td>—</td><td>—</td><td class="level">${i+1}</td><td>—</td><td>—</td></tr>`).join('');
  }
  function reset(){
    ++generation;clearTimeout(timer);controller?.abort();controller=null;busy=false;target=null;
    empty();el('depthRefresh').disabled=true;el('depthStatus').textContent='等待股票查詢完成';
    document.dispatchEvent(new CustomEvent('flow-reset',{detail:{symbol:null}}));
  }
  function render(q){
    const c=clock();
    const sameDate=q.date===c.date;
    const phase=!c.session?'非一般盤時段｜最後揭示資料':!sameDate?'來源不是今日資料｜不可視為即時掛單':'一般盤查詢時段｜來源快照，可能延遲';
    el('depthStatus').textContent=`${target.symbol} ${target.name||''}｜${phase}${q.incomplete?'｜部分檔位缺值，比例可能無法計算':''}`;
    el('bidTotal').textContent=q.bidLots==null?'資料不足':`${format(q.bidLots)} 張`;
    el('askTotal').textContent=q.askLots==null?'資料不足':`${format(q.askLots)} 張`;
    const pct=q.bidPercent;
    el('bidBar').style.width=pct==null?'0%':`${pct}%`;
    el('askBar').style.width=pct==null?'0%':`${100-pct}%`;
    el('depthRatio').textContent=pct==null?'雙邊資料不足或合計為零，無法計算比例':`已揭示掛單占比：買方 ${pct.toFixed(1)}% ／ 賣方 ${(100-pct).toFixed(1)}%（買量 ÷ 買賣合計）`;
    const max=Math.max(1,...q.bids.map(x=>x.lots),...q.asks.map(x=>x.lots));
    el('depthRows').innerHTML=Array.from({length:5},(_,i)=>{
      const b=q.bids.find(x=>x.level===i+1),a=q.asks.find(x=>x.level===i+1);
      return `<tr><td class="quantity depth-buy" style="--bar:${(b?.lots||0)/max*100}%">${format(b?.lots)}</td><td>${format(b?.price)}</td><td class="level">${i+1}</td><td>${format(a?.price)}</td><td class="quantity depth-sell" style="--bar:${(a?.lots||0)/max*100}%">${format(a?.lots)}</td></tr>`;
    }).join('');
    const fetched=new Date(q.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
    el('depthTime').textContent=`交易日 ${q.date||'未提供'}｜最近成交 ${q.lastTradeTime||'未提供'}｜畫面更新 ${fetched}`;
    document.dispatchEvent(new CustomEvent('depth-snapshot',{detail:q}));
  }
  function schedule(){
    clearTimeout(timer);
    if(!target||!el('depthAuto').checked||document.hidden)return;
    // Outside normal hours, only check the clock; do not hit the quote endpoint.
    timer=setTimeout(()=>{if(clock().session)refresh();else schedule();},10000);
  }
  async function refresh(){
    if(!target||busy)return;
    clearTimeout(timer);busy=true;el('depthRefresh').disabled=true;
    const version=generation,stock=target;
    controller=new AbortController();
    const requestController=controller;
    const timeout=setTimeout(()=>requestController.abort(),20000);
    try{
      const r=await fetch(`/api/orderbook/${encodeURIComponent(stock.symbol)}?market=${stock.market}`,{signal:controller.signal,cache:'no-store'});
      const q=await r.json();
      if(version!==generation)return;
      if(!r.ok)throw new Error(q.error||'無法取得五檔');
      if(q.symbol!==stock.symbol)throw new Error('來源股票代號不一致');
      render(q);
    }catch(e){
      if(version!==generation)return;
      empty();el('depthStatus').textContent=`${stock.symbol}｜五檔更新失敗：${e.name==='AbortError'?'連線逾時':e.message}。未以舊數字代替。`;
    }finally{
      clearTimeout(timeout);
      if(version===generation){busy=false;controller=null;el('depthRefresh').disabled=false;schedule();}
    }
  }
  function start(symbol,market,name){reset();target={symbol,market,name};document.dispatchEvent(new CustomEvent('flow-reset',{detail:{symbol}}));refresh();}
  el('depthRefresh').onclick=refresh;
  el('depthAuto').onchange=()=>{if(el('depthAuto').checked&&clock().session&&!document.hidden)refresh();else schedule();};
  document.addEventListener('visibilitychange',()=>{
    clearTimeout(timer);
    if(!document.hidden&&el('depthAuto').checked){if(clock().session)refresh();else schedule();}
  });
  empty();
  return {reset,start};
})();
