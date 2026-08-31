(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChartIndicators=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function ema(values,period){const a=2/(period+1);let previous=null;return values.map(v=>{if(!Number.isFinite(v))return null;previous=previous===null?v:a*v+(1-a)*previous;return previous;});}
  function add(rows){
    const closes=rows.map(x=>x.close),e12=ema(closes,12),e26=ema(closes,26),dif=closes.map((_,i)=>e12[i]===null||e26[i]===null?null:e12[i]-e26[i]),signal=ema(dif,9);let k=50,d=50;
    return rows.map((row,i)=>{
      let bb=null,kd=null;
      if(i>=19){const w=closes.slice(i-19,i+1);if(w.every(Number.isFinite)){const middle=w.reduce((s,v)=>s+v,0)/20,sd=Math.sqrt(w.reduce((s,v)=>s+(v-middle)**2,0)/20);bb={upper:middle+2*sd,middle,lower:middle-2*sd};}}
      if(i>=8){const w=rows.slice(i-8,i+1),high=Math.max(...w.map(x=>x.high)),low=Math.min(...w.map(x=>x.low));if(Number.isFinite(high)&&Number.isFinite(low)&&high!==low){const rsv=(row.close-low)/(high-low)*100;k=k*2/3+rsv/3;d=d*2/3+k/3;kd={k,d};}}
      const macd=dif[i]===null||signal[i]===null?null:{dif:dif[i],signal:signal[i],hist:dif[i]-signal[i]};return {...row,bb,kd,macd};
    });
  }
  return {ema,add};
});
