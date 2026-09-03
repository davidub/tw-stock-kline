(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TradeFlowCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function finite(value){return Number.isFinite(value)?value:null;}
  function createTracker(threshold=50){
    let symbol=null,previousVolume=null,previousPrice=null,lastFetchedAt=null,lastTradeKey=null;
    let volumeEvents=[];
    const stats={intervalLots:0,minuteLots:0,sessionLots:0,bidPercent:null,price:null,
      priceChange:null,direction:'waiting',burst:false,samples:0,actualCount:0,latestActual:null};
    const points=[];

    function reset(next){
      symbol=next;previousVolume=previousPrice=lastFetchedAt=lastTradeKey=null;volumeEvents=[];points.length=0;
      Object.assign(stats,{intervalLots:0,minuteLots:0,sessionLots:0,bidPercent:null,price:null,
        priceChange:null,direction:'waiting',burst:false,samples:0,actualCount:0,latestActual:null});
    }

    function add(q){
      if(!q||q.symbol!==symbol)return null;
      const fetchedAt=String(q.fetchedAt||'');
      if(fetchedAt&&fetchedAt===lastFetchedAt)return null;
      lastFetchedAt=fetchedAt;
      const parsedAt=new Date(fetchedAt).getTime();
      const at=Number.isFinite(parsedAt)?parsedAt:Date.now();
      const volume=finite(q.volumeLots);
      let intervalLots=0,baseline=previousVolume===null||volume===null;
      if(!baseline){
        if(volume>=previousVolume)intervalLots=volume-previousVolume;
        else{volumeEvents=[];stats.sessionLots=0;baseline=true;}
      }
      if(volume!==null)previousVolume=volume;
      intervalLots=Math.max(0,intervalLots);
      if(intervalLots>0){volumeEvents.push({at,lots:intervalLots});stats.sessionLots+=intervalLots;}
      volumeEvents=volumeEvents.filter(x=>x.at>=at-60000);

      const bestBid=finite(q.bids?.[0]?.price),bestAsk=finite(q.asks?.[0]?.price);
      const midpoint=bestBid!==null&&bestAsk!==null?(bestBid+bestAsk)/2:finite(q.marketPoint?.price);
      const priceChange=midpoint!==null&&previousPrice!==null?midpoint-previousPrice:null;
      if(midpoint!==null)previousPrice=midpoint;
      const bidPercent=finite(q.bidPercent);
      let direction='flat';
      if(priceChange>0)direction='up';
      else if(priceChange<0)direction='down';
      else if(bidPercent!==null&&bidPercent>=55)direction='buy-pressure';
      else if(bidPercent!==null&&bidPercent<=45)direction='sell-pressure';

      let actualTrade=null;
      if(q.lastTrade&&q.lastTrade.key!==lastTradeKey){
        lastTradeKey=q.lastTrade.key;actualTrade={...q.lastTrade};stats.actualCount++;stats.latestActual=actualTrade;
      }
      Object.assign(stats,{intervalLots,minuteLots:volumeEvents.reduce((sum,x)=>sum+x.lots,0),
        bidPercent,price:midpoint,priceChange,direction,burst:intervalLots>=threshold,samples:stats.samples+1});
      const point={time:q.lastTradeTime||q.time||'',fetchedAt,intervalLots,minuteLots:stats.minuteLots,
        bidPercent,price:midpoint,priceChange,direction,burst:stats.burst,baseline,actualTrade};
      points.push(point);if(points.length>240)points.shift();return point;
    }
    return {reset,add,stats,points,get symbol(){return symbol;},get threshold(){return threshold;}};
  }
  return {createTracker};
});
