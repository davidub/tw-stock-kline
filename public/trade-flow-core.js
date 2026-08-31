(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TradeFlowCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function createTracker(threshold=50){
    let symbol=null,lastKey=null,previousPrice=null;
    const totals={large:{buy:0,sell:0},small:{buy:0,sell:0},unknown:0,count:0};
    const points=[];
    function reset(next){symbol=next;lastKey=null;previousPrice=null;totals.large.buy=totals.large.sell=totals.small.buy=totals.small.sell=totals.unknown=totals.count=0;points.length=0;}
    function add(q){
      if(!q||q.symbol!==symbol||!q.lastTrade||q.lastTrade.key===lastKey)return null;
      const trade=q.lastTrade;lastKey=trade.key;
      const bid=q.bids?.[0]?.price,ask=q.asks?.[0]?.price;
      let side=null;
      if(Number.isFinite(ask)&&trade.price>=ask)side='buy';
      else if(Number.isFinite(bid)&&trade.price<=bid)side='sell';
      else if(previousPrice!==null&&trade.price>previousPrice)side='buy';
      else if(previousPrice!==null&&trade.price<previousPrice)side='sell';
      previousPrice=trade.price;
      const size=trade.lots>=threshold?'large':'small';
      if(side)totals[size][side]+=trade.lots;else totals.unknown+=trade.lots;
      totals.count++;
      const point={time:trade.time,price:trade.price,lots:trade.lots,size,side,
        largeNet:totals.large.buy-totals.large.sell,smallNet:totals.small.buy-totals.small.sell};
      points.push(point);if(points.length>240)points.shift();return point;
    }
    return {reset,add,totals,points,get symbol(){return symbol;}};
  }
  return {createTracker};
});
