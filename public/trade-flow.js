(()=>{
  const el=id=>document.getElementById(id),input=el('flowThreshold'),canvas=el('flowChart');
  let tracker=TradeFlowCore.createTracker(Number(input.value));
  function taipeiClock(){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const minute=Number(p.hour)*60+Number(p.minute);
    return {date:`${p.year}-${p.month}-${p.day}`,open:!['Sat','Sun'].includes(p.weekday)&&minute>=540&&minute<810};
  }
  const fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
  function directionText(t){
    if(t.direction==='up')return '中間價上升';if(t.direction==='down')return '中間價下降';
    if(t.direction==='buy-pressure')return '買方掛單較強';if(t.direction==='sell-pressure')return '賣方掛單較強';
    if(t.direction==='waiting')return '等待第二筆快照';return '價格暫時持平';
  }
  function update(){
    const t=tracker.stats;
    el('flowInterval').textContent=`${fmt(t.intervalLots)} 張`;
    el('flowMinute').textContent=`${fmt(t.minuteLots)} 張`;
    el('flowSession').textContent=`本頁累計 ${fmt(t.sessionLots)} 張`;
    el('flowPressure').textContent=t.bidPercent==null?'資料不足':`買方 ${t.bidPercent.toFixed(1)}%`;
    el('flowPressureNote').textContent=t.bidPercent==null?'等待完整雙邊五檔':`賣方 ${(100-t.bidPercent).toFixed(1)}%`;
    el('flowDirection').textContent=directionText(t);
    el('flowMove').textContent=t.priceChange==null?'尚無比較基準':`中間價變動 ${t.priceChange>0?'+':''}${fmt(t.priceChange)} 元`;
    const burst=el('flowBurst');burst.textContent=t.burst?`放量：最近 5 秒增加 ${fmt(t.intervalLots)} 張`:`一般量能（放量門檻 ${tracker.threshold} 張）`;burst.className=`flow-alert${t.burst?' active':''}`;
    const a=t.latestActual;
    el('flowActual').textContent=a?`已捕捉 ${t.actualCount} 筆實際成交快照｜最近 ${a.time}／${fmt(a.price)} 元／${fmt(a.lots)} 張`:'目前未取得含完整成交價量的快照；量能仍依累計成交量差更新';
    draw();
  }
  function draw(){
    const dpr=devicePixelRatio||1,r=canvas.getBoundingClientRect(),W=r.width,H=r.height;
    canvas.width=W*dpr;canvas.height=H*dpr;const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
    const points=tracker.points,pad={l:48,r:40,t:25,b:31};c.font='12px sans-serif';c.fillStyle='#94a3b8';
    if(!points.length){c.fillText('取得第一筆快照後，開始顯示每 5 秒量能與五檔壓力',pad.l,48);return;}
    const innerW=W-pad.l-pad.r,innerH=H-pad.t-pad.b,step=innerW/Math.max(points.length,1),maxVolume=Math.max(1,...points.map(x=>x.intervalLots));
    const x=i=>pad.l+step*i+step/2,volumeY=v=>pad.t+innerH-v/maxVolume*innerH,pressureY=v=>pad.t+(100-v)/100*innerH;
    for(const pct of [0,50,100]){const yy=pressureY(pct);c.strokeStyle='#243247';c.beginPath();c.moveTo(pad.l,yy);c.lineTo(W-pad.r,yy);c.stroke();c.fillStyle='#8da0b8';c.fillText(`${pct}%`,W-pad.r+5,yy+4);}
    points.forEach((p,i)=>{const top=volumeY(p.intervalLots),width=Math.max(2,Math.min(10,step*.65));c.fillStyle=p.burst?'#f59e0bcc':'#38bdf866';c.fillRect(x(i)-width/2,top,width,pad.t+innerH-top);});
    c.beginPath();c.strokeStyle='#fbbf24';c.lineWidth=2;let started=false;points.forEach((p,i)=>{if(p.bidPercent==null)return;const xx=x(i),yy=pressureY(p.bidPercent);started?c.lineTo(xx,yy):c.moveTo(xx,yy);started=true;});c.stroke();
    c.fillStyle='#38bdf8';c.fillText('5 秒量',pad.l,15);c.fillStyle='#fbbf24';c.fillText('買方五檔占比',pad.l+58,15);
    c.fillStyle='#94a3b8';c.fillText(points[0].time||'',pad.l,H-9);if(points.length>1)c.fillText(points.at(-1).time||'',Math.max(pad.l,W-pad.r-58),H-9);
  }
  function reset(symbol,message){tracker.reset(symbol);el('flowStatus').textContent=message||`${symbol}｜等待第一筆累計成交量基準`;update();}
  document.addEventListener('depth-snapshot',event=>{
    const q=event.detail,clock=taipeiClock();if(tracker.symbol!==q.symbol)reset(q.symbol);
    if(!clock.open||q.date!==clock.date){el('flowStatus').textContent=`${q.symbol}｜目前不是今日一般盤，僅顯示最後揭示資料，不繼續累積`;return;}
    const point=tracker.add(q);if(!point)return;
    el('flowStatus').textContent=point.baseline?`${q.symbol}｜已建立成交量基準，下一次更新開始計算 5 秒增量`:`${q.symbol}｜已分析 ${tracker.stats.samples} 個快照｜最近 ${point.time||'未提供時間'}`;
    update();
  });
  document.addEventListener('flow-reset',event=>reset(event.detail.symbol,'等待股票查詢完成'));
  input.addEventListener('change',()=>{const threshold=Math.max(1,Math.min(10000,Math.floor(Number(input.value)||50)));input.value=threshold;const symbol=tracker.symbol;tracker=TradeFlowCore.createTracker(threshold);reset(symbol,`${symbol||'目前股票'}｜放量門檻改為每 5 秒 ${threshold} 張，已重新建立基準`);});
  addEventListener('resize',draw);update();
})();
