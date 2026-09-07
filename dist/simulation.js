/* RAILWORKS YARD v0.1 — deterministic spatial simulation. No DOM dependency. */
(function(root){'use strict';
const Catalog=root.RailworksCatalog||(typeof require==='function'?require('./catalog.js'):null);
const STEP=.1, WIDTH=38, HEIGHT=30, VERSION=1;
const TYPES={
 design:{name:'設計スタジオ',short:'設計',stage:0,cost:4200,upkeep:.20,color:'#329bbc',sprite:0,desc:'図面をつくる最初の工程。設計の重い車種に。'},
 machining:{name:'加工工場',short:'加工',stage:1,cost:5200,upkeep:.30,color:'#cc8c34',sprite:1,desc:'車体や部品を加工。並列化で加工待ちを解消。'},
 assembly:{name:'組立工場',short:'組立',stage:2,cost:4800,upkeep:.25,color:'#278b71',sprite:2,desc:'部品を一両に組み立てる。観光車の制約工程。'},
 inspection:{name:'検査工場',short:'検査',stage:3,cost:4400,upkeep:.25,color:'#8a69a6',sprite:3,desc:'完成車両を検査。高速車の長い試験に備える。'},
 warehouse:{name:'中間倉庫',short:'倉庫',stage:null,cost:2400,upkeep:.18,color:'#698a53',sprite:4,desc:'6両の中間品を保管。満杯の工程から退避できる。'},
 maintenance:{name:'保全工房',short:'保全',stage:null,cost:3400,upkeep:.25,color:'#bb6c52',sprite:5,desc:'人員を配置すると工場全体の劣化を軽減。'}
};
const PRODUCT_IDS=Object.keys(Catalog.VEHICLES);
const PRODUCTS=Object.fromEntries(Object.entries(Catalog.VEHICLES).map(([id,v])=>[id,{...v,id,sale:v.sale*10,cost:v.cost*10,work:v.work.map(n=>n*1.2+6)}]));
const SCENARIOS={
 coast:{name:'潮風の車両工場',sub:'はじめての工場長',desc:'小さな工場から4章を通して発展。投入・倉庫・保全・増設を学ぶ。',cash:18000,seed:113,chapter:0},
 surge:{name:'注文が押し寄せる街',sub:'受注と生産のバランス',desc:'短い納期の注文の波。仕掛を抑え、20両を出荷し、営業利益18,000Gへ。',cash:24000,seed:287,chapter:0},
 rescue:{name:'止まった工場を救え',sub:'修理と人員再配置',desc:'傷んだ加工工場を立て直す。修理2回・出荷12両・営業利益8,000Gが目標。',cash:20000,seed:591,chapter:0},
 sandbox:{name:'自由に育てる工場',sub:'サンドボックス',desc:'初期資金60,000G。制限時間なしで配置・雇用・投資を実験。',cash:60000,seed:731,chapter:0}
};
const CHAPTERS=[
 {title:'最初の出荷を、この工場から。',reward:3000,hint:'まずは操業開始。受注済みの3両が流れます。組立の進み方を観察しましょう。',lesson:'出荷が売上を生みます。全員が忙しいことより、最後まで流れることを優先しましょう。',goals:[['delivered',3,'累計出荷', '両']]},
 {title:'待ちを見つけて、流れを整える。',reward:4000,hint:'倉庫を建て、詰まる工程へ人を配置。受注画面で次の注文を引き受けましょう。',lesson:'倉庫は一時的な待ちを受け止めます。継続的に詰まるなら、制約工程の能力や投入量を見直します。',goals:[['warehouses',1,'中間倉庫','棟'],['delivered',8,'累計出荷','両'],['profit',5000,'累計営業利益','G']]},
 {title:'止まっても、立て直せる工場。',reward:5000,hint:'加工工場に故障発生。修理中は新規投入を絞り、余った人を他工程へ。',lesson:'修理だけでなく予防保全が必要です。常に満杯では、故障後に遅れを取り戻す余力がなくなります。',goals:[['repairs',1,'修理完了','回'],['delivered',13,'累計出荷','両'],['profit',10000,'累計営業利益','G']]},
 {title:'利益でつくる、次の生産ライン。',reward:8000,hint:'用地を拡張して生産工場を増設。増えた設備にも人員を配置しましょう。',lesson:'再投資は制約を動かします。増設後は別の工程が詰まっていないか、納期と在庫も一緒に見直します。',goals:[['productionBuildings',5,'生産工場','棟'],['expanded',1,'用地拡張','回'],['delivered',22,'累計出荷','両'],['profit',18000,'累計営業利益','G']]}
];
const clone=v=>JSON.parse(JSON.stringify(v)), clamp=(n,l,h)=>Math.max(l,Math.min(h,n));
function makeBuilding(id,type,x,y,staff=0){return {id,type,x,y,staff,level:1,condition:100,broken:false,repairRemaining:0,preventive:false,queue:[],active:null,progress:0,busyTime:0,blockedTime:0,completed:0};}
function create(scenario='coast'){
 if(!SCENARIOS[scenario])scenario='coast';const cfg=SCENARIOS[scenario];
 const s={version:VERSION,scenario,t:0,seed:cfg.seed,initialCash:cfg.cash,cash:cfg.cash,employees:10,expanded:false,wipLimit:5,releaseEnabled:true,priority:'edd',chapter:0,claimed:[],completedScenario:false,failed:false,
  buildings:[makeBuilding('b1','design',7,7,2),makeBuilding('b2','machining',12,7,2),makeBuilding('b3','assembly',12,13,2),makeBuilding('b4','inspection',7,13,2)],jobs:[],orders:[],offers:[],nextBuilding:5,nextJob:1,nextOrder:1,nextOffer:28,nextEvent:115,lastRelease:-10,routeVersion:0,
  metrics:{delivered:0,ontime:0,late:0,repairs:0,upgrades:0,builds:0,transportTiles:0,cycleTotal:0},ledger:{revenue:0,materials:0,cogs:0,operating:0,wages:0,upkeep:0,storage:0,penalties:0,service:0,capex:0,rewards:0},events:[],news:[],history:[],lastHistory:0,shipping:[],effects:[],_cache:{}};
 for(let i=0;i<3;i++)s.offers.push(makeOffer(s,i===0?'kintetsu':i===1?'odakyu':'kintetsu',1,220+i*45));
 const first=[...s.offers];first.forEach(o=>accept(s,o.id));
 for(let i=0;i<3;i++)s.offers.push(makeOffer(s,scenario==='surge'?'e235':i===0?'kintetsu':i===1?'n700':'e235',i===0?2:1,scenario==='surge'?170:270+i*50));
 if(scenario==='rescue'){s.buildings[1].broken=true;s.buildings[1].condition=0;s.buildings[3].condition=20;news(s,'加工工場が故障中','設備をタップして修理を依頼してください。','alert','b2');}
 news(s,'小さな工場の、大きな一歩','受注済みの3両を製造します。未配置の従業員が2人います。','info');return s;
}
function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function news(s,title,body,kind='info',buildingId=null){s.news.unshift({id:Math.round(s.t*100)+'-'+s.news.length,title,body,kind,buildingId,t:s.t});s.news=s.news.slice(0,30);}
function income(s,n,category){s.cash+=n;s.ledger[category]+=n;}
function expense(s,n,category){s.cash-=n;s.ledger[category]+=n;if(!['materials','capex'].includes(category))s.ledger.operating+=n;}
function profit(s){return s.ledger.revenue-s.ledger.cogs-s.ledger.operating;}
function freeStaff(s){return s.employees-s.buildings.reduce((n,b)=>n+b.staff,0);}
function stageBuildings(s,stage){return s.buildings.filter(b=>TYPES[b.type].stage===stage);}
function port(b){return {x:b.x+1,y:b.y+3};}
const supply={x:4,y:10},dispatch={x:4,y:20};
function blocked(s,x,y){return x<1||y<1||x>=WIDTH-1||y>=27||s.buildings.some(b=>x>=b.x&&x<b.x+3&&y>=b.y&&y<b.y+3);}
function route(s,from,to){
 const key=`${s.routeVersion}:${from.x},${from.y}:${to.x},${to.y}`;if(s._cache?.[key])return s._cache[key];
 if(blocked(s,to.x,to.y)||blocked(s,from.x,from.y))return null;
 const start=from.y*WIDTH+from.x,goal=to.y*WIDTH+to.x,q=[start],prev=new Map([[start,null]]);let head=0;
 while(head<q.length){const p=q[head++];if(p===goal)break;const x=p%WIDTH,y=Math.floor(p/WIDTH);for(const [nx,ny] of [[x+1,y],[x,y+1],[x-1,y],[x,y-1]]){const n=ny*WIDTH+nx;if(!prev.has(n)&&!blocked(s,nx,ny)){prev.set(n,p);q.push(n);}}}
 if(!prev.has(goal))return null;const out=[];for(let p=goal;p!==null;p=prev.get(p))out.push({x:p%WIDTH,y:Math.floor(p/WIDTH)});out.reverse();s._cache??={};s._cache[key]=out;return out;
}
function incoming(s,id){return s.jobs.filter(j=>j.status==='transfer'&&j.target===id).length;}
function room(s,b){return TYPES[b.type].stage===null?(b.type==='warehouse'?6*b.level-b.queue.length-incoming(s,b.id):0):2-b.queue.length-incoming(s,b.id);}
function wip(s){return s.jobs.length;}
function conditionSpeed(b){return b.condition<30?.8:1;}
function speed(s,b){if(b.broken||b.repairRemaining>0||!b.staff)return 0;const boost=s.events.some(e=>e.kind==='morale'&&e.until>s.t)?1.2:1;return (b.staff===1?.55:1+(b.staff-2)*.33)*(1+(b.level-1)*.3)*conditionSpeed(b)*boost;}
function predictedWait(s,b){const job=s.jobs.find(j=>j.id===b.active),work=job?.status==='work'?Math.max(0,PRODUCTS[job.product].work[job.stage]-b.progress):job?20:0;return work/(speed(s,b)||.2)+(b.queue.length+incoming(s,b.id))*25;}
function candidate(s,stage,from){return stageBuildings(s,stage).filter(b=>!b.broken&&b.repairRemaining<=0&&b.staff>0&&room(s,b)>0).map(b=>({b,path:route(s,from,port(b))})).filter(x=>x.path).sort((a,b)=>predictedWait(s,a.b)+a.path.length-predictedWait(s,b.b)-b.path.length)[0];}
function travel(s,j,target,path){j.status='transfer';j.target=target;j.path=path;j.travel=0;const rate=s.events.some(e=>e.kind==='transport'&&e.until>s.t)?3.5:2.5;j.travelTime=Math.max(.5,(path.length-1)/rate);j.location=null;s.metrics.transportTiles+=Math.max(0,path.length-1);}
function makeOffer(s,product=null,quantity=null,dueIn=null){
 const p=product||(['kintetsu','e235','odakyu','n700','panorama','freight','modular','precision'][Math.floor(rand(s)*8)]);
 const q=quantity||1+Math.floor(rand(s)*2);return {id:'o'+s.nextOrder++,product:p,quantity:q,deadline:s.t+(dueIn||(s.scenario==='surge'?160:240)+q*60),expires:s.t+110,status:'offer',created:s.t,unitSale:PRODUCTS[p].sale};
}
function accept(s,id){const o=s.offers.find(o=>o.id===id);if(!o||o.expires<s.t||s.failed)return {ok:false,message:'この商談の受付は終了しています。'};if(s.orders.filter(o=>o.status==='active').length>=10)return {ok:false,message:'進行中の受注は10件までです。'};s.offers=s.offers.filter(o=>o.id!==id);o.status='active';o.released=0;o.shipped=0;o.late=0;s.orders.push(o);news(s,PRODUCTS[o.product].name+'を'+o.quantity+'両受注','仕掛上限に空きができると自動で着工します。','good');return {ok:true,message:'受注しました。材料費は着工時に支払います。'};}
function reject(s,id){s.offers=s.offers.filter(o=>o.id!==id);return {ok:true,message:'受注を見送りました。'};}
function release(s){
 if(!s.releaseEnabled||wip(s)>=s.wipLimit||s.t-s.lastRelease<4||s.failed)return;
 const orders=s.orders.filter(o=>o.status==='active'&&o.released<o.quantity).sort((a,b)=>s.priority==='fifo'?a.created-b.created:a.deadline-b.deadline);
 for(const o of orders){const p=PRODUCTS[o.product];if(s.cash<p.cost)continue;const c=candidate(s,0,supply);if(!c)return;
 const j={id:'j'+s.nextJob++,product:o.product,order:o.id,stage:0,started:s.t,deadline:o.deadline,materialCost:p.cost,status:'transfer',location:null,target:null};s.jobs.push(j);expense(s,p.cost,'materials');o.released++;travel(s,j,c.b.id,c.path);s.lastRelease=s.t;return;}
}
function routeReady(s,j,b){
 const from=port(b);if(j.stage===4){const path=route(s,from,dispatch);if(!path)return false;travel(s,j,'dispatch',path);return true;}
 const c=candidate(s,j.stage,from);if(c){travel(s,j,c.b.id,c.path);return true;}
 if(b.type!=='warehouse'){
 const warehouses=s.buildings.filter(b=>b.type==='warehouse'&&room(s,b)>0).map(b=>({b,path:route(s,from,port(b))})).filter(x=>x.path).sort((a,b)=>a.path.length-b.path.length);
 if(warehouses.length){travel(s,j,warehouses[0].b.id,warehouses[0].path);return true;}}
 return false;
}
function deliver(s,j){
 const o=s.orders.find(o=>o.id===j.order),late=s.t>j.deadline,p=PRODUCTS[j.product];
 income(s,o.unitSale,'revenue');s.ledger.cogs+=j.materialCost;if(late){expense(s,o.unitSale*Math.min(.25,.05+(s.t-j.deadline)*.001),'penalties');s.metrics.late++;o.late++;}else s.metrics.ontime++;
 s.metrics.delivered++;s.metrics.cycleTotal+=s.t-j.started;o.shipped++;if(o.shipped===o.quantity)o.status='complete';
 s.shipping.push({t:s.t,ontime:!late});s.shipping=s.shipping.filter(x=>s.t-x.t<120);s.effects.push({kind:'delivery',t:s.t,product:j.product,amount:o.unitSale});
 news(s,`${p.name}を出荷 +${o.unitSale.toLocaleString()}G`,late?'納期超過のため遅延控除が発生しました。':'納期内に出荷。利益を次の投資へ。',late?'alert':'good');s.jobs=s.jobs.filter(x=>x.id!==j.id);
}
function step(s,dt=STEP){
 if(s.failed)return;if(!Number.isFinite(dt)||dt<=0||dt>1)throw Error('step accepts 0 < dt <= 1');s.t+=dt;
 s.events=s.events.filter(e=>e.until>s.t);s.effects=s.effects.filter(e=>s.t-e.t<4);
 for(const j of [...s.jobs])if(j.status==='transfer'){j.travel+=dt;if(j.travel>=j.travelTime){if(j.target==='dispatch'){deliver(s,j);continue;}const b=s.buildings.find(b=>b.id===j.target);j.status=b.type==='warehouse'?'buffer':'queue';j.location=b.id;j.target=null;b.queue.push(j.id);}}
 const protective=s.buildings.filter(b=>b.type==='maintenance'&&b.staff>0).length>0;
 for(const b of s.buildings){
  if(b.repairRemaining>0){b.repairRemaining=Math.max(0,b.repairRemaining-dt);if(!b.repairRemaining){b.condition=100;b.broken=false;if(!b.preventive)s.metrics.repairs++;b.preventive=false;news(s,TYPES[b.type].short+'が復帰しました','生産を再開できます。','good',b.id);}continue;}
  if(b.type==='warehouse'){for(const id of [...b.queue]){const j=s.jobs.find(j=>j.id===id);if(j&&routeReady(s,j,b))b.queue=b.queue.filter(x=>x!==id);}continue;}
  if(TYPES[b.type].stage===null)continue;
  if(b.active){const j=s.jobs.find(j=>j.id===b.active);if(j.status==='blocked'){if(routeReady(s,j,b)){b.active=null;b.progress=0;}else b.blockedTime+=dt;continue;}}
  if(!b.active&&b.queue.length&&!b.broken&&b.staff&&b.repairRemaining<=0){b.queue.sort((a,c)=>{const ja=s.jobs.find(j=>j.id===a),jc=s.jobs.find(j=>j.id===c);return s.priority==='fifo'?ja.started-jc.started:ja.deadline-jc.deadline;});b.active=b.queue.shift();const j=s.jobs.find(j=>j.id===b.active);j.status='work';b.progress=0;}
  if(b.active&&!b.broken&&b.staff){const j=s.jobs.find(j=>j.id===b.active);b.progress+=dt*speed(s,b);b.busyTime+=dt;b.condition=Math.max(0,b.condition-dt*(protective?.035:.075));if(b.condition<=0){b.broken=true;news(s,TYPES[b.type].short+'が故障','設備を選んで修理してください。','alert',b.id);continue;}
   if(b.progress>=PRODUCTS[j.product].work[j.stage]){b.completed++;j.stage++;j.status='blocked';if(routeReady(s,j,b)){b.active=null;b.progress=0;}}}
 }
 const wages=s.employees*.48*dt,upkeep=s.buildings.reduce((a,b)=>a+TYPES[b.type].upkeep*b.level,0)*dt,stock=s.jobs.filter(j=>j.status==='buffer').length*.45*dt;
 expense(s,wages,'wages');expense(s,upkeep,'upkeep');expense(s,stock,'storage');release(s);
 if(s.t>=s.nextOffer){if(s.offers.length<6)s.offers.push(makeOffer(s));s.nextOffer=s.t+(s.scenario==='surge'?18:34);}
 s.offers=s.offers.filter(o=>o.expires>=s.t);
 if(s.t>=s.nextEvent){triggerEvent(s);s.nextEvent=s.t+100+rand(s)*70;}
 if(s.t-s.lastHistory>=5){s.lastHistory=s.t;s.history.push({t:s.t,cash:s.cash,profit:profit(s),wip:wip(s),shipped:s.shipping.filter(e=>s.t-e.t<=60).length});if(s.history.length>240)s.history.shift();}
 if(s.cash< -3000){s.failed=true;news(s,'資金繰りが限界に達しました','一時停止して振り返り、新しい工場で再挑戦できます。','alert');}
}
function triggerEvent(s,forced){
 const n=forced??Math.floor(rand(s)*4);
 if(n===0){const bs=s.buildings.filter(b=>TYPES[b.type].stage!==null&&!b.broken&&!b.repairRemaining);if(!bs.length)return;const b=bs[Math.floor(rand(s)*bs.length)];b.condition=Math.max(0,b.condition-28);if(b.condition===0)b.broken=true;news(s,TYPES[b.type].short+'に異音の報告','状態が28低下。予防保全で突然の停止を防げます。','alert',b.id);}
 if(n===1){const o=makeOffer(s,'kintetsu',2,150);o.unitSale=Math.round(o.unitSale*1.25);s.offers.unshift(o);s.offers=s.offers.slice(0,6);news(s,'臨時便の増備依頼','観光旅客車2両、売価25%増。納期まで150秒。受注画面へ。','good');}
 if(n===2){s.events.push({kind:'morale',until:s.t+35});news(s,'現場の改善提案を採用','35秒間、すべての作業速度が20%向上。','good');}
 if(n===3){s.events.push({kind:'transport',until:s.t+30});news(s,'構内の運搬を集中支援','30秒間、新しく出発する運搬が速くなります。','good');}
}
function buildCheck(s,type,x,y){
 if(!TYPES[type])return {ok:false,message:'設備の種類が不明です。'};if(!Number.isInteger(x)||!Number.isInteger(y)||x<2||y<2||x+3>WIDTH-2||y+3>26)return {ok:false,message:'工場用地の中に配置してください。'};
 if(!s.expanded&&(x+3>24||y+3>23))return {ok:false,message:'この区画は用地拡張で開放されます。'};
 if(s.buildings.some(b=>x<b.x+4&&x+4>b.x&&y<b.y+4&&y+4>b.y))return {ok:false,message:'設備と搬入口の間を1マス以上空けてください。'};
 if([supply,dispatch].some(p=>p.x>=x-1&&p.x<x+4&&p.y>=y-1&&p.y<y+4))return {ok:false,message:'搬入・出荷ゲートには建設できません。'};
 if(s.buildings.length>=36)return {ok:false,message:'試作版は設備36棟までです。'};
 return {ok:true,message:'ここに建設できます。'};
}
function build(s,type,x,y){const c=buildCheck(s,type,x,y);if(!c.ok)return c;if(s.cash<TYPES[type].cost)return {ok:false,message:'建設資金が足りません。'};const b=makeBuilding('b'+s.nextBuilding++,type,x,y);s.buildings.push(b);s.routeVersion++;s._cache={};expense(s,TYPES[type].cost,'capex');s.metrics.builds++;news(s,TYPES[type].name+'が完成',TYPES[type].stage!==null||type==='maintenance'?'設備を選んで人員を配置してください。':'倉庫に退避できる中間品が6両増えました。','good',b.id);return {ok:true,message:TYPES[type].name+'を建設しました。',id:b.id};}
function assign(s,id,delta){const b=s.buildings.find(b=>b.id===id);if(!b||b.type==='warehouse'||![-1,1].includes(delta))return {ok:false,message:'この設備には配置できません。'};if(delta>0&&(freeStaff(s)<1||b.staff>=4))return {ok:false,message:b.staff>=4?'1設備に最大4人までです。':'未配置の従業員がいません。雇用するか、他工程から移してください。'};if(delta<0&&b.staff===0)return {ok:false,message:'配置されている人がいません。'};b.staff+=delta;return {ok:true,message:delta>0?'1人配置しました。':'1人を未配置に戻しました。'};}
function hire(s){if(s.cash<350||s.employees>=60)return {ok:false,message:s.employees>=60?'試作版は60人までです。':'採用費350Gが足りません。'};expense(s,350,'service');s.employees++;return {ok:true,message:'1人採用しました。設備へ配置してください。'};}
function dismiss(s){if(freeStaff(s)<1)return {ok:false,message:'先に設備から1人を未配置に戻してください。'};if(s.cash<200)return {ok:false,message:'退職支援費200Gが足りません。'};expense(s,200,'service');s.employees--;return {ok:true,message:'未配置の1人が退職しました。'};}
function repair(s,id,preventive=false){const b=s.buildings.find(b=>b.id===id);if(!b||TYPES[b.type].stage===null||b.repairRemaining)return {ok:false,message:'いまは保全できません。'};if(preventive&&b.broken)return {ok:false,message:'故障修理を選んでください。'};if(!preventive&&!b.broken)return {ok:false,message:'故障していません。予防保全を選んでください。'};if(preventive&&b.condition>=99)return {ok:false,message:'現在は良好です。'};const cost=preventive?300:800;if(s.cash<cost)return {ok:false,message:'保全費が足りません。'};expense(s,cost,'service');b.preventive=preventive;b.repairRemaining=preventive?8:16;return {ok:true,message:preventive?'予防保全を開始。8秒で完了します。':'修理を開始。16秒で復帰します。'};}
function upgrade(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||b.level>=3)return {ok:false,message:'設備はレベル3までです。'};const cost=upgradeCost(b);if(s.cash<cost)return {ok:false,message:'改良資金が足りません。'};expense(s,cost,'capex');b.level++;s.metrics.upgrades++;return {ok:true,message:b.type==='warehouse'?'保管容量を6両増やしました。':'設備を改良しました。'};}
function upgradeCost(b){return Math.round(TYPES[b.type].cost*.55*b.level);}
function expand(s){if(s.expanded)return {ok:false,message:'用地はすべて開放済みです。'};if(s.cash<6000)return {ok:false,message:'用地取得費6,000Gが足りません。'};expense(s,6000,'capex');s.expanded=true;return {ok:true,message:'東・北の区画を開放しました。マップを移動して建設できます。'};}
function demolish(s,id){const b=s.buildings.find(b=>b.id===id);if(!b)return {ok:false,message:'設備が見つかりません。'};if(b.active||b.queue.length||incoming(s,id)||b.repairRemaining)return {ok:false,message:'作業・待ち・運搬・保全が完了してから撤去できます。'};const stage=TYPES[b.type].stage;if(stage!==null&&stageBuildings(s,stage).length===1)return {ok:false,message:'各工程に最低1棟必要です。先に代わりを建ててください。'};const spent=TYPES[b.type].cost+(b.level>=2?Math.round(TYPES[b.type].cost*.55):0)+(b.level>=3?Math.round(TYPES[b.type].cost*1.1):0),refund=Math.round(spent*.35);s.cash+=refund;s.ledger.capex-=refund;s.buildings=s.buildings.filter(x=>x.id!==id);s.routeVersion++;s._cache={};return {ok:true,message:refund.toLocaleString()+'Gを回収しました。配置人員は未配置に戻ります。'};}
function measure(s,key){switch(key){case'profit':return Math.floor(profit(s));case'warehouses':return s.buildings.filter(b=>b.type==='warehouse').length;case'productionBuildings':return s.buildings.filter(b=>TYPES[b.type].stage!==null).length;case'expanded':return +s.expanded;default:return s.metrics[key]||0;}}
function mission(s){
 let m;if(s.scenario==='coast')m=CHAPTERS[Math.min(s.chapter,3)];
 else if(s.scenario==='surge')m={title:'波を乗りこなす工場長',reward:7000,hint:'受けすぎない勇気も必要。仕掛上限と納期順で流れを整えます。',lesson:'受注残と仕掛は別物です。製造中の数を抑えると、現場の待ちが短くなります。',goals:[['delivered',20,'累計出荷','両'],['profit',18000,'累計営業利益','G']]};
 else if(s.scenario==='rescue')m={title:'もう一度、動き出す工場',reward:7000,hint:'赤い加工工場を修理。検査工場の状態にも注意してください。',lesson:'目の前の故障と次の故障は別に備えます。余力と予防保全が復旧後の安定をつくります。',goals:[['repairs',2,'修理完了','回'],['delivered',12,'累計出荷','両'],['profit',8000,'累計営業利益','G']]};
 else return {title:'思い描いた工場を、自由に。',hint:'建設・雇用・物流を自由に実験できます。',goals:[],ready:false,complete:false};
 return {...m,goals:m.goals.map(([key,target,label,unit])=>({key,target,label,unit,value:measure(s,key)})),ready:!s.completedScenario&&m.goals.every(([key,target])=>measure(s,key)>=target),complete:s.completedScenario};
}
function claim(s){const m=mission(s);if(!m.ready)return {ok:false,message:'まだ目標を達成していません。'};income(s,m.reward,'rewards');s.claimed.push(s.chapter);if(s.scenario==='coast'&&s.chapter<3){s.chapter++;if(s.chapter===2){const b=s.buildings.find(b=>b.type==='machining');b.broken=true;b.condition=0;news(s,'加工設備が緊急停止','修理を依頼し、滞留を抑えましょう。','alert',b.id);}}else s.completedScenario=true;return {ok:true,message:'目標達成！ '+m.reward.toLocaleString()+'Gの助成を獲得。',lesson:m.lesson,complete:s.completedScenario};}
function summary(s){return {profit:profit(s),wip:wip(s),freeStaff:freeStaff(s),ontime:s.metrics.delivered?s.metrics.ontime/s.metrics.delivered:1,rate:s.shipping.filter(e=>s.t-e.t<=60).length,averageCycle:s.metrics.delivered?s.metrics.cycleTotal/s.metrics.delivered:0,warehouseStock:s.jobs.filter(j=>j.status==='buffer').length,warehouseCapacity:s.buildings.filter(b=>b.type==='warehouse').reduce((n,b)=>n+6*b.level,0)};}
function status(s,b){if(b.repairRemaining)return {label:b.preventive?'予防保全中':'修理中',kind:'repair'};if(b.broken)return {label:'故障停止',kind:'broken'};if(b.type==='warehouse')return {label:`保管 ${b.queue.length} / ${6*b.level}`,kind:b.queue.length>=6*b.level?'blocked':'storage'};if(b.type==='maintenance')return {label:b.staff?'予防支援中':'人員未配置',kind:b.staff?'working':'idle'};if(!b.staff)return {label:'人員未配置',kind:'idle'};const j=s.jobs.find(j=>j.id===b.active);if(j?.status==='blocked')return {label:'後工程待ち',kind:'blocked'};if(b.active)return {label:'作業中',kind:'working'};return {label:b.queue.length?'順番待ち':'受入待ち',kind:'idle'};}
function serialize(s){const c=clone({...s,_cache:undefined});return JSON.stringify(c);}
function restore(raw){let s;try{s=JSON.parse(raw);}catch(_){throw Error('保存データを読み込めません。');}if(!s||s.version!==VERSION||!SCENARIOS[s.scenario]||!Array.isArray(s.buildings)||!Array.isArray(s.jobs)||!Array.isArray(s.orders)||!Array.isArray(s.offers)||!s.ledger||!s.metrics||!Array.isArray(s.news))throw Error('対応していない保存データです。');
 if(!Number.isFinite(s.cash)||!Number.isFinite(s.t)||s.buildings.length>36||s.jobs.length>100||s.orders.length>10000)throw Error('保存データの値が不正です。');
 const ids=new Set(s.buildings.map(b=>b.id));if(ids.size!==s.buildings.length||s.buildings.some(b=>!TYPES[b.type]||!Number.isInteger(b.x)||!Number.isInteger(b.y)||!Array.isArray(b.queue)||!Number.isInteger(b.staff)||b.staff<0||b.staff>4))throw Error('設備データが不正です。');
 if(s.jobs.some(j=>!PRODUCTS[j.product]||!Number.isInteger(j.stage)||j.stage<0||j.stage>4||!['work','queue','buffer','blocked','transfer'].includes(j.status)))throw Error('車両データが不正です。');s._cache={};return s;}
const api={STEP,WIDTH,HEIGHT,VERSION,TYPES,PRODUCTS,PRODUCT_IDS,SCENARIOS,CHAPTERS,supply,dispatch,create,step,route,port,makeOffer,accept,reject,build,buildCheck,assign,hire,dismiss,repair,upgrade,upgradeCost,expand,demolish,claim,mission,summary,status,profit,wip,freeStaff,incoming,speed,serialize,restore,triggerEvent,news};root.YardSim=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
