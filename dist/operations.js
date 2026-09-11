/* Player decisions. Uses the same simulation for live play, previews and time advance. */
(function(root){'use strict';
const S=root.YardSim||(typeof require==='function'?require('./simulation.js'):null);
const STAGES=['design','machining','assembly','inspection'],STARTER_GRANT=38000;
const TUTORIAL={
 layout:{n:1,title:'工場の編成を決めよう',body:'各工程を1〜3並列で設計。増やすほど同時に作れますが、設備維持費と給与も増えます。',panel:'layout',cta:'最初のラインを編成'},
 order:{n:2,title:'最初の1両を受注しよう',body:'受注は約束。ここでは支払いも入金もありません。まず観光旅客車を1両引き受けましょう。',panel:'orders',cta:'商談を開く'},
 launch:{n:3,title:'受注伝票を設計へ送ろう',body:'材料はまだ買いません。設計のあとに発注し、到着した材料を加工へ運びます。',panel:'flow',cta:'生産計画を確認'},
 watch:{n:3,title:'伝票が到着。設計が始まる！',body:'「次の変化まで」で、着工や工程完了まで進められます。大切な場面では時間が止まります。',panel:'flow',cta:'計画を見る'},
 funding:{n:4,title:'材料を発注して、お金が減った',body:'この1両の材料費は2,850G。手配した時点で現金を支払います。ここまで売上は0G。給与・維持費もゲーム時間に応じて掛かります。',panel:'finance',cta:'お金の流れを見る'},
 manufacture:{n:4,title:'完成へ。次に詰まる工程は？',body:'工程カードから人員や並列数を確認できます。「次の変化まで」で材料到着や作業完了を追いましょう。',panel:'flow',cta:'工程を調整'},
 shipping:{n:5,title:'完成した。でも、売上はまだ0G',body:'完成品倉庫で保管中です。「工場出荷する」を押し、出荷口を通過させて初めて売上が入ります。',panel:'shipping',cta:'最初の工場出荷へ'},
 debrief:{n:6,title:'初出荷！ 4,300Gが入金された',body:'現金は材料発注で減り、工場出荷で増えます。次は自分で受注・編成・着工時刻をつなぎましょう。',panel:'finance',cta:'入金を確認'}
};
function layoutQuote(s,counts){
 if(!Array.isArray(counts)||counts.length!==4||counts.some(n=>!Number.isInteger(n)||n<1||n>3))return {ok:false,message:'各工程は1〜3並列で選んでください。'};
 const facilities=counts.reduce((n,v)=>n+v,0),employees=Math.max(10,facilities*2),equipment=counts.reduce((n,v,i)=>n+v*S.TYPES[STAGES[i]].cost,0),cost=Math.max(0,equipment-STARTER_GRANT),upkeep=counts.reduce((n,v,i)=>n+v*S.TYPES[STAGES[i]].upkeep,0);
 return {ok:s.cash-cost>=12500,message:s.cash-cost>=12500?'この編成で始められます。':'材料・給与のため、開始時の現金を12,500G以上残してください。',equipment,cost,employees,facilities,upkeep,burn:employees*.48+upkeep,remaining:s.cash-cost,grant:STARTER_GRANT};
}
function configureLayout(s,counts){
 if(s.failed||s.t!==0||s.jobs.length||s.tutorial?.step!=='layout')return {ok:false,message:'初期編成はチュートリアルの最初に設定します。操業後は工程ごとに増設できます。'};
 const q=layoutQuote(s,counts);if(!q.ok)return q;
 const next=[];let id=1;
 counts.forEach((n,stage)=>{for(let col=0;col<n;col++){const old=s.buildings.find(b=>b.type===STAGES[stage]);next.push({...old,id:'b'+id++,x:7+col*5,y:3+stage*5,staff:2,queue:[],active:null,progress:0});}});
 s.buildings=next;s.nextBuilding=id;s.employees=q.employees;s.cash-=q.cost;s.ledger.capex+=q.cost;
 if(q.cost){s.transactions.unshift({t:s.t,amount:-q.cost,category:'capex',cash:s.cash});}
 s.routeDefaults={};s.routeVersion++;s._cache={};s.tutorial={...s.tutorial,step:'order',configured:true,counts:[...counts]};
 S.news(s,'あなたのラインが完成',counts.join(' → ')+'並列。'+q.employees+'人で操業します。','good');
 return {ok:true,message:'編成を決定しました。次は受注を体験しましょう。'};
}
function tutorialContinue(s){
 const t=s.tutorial;if(!t)return {ok:false,message:'案内は完了しています。'};
 if(t.step==='launch'){t.step='watch';s.releaseEnabled=true;return {ok:true,message:'受注伝票を送ります。設計後の材料購入に注目！'};}
 if(t.step==='funding'){t.step='manufacture';return {ok:true,message:'材料を待ちながら、製造と運搬を進めます。'};}
 if(t.step==='debrief'){t.step='done';s.nextOffer=s.t+16;s.nextDecision=s.t+25;s.nextEvent=s.t+75;
  for(const p of ['kintetsu','odakyu','e235'])s.offers.push(S.makeOffer(s,p,1,180));
  return {ok:true,message:'チュートリアル完了！ 次の3件の商談が届きました。'};
 }
 return {ok:false,message:'案内に沿って操作してみましょう。'};
}
function finance(s){
 const q=S.summary(s),commitment=S.materialCommitment(s),fixed=s.employees*.48+s.buildings.reduce((n,b)=>n+S.TYPES[b.type].upkeep*b.level,0),storage=q.floorStock*.6+q.warehouseStock*.25+q.finishedStock*.9+S.materialSummary(s).fee,burn=fixed+storage,reserve=burn*60;
 const finished=s.jobs.filter(j=>j.status==='finished'),uncollected=finished.reduce((n,j)=>n+(s.orders.find(o=>o.id===j.order)?.unitSale||0),0);
 return {cash:s.cash,commitment,burn,reserve,available:Math.max(0,s.cash-commitment-reserve),shortfall:Math.max(0,commitment+reserve-s.cash),uncollected,finished:finished.length};
}
function shipNow(s,id){
 if(s.failed)return {ok:false,message:'資金が尽きた工場からは出荷できません。'};
 const j=s.jobs.find(j=>j.id===id&&j.status==='finished');if(!j)return {ok:false,message:'完成品倉庫に到着した車両を選んでください。'};
 const o=s.orders.find(o=>o.id===j.order),fee=!o.training&&s.t<j.deadline?Math.round(o.unitSale*.02):0;
 S.dispatchJob(s,j,true);
 return {ok:true,message:'工場出荷！ 売上 '+o.unitSale.toLocaleString()+'Gを入金'+(fee?'（前倒し便 '+fee+'G）':'')+'。'};
}
function addParallel(s,stage){
 if(s.failed||!Number.isInteger(stage)||stage<0||stage>3)return {ok:false,message:'増設する工程を選んでください。'};
 if(s.tutorial?.step==='layout')return {ok:false,message:'最初の編成を先に決めてください。'};
 const type=STAGES[stage],count=s.buildings.filter(b=>b.type===type).length;
 if(count>=3)return {ok:false,message:'この画面では3並列まで。さらに増やす場合は建設タブを使えます。'};
 const hires=Math.max(0,2-S.freeStaff(s)),cost=S.TYPES[type].cost+hires*350;
 if(s.cash<=cost||s.employees+hires>60)return {ok:false,message:'設備費と必要な採用費、操業を続ける資金が必要です。'};
 const positions=[];for(const y of [3+stage*5,3,8,13,18])for(const x of [7,12,17,22,27,32])positions.push({x,y});
 const pos=positions.find(p=>S.buildCheck(s,type,p.x,p.y).ok);if(!pos)return {ok:false,message:'搬入口を確保できる空き区画がありません。建設タブで用地を拡張してください。'};
 // Perform on a clone, then commit once, so a failed hire/build never leaves half an action.
 const trial=S.restore(S.serialize(s)),r=S.build(trial,type,pos.x,pos.y);if(!r.ok)return r;
 for(let i=0;i<hires;i++){const h=S.hire(trial);if(!h.ok)return h;}
 S.assign(trial,r.id,1);S.assign(trial,r.id,1);Object.assign(s,trial);
 return {ok:true,message:S.TYPES[type].short+'を'+(count+1)+'並列に。新しい設備に2人を配置しました。',id:r.id};
}
function loads(s){return STAGES.map((type,i)=>{const bs=s.buildings.filter(b=>b.type===type),work=s.jobs.filter(j=>j.stage===i).reduce((n,j)=>{const b=bs.find(b=>b.active===j.id);return n+Math.max(0,S.PRODUCTS[j.product].work[i]-(b?.progress||0));},0),capacity=bs.reduce((n,b)=>n+S.speed(s,b),0);return {stage:i,type,bs,count:bs.length,staff:bs.reduce((n,b)=>n+b.staff,0),busy:bs.filter(b=>S.status(s,b).kind==='working').length,waiting:bs.reduce((n,b)=>n+b.queue.length+S.incoming(s,b.id),0),work,capacity,seconds:work/(capacity||.01)};});}
function chooseSupport(s,choice,stage){
 if(s.failed||!s.decision||s.decision.expires<=s.t)return {ok:false,message:'この応援便の受付は終了しました。'};
 if(choice==='pass'){s.decision=null;return {ok:true,message:'今回は支出を抑えます。'};}
 if(choice==='focus'){
  if(!Number.isInteger(stage)||stage<0||stage>3)return {ok:false,message:'応援する工程を選んでください。'};
  if(s.cash<=220)return {ok:false,message:'応援費220Gと操業を続ける資金が必要です。'};
  S.payService(s,220);s.events.push({kind:'focus',stage,until:s.t+35});
 }else if(choice==='materials'){
  const lots=s.materials.filter(l=>l.readyAt>s.t);if(!lots.length)return {ok:false,message:'いまは到着待ちの資材がありません。'};
  if(s.cash<=180)return {ok:false,message:'速達費180Gと操業を続ける資金が必要です。'};
  S.payService(s,180);for(const lot of lots){lot.readyAt=Math.max(s.t,lot.readyAt-12);for(const j of s.jobs.filter(j=>j.materialLot===lot.id))j.materialReadyAt=lot.readyAt;}
 }else return {ok:false,message:'応援の方法を選んでください。'};
 s.decision=null;return {ok:true,message:choice==='focus'?S.TYPES[STAGES[stage]].short+'の能力が35秒間35%アップ！':'到着待ちの材料を最大12秒早めました！'};
}
function attention(s){
 const guide=TUTORIAL[s.tutorial?.step];if(guide)return {title:guide.title,detail:guide.body,panel:guide.panel};
 if(s.decision)return {title:'応援便：あと'+Math.ceil(s.decision.expires-s.t)+'秒で受付終了',detail:'工程の加速か、材料の速達か。今の詰まりに合わせて選択。',panel:'events'};
 const b=s.buildings.find(b=>b.broken&&!b.repairRemaining);if(b)return {title:S.TYPES[b.type].short+'が故障停止',detail:'修理と人員配置を見直せます。',panel:'staff'};
 const finished=s.jobs.filter(j=>j.status==='finished');if(finished.length)return {title:finished.length+'両が完成・未入金',detail:'前倒し出荷で資金回収するか、納期の自動出荷を待つか。',panel:'shipping'};
 if(s.jobs.some(j=>j.status==='material_funds'))return {title:'材料の購入資金が不足',detail:'完成品の出荷や投資を見直しましょう。',panel:'finance'};
 const bottleneck=loads(s).sort((a,b)=>b.seconds-a.seconds)[0];if(bottleneck.waiting>=2)return {title:S.TYPES[bottleneck.type].short+'に待ち '+bottleneck.waiting+'両',detail:'人員を移すか、2・3並列にするか。次の工程の余裕も確認。',panel:'layout'};
 if(s.offers.length)return {title:'新しい商談 '+s.offers.length+'件',detail:'納期・工程負荷・手元資金を見て次の受注を選ぼう。',panel:'orders'};
 return {title:'次の変化まで進められます',detail:'給与・保管料も時間に応じて精算し、判断の場面で停止。',panel:'flow'};
}
function signature(s){return JSON.stringify([s.failed,s.tutorial?.step,s.ledger.materials,s.metrics.delivered,s.orders.reduce((n,o)=>n+o.released,0),s.offers.map(o=>o.id),s.decision?.id,s.news[0]?.id,s.jobs.map(j=>[j.id,j.stage,j.status,Math.ceil(j.deadline-s.t)<=5]),s.buildings.map(b=>[b.id,b.broken,!!b.repairRemaining])]);}
function advanceToDecision(s,max=60){
 if(!Number.isFinite(max)||max<=0||max>120)return {ok:false,message:'進める時間が不正です。'};
 const start=s.t,before=signature(s);for(let n=0;n<Math.ceil(max/S.STEP);n++){S.step(s);if(s.t===start||s.failed||signature(s)!==before)break;}
 return {ok:s.t>start,seconds:s.t-start,message:s.t>start?((s.t-start).toFixed(1)+'秒進行。'+attention(s).title):'チュートリアルの案内に沿って操作してください。'};
}
const api={STAGES,STARTER_GRANT,TUTORIAL,layoutQuote,configureLayout,tutorialContinue,finance,shipNow,addParallel,loads,chooseSupport,attention,advanceToDecision};
root.YardOperations=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
