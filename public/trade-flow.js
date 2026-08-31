(()=>{
  const el=id=>document.getElementById(id), input=el('flowThreshold'), canvas=el('flowChart');
  let tracker=TradeFlowCore.createTracker(Number(input.value));
  function taipeiClock(){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const minute=Number(p.hour)*60+Number(p.minute);
    return {date:`${p.year}-${p.month}-${p.day}`,open:!['Sat','Sun'].includes(p.weekday)&&minute>=540&&minute<810};
  }
  function netText(value){return `淨額 ${value>0?'+':''}${value.toLocaleString('zh-TW')} 張`;}
  function paintNet(node,value){node.textContent=netText(value);node.style.color=value>0?'var(--up)':value<0?'var(--down)':'var(--muted)';}
  function update(){
    const t=tracker.totals;
    for(const [id,value] of [['largeBuy',t.large.buy],['largeSell',t.large.sell],['smallBuy',t.small.buy],['smallSell',t.small.sell]])el(id).textContent=value.toLocaleString('zh-TW');
    paintNet(el('largeNet'),t.large.buy-t.large.sell);paintNet(el('smallNet'),t.small.buy-t.small.sell);
    el('flowUnknown').textContent=t.unknown?`無法判斷方向：${t.unknown.toLocaleString('zh-TW')} 張（不計入淨額）`:'尚無無法判斷方向的成交';
    draw();
  }
  function draw(){
    const dpr=devicePixelRatio||1,r=canvas.getBoundingClientRect(),W=r.width,H=r.height;
    canvas.width=W*dpr;canvas.height=H*dpr;const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
    const points=tracker.points,pad={l:47,r:14,t:24,b:29};
    c.font='12px sans-serif';c.fillStyle='#94a3b8';
    if(!points.length){c.fillText('一般盤開啟此頁後，這裡才開始累積推估資料',pad.l,48);return;}
    const values=points.flatMap(x=>[x.largeNet,x.smallNet,0]),bound=Math.max(1,...values.map(Math.abs));
    const innerW=W-pad.l-pad.r,innerH=H-pad.t-pad.b,x=i=>pad.l+(points.length===1?innerW:innerW*i/(points.length-1)),y=v=>pad.t+innerH/2-v/bound*(innerH*.45);
    c.strokeStyle='#334155';c.beginPath();c.moveTo(pad.l,y(0));c.lineTo(W-pad.r,y(0));c.stroke();
    c.fillText(`+${bound}`,5,pad.t+4);c.fillText('0',23,y(0)+4);c.fillText(`-${bound}`,5,H-pad.b);
    for(const [key,color,label] of [['largeNet','#f59e0b','大單'],['smallNet','#38bdf8','小單']]){
      c.strokeStyle=color;c.lineWidth=2;c.beginPath();points.forEach((p,i)=>i?c.lineTo(x(i),y(p[key])):c.moveTo(x(i),y(p[key])));c.stroke();
      c.fillStyle=color;c.fillText(label,W-pad.r-(label==='大單'?82:40),15);
    }
    c.fillStyle='#94a3b8';c.fillText(points[0].time||'',pad.l,H-8);if(points.length>1)c.fillText(points.at(-1).time||'',W-pad.r-55,H-8);
  }
  function reset(symbol,message){tracker.reset(symbol);el('flowStatus').textContent=message||`${symbol}｜已歸零，等待一般盤成交快照`;update();}
  document.addEventListener('depth-snapshot',event=>{
    const q=event.detail,clock=taipeiClock();
    if(tracker.symbol!==q.symbol)reset(q.symbol);
    if(!clock.open||q.date!==clock.date){el('flowStatus').textContent=`${q.symbol}｜目前不是可累積的今日一般盤資料；下次開盤請保持頁面開啟`;return;}
    const point=tracker.add(q);
    el('flowStatus').textContent=`${q.symbol}｜本頁已擷取 ${tracker.totals.count} 筆不重複快照成交${point?`｜最近 ${point.time} ${point.lots} 張（${point.side==='buy'?'推估主動買':point.side==='sell'?'推估主動賣':'方向不明'}）`:'｜這次沒有新的最後成交'}`;
    update();
  });
  document.addEventListener('flow-reset',event=>reset(event.detail.symbol,'等待股票查詢完成'));
  input.addEventListener('change',()=>{
    const threshold=Math.max(1,Math.min(10000,Math.floor(Number(input.value)||50)));input.value=threshold;
    el('largeLabel').textContent=el('smallLabel').textContent=threshold;
    const symbol=tracker.symbol;tracker=TradeFlowCore.createTracker(threshold);reset(symbol,`${symbol||'目前股票'}｜門檻已改為 ${threshold} 張，推估已歸零`);
  });
  addEventListener('resize',draw);update();
})();
