/* Remaining schedule from the same finite-resource engine used by the live game. */
(function(root){'use strict';
const S=root.YardSim||(typeof require==='function'?require('./simulation.js'):null);
function* calculate(state,options={}){
 const s=S.restore(S.serialize(state)),origin=s.t;
 const horizon=Math.min(3600,Math.max(600,...s.orders.filter(o=>o.status==='active').flatMap(o=>[o.deadline-origin+300,(o.releaseAt||origin)-origin+600])));
 s.offers=[];s.nextOffer=Number.MAX_SAFE_INTEGER;s.nextEvent=Number.MAX_SAFE_INTEGER;
 const rows=new Map(),seen=new Map(),existing=new Set(state.jobs.map(j=>j.id));let ticks=0;
 function observe(){
  for(const j of s.jobs){
   let row=rows.get(j.id);
   if(!row){row={id:j.id,order:j.order,product:j.product,deadline:j.deadline-origin,start:j.started-origin,alreadyStarted:existing.has(j.id),spans:[],shipped:false};rows.set(j.id,row);seen.set(j.order,(seen.get(j.order)||0)+1);}
   const b=s.buildings.find(b=>b.id===j.location);
   const kind=j.status==='work'?(S.speed(s,b)>0?'work':'stopped'):j.status;
   const facility=j.status==='transfer'?j.target:j.location;
   const stage=j.stage,key=[kind,facility,stage,j.cargo,j.held].join(':');
   let last=row.spans[row.spans.length-1];
   if(!last||last.key!==key){if(last)last.end=s.t-origin;last={key,kind,facility,stage,cargo:j.cargo,start:s.t-origin,end:s.t-origin};row.spans.push(last);}
   last.end=s.t-origin;row.lastSeen=s.t-origin;
  }
  for(const row of rows.values())if(!row.shipped&&!s.jobs.some(j=>j.id===row.id)){
   row.shipped=true;row.finish=s.t-origin;row.spans[row.spans.length-1].end=row.finish;
   const holding=row.spans.find(x=>x.kind==='finished');row.ready=holding?holding.start:row.finish;
   row.late=row.ready>row.deadline+S.STEP+.0001;
  }
 }
 observe();
 while(!s.failed&&s.t-origin<horizon&&s.orders.some(o=>o.status==='active')){
  S.step(s);observe();if(++ticks%250===0)yield {progress:(s.t-origin)/horizon};
 }
 for(const o of state.orders.filter(o=>o.status==='active')){
  const missing=o.quantity-o.shipped-(seen.get(o.id)||0);
  for(let n=0;n<missing;n++)rows.set(o.id+'-pending-'+n,{id:o.id+'-pending-'+n,order:o.id,product:o.product,deadline:o.deadline-origin,start:null,releaseAt:Math.max(0,(o.releaseAt||origin)-origin),spans:[],shipped:false});
 }
 const result=[...rows.values()];
 for(const row of result)if(!row.shipped)row.warning=s.failed?'予測中に資金不足':!state.releaseEnabled&&!row.spans.length?'自動着工が停止中':row.spans.some(x=>x.key.endsWith(':true'))?'手動退避中：出庫再開が必要':row.spans.some(x=>x.kind==='material_funds')?'材料の購入資金待ち':'人員・経路・保全・待ち枠を確認（'+Math.round(horizon/60)+'分先まで予測）';
 result.sort((a,b)=>a.deadline-b.deadline||a.order.localeCompare(b.order)||(a.start??Infinity)-(b.start??Infinity));
 return {origin,horizon:Math.min(horizon,s.t-origin),rows:result,failed:s.failed,ticks,assumptions:'受注済みのみ・現在の人員と経路で予測。着工予約、営業からの伝票、設計後の材料リードタイム、先行在庫と入荷待ち、運搬、待ち枠、保管料、材料費、給与、設備劣化、開始済み修理を反映。今後の商談・ランダムイベント・追加の修理操作は含みません。'};
}
function predict(s){const it=calculate(s);let r;do{r=it.next();}while(!r.done);return r.value;}
const api={calculate,predict};root.YardPlanner=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
