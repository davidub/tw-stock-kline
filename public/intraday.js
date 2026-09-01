(()=>{
  const el=id=>document.getElementById(id),canvas=el('intradayChart'),status=el('intradayStatus');
  let symbol=null,points=[],seen=new Set();
  function taipeiClock(){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    const minute=Number(p.hour)*60+Number(p.minute);
    return {date:`${p.year}-${p.month}-${p.day}`,open:!['Sat','Sun'].includes(p.weekday)&&minute>=540&&minute<810};
  }
  function reset(next){symbol=next||null;points=[];seen.clear();status.textContent=next?`${next}｜等待一般盤價格快照`:'等待股票查詢完成';draw();}
  function add(q){
    const clock=taipeiClock(),trade=q.marketPoint||q.lastTrade;
    if(!clock.open||q.date!==clock.date){status.textContent=`${q.symbol}｜目前非今日一般盤，開盤後將自動累積分時走勢`;draw();return;}
    if(!trade||!Number.isFinite(trade.price)||seen.has(trade.key)){status.textContent=`${q.symbol}｜分時圖已累積 ${points.length} 個價格快照｜等待下一次變化`;return;}
    seen.add(trade.key);points.push({time:trade.time,price:trade.price,lots:Math.max(0,trade.lots||0),kind:trade.kind||'trade'});
    let amount=0,lots=0;for(const p of points){amount+=p.price*Math.max(1,p.lots);lots+=Math.max(1,p.lots);p.average=amount/lots;}
    status.textContent=`${q.symbol}｜已累積 ${points.length} 個價格快照｜最新 ${trade.time}／${trade.price.toLocaleString('zh-TW',{maximumFractionDigits:2})} 元（${trade.kind==='midquote'?'買賣中間價':'成交價'}）`;
    draw();
  }
  function draw(){
    const dpr=devicePixelRatio||1,r=canvas.getBoundingClientRect(),W=r.width,H=r.height;
    canvas.width=W*dpr;canvas.height=H*dpr;const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
    const pad={l:58,r:16,t:22,b:32};c.font='12px sans-serif';c.fillStyle='#94a3b8';
    if(!points.length){c.fillText('一般盤開啟此頁後，這裡會自動繪製今日分時走勢',pad.l,50);return;}
    const values=points.flatMap(p=>[p.price,p.average]),min0=Math.min(...values),max0=Math.max(...values),gap=(max0-min0)*.12||Math.max(max0*.002,0.1),min=min0-gap,max=max0+gap;
    const iw=W-pad.l-pad.r,ih=H-pad.t-pad.b,x=i=>pad.l+(points.length===1?iw/2:iw*i/(points.length-1)),y=v=>pad.t+(max-v)/(max-min)*ih;
    for(let i=0;i<5;i++){const yy=pad.t+ih*i/4;c.strokeStyle='#1f2d42';c.lineWidth=1;c.beginPath();c.moveTo(pad.l,yy);c.lineTo(W-pad.r,yy);c.stroke();c.fillStyle='#8da0b8';c.fillText((max-(max-min)*i/4).toFixed(2),6,yy+4);}
    for(const [key,color] of [['price','#fbbf24'],['average','#60a5fa']]){c.strokeStyle=color;c.lineWidth=2;c.beginPath();points.forEach((p,i)=>i?c.lineTo(x(i),y(p[key])):c.moveTo(x(i),y(p[key])));c.stroke();}
    c.fillStyle='#94a3b8';c.fillText(points[0].time||'',pad.l,H-9);if(points.length>1)c.fillText(points.at(-1).time||'',Math.max(pad.l,W-pad.r-58),H-9);
    const last=points.at(-1);c.fillStyle='#fbbf24';c.beginPath();c.arc(x(points.length-1),y(last.price),3.5,0,Math.PI*2);c.fill();
  }
  document.addEventListener('flow-reset',e=>reset(e.detail.symbol));
  document.addEventListener('depth-snapshot',e=>{const q=e.detail;if(symbol!==q.symbol)reset(q.symbol);add(q);});
  addEventListener('resize',draw);draw();
})();
