const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../dist/simulation.js');
function advance(s,seconds){for(let i=0;i<Math.round(seconds/S.STEP);i++)S.step(s);}
function conserved(s){
 const ids=new Set(s.jobs.map(j=>j.id));assert.equal(ids.size,s.jobs.length);
 const placed=[];for(const b of s.buildings){placed.push(...b.queue);if(b.active)placed.push(b.active);assert(b.staff>=0&&b.staff<=4);assert(b.queue.length+S.incoming(s,b.id)<=(b.type==='warehouse'?6*b.level:2));}
 for(const j of s.jobs){assert.equal(placed.filter(id=>id===j.id).length,j.status==='transfer'?0:1);assert(s.orders.some(o=>o.id===j.order));}
 for(const o of s.orders)assert.equal(o.released-o.shipped,s.jobs.filter(j=>j.order===o.id).length);
 const l=s.ledger;assert(Math.abs(s.cash-(s.initialCash+l.revenue+l.rewards-l.materials-l.operating-l.capex))<.00001);
 assert.equal(S.freeStaff(s)+s.buildings.reduce((n,b)=>n+b.staff,0),s.employees);
}
function play(s,limit=1500){
 S.assign(s,'b3',1);S.assign(s,'b3',1);
 for(let i=0;i<limit/S.STEP&&!s.failed;i++){
  if(i%10===0){
   for(const b of s.buildings)if(b.broken&&!b.repairRemaining)S.repair(s,b.id);
   const active=s.orders.filter(o=>o.status==='active').reduce((n,o)=>n+o.quantity-o.shipped,0);
   if(active<5){const o=s.offers.find(o=>o.product==='kintetsu')||s.offers[0];if(o&&s.cash>S.PRODUCTS[o.product].cost*o.quantity+2000)S.accept(s,o.id);}
   if(S.mission(s).ready){S.claim(s);if(s.completedScenario)return s;}
   if(s.chapter>=1&&!s.buildings.some(b=>b.type==='warehouse')&&s.cash>6500)S.build(s,'warehouse',18,13);
   if(s.chapter>=3){if(!s.expanded&&s.cash>14000)S.expand(s);if(s.expanded&&s.buildings.filter(b=>S.TYPES[b.type].stage!==null).length<5&&s.cash>12000){const r=S.build(s,'assembly',18,7);if(r.ok){S.hire(s);S.hire(s);S.assign(s,r.id,1);S.assign(s,r.id,1);}}}
   conserved(s);
  }S.step(s);
 }return s;
}
test('initial three orders ship exactly once; cash, materials and jobs reconcile',()=>{const s=S.create();advance(s,250);assert.equal(s.metrics.delivered,3);assert.equal(s.jobs.length,0);assert.equal(s.ledger.revenue,14700);conserved(s);});
test('material purchase reduces cash but stays outside cost of sales until shipment',()=>{const s=S.create();advance(s,1);assert(s.ledger.materials>0);assert.equal(s.ledger.cogs,0);assert.equal(S.profit(s),-s.ledger.operating);conserved(s);});
test('build restrictions and insufficient cash never consume funds',()=>{const s=S.create(),cash=s.cash;for(const p of [['assembly',12,13],['warehouse',-2,10],['warehouse',27,10],['warehouse',4,10]])assert.equal(S.build(s,...p).ok,false);assert.equal(s.cash,cash);s.cash=100;assert.equal(S.build(s,'warehouse',18,13).ok,false);assert.equal(s.cash,100);});
test('employment and assignment conserve staff and refuse excess assignment',()=>{const s=S.create();assert(S.assign(s,'b3',1).ok);assert(S.assign(s,'b3',1).ok);assert.equal(S.assign(s,'b3',1).ok,false);assert.equal(S.dismiss(s).ok,false);assert(S.assign(s,'b1',-1).ok);assert(S.dismiss(s).ok);assert(S.hire(s).ok);conserved(s);});
test('full downstream blocks upstream; a warehouse permits physical spill and later recovery',()=>{const s=S.create('sandbox');s.wipLimit=12;S.assign(s,'b4',-1);S.assign(s,'b4',-1);for(let n=0;n<4;n++){const o=S.makeOffer(s,'kintetsu',2,900);s.offers.push(o);S.accept(s,o.id);}advance(s,180);assert(s.buildings.some(b=>S.status(s,b).kind==='blocked'));const r=S.build(s,'warehouse',18,13);assert(r.ok);advance(s,30);assert(s.jobs.some(j=>j.status==='buffer'||j.target===r.id));conserved(s);S.assign(s,'b4',1);S.assign(s,'b4',1);advance(s,400);assert(s.metrics.delivered>=8);conserved(s);});
test('shortest paths avoid occupied tiles and far placements require more transport',()=>{const s=S.create();const near=S.route(s,S.supply,S.port(s.buildings[0]));assert(S.expand(s).ok);const r=S.build(s,'design',30,7);assert(r.ok);const far=S.route(s,S.supply,S.port(s.buildings.find(b=>b.id===r.id)));assert(far.length>near.length);for(const p of far)assert(!s.buildings.some(b=>p.x>=b.x&&p.x<b.x+3&&p.y>=b.y&&p.y<b.y+3));});
test('parallel facilities receive work, addressing the routing comparator regression',()=>{const s=S.create('sandbox');const r=S.build(s,'design',18,7);S.assign(s,r.id,1);S.assign(s,r.id,1);s.wipLimit=12;for(let n=0;n<4;n++){const o=S.makeOffer(s,'odakyu',2,900);s.offers.push(o);S.accept(s,o.id);}advance(s,300);assert(s.buildings.find(b=>b.id===r.id).completed>0);assert(s.buildings[0].completed>0);conserved(s);});
test('repair resumes interrupted work, takes time, and cannot be purchased twice',()=>{const s=S.create();advance(s,6);const b=s.buildings[0];assert(b.active);b.broken=true;b.condition=0;const p=b.progress,j=b.active;assert(S.repair(s,b.id).ok);assert.equal(S.repair(s,b.id).ok,false);advance(s,8);assert.equal(b.progress,p);assert.equal(b.active,j);advance(s,9);assert.equal(b.broken,false);assert.equal(s.metrics.repairs,1);assert(b.progress>p||b.completed>0);conserved(s);});
test('preventive maintenance and staffed maintenance shop protect equipment',()=>{const s=S.create();s.buildings[0].condition=60;assert(S.repair(s,'b1',true).ok);advance(s,9);assert(s.buildings[0].condition>99);assert.equal(s.metrics.repairs,0);const a=S.create('sandbox'),b=S.create('sandbox');const r=S.build(b,'maintenance',18,13);S.assign(b,r.id,1);advance(a,100);advance(b,100);assert(b.buildings[2].condition>a.buildings[2].condition);});
test('lowering work in progress limit does not delete work already in process',()=>{const s=S.create();advance(s,20);const ids=s.jobs.map(j=>j.id);assert(ids.length>=2);s.wipLimit=2;advance(s,1);assert(ids.every(id=>s.jobs.some(j=>j.id===id)));conserved(s);});
test('completed scenario reward cannot be claimed repeatedly',()=>{const s=play(S.create('surge'));assert(s.completedScenario);const cash=s.cash;assert.equal(S.claim(s).ok,false);assert.equal(s.cash,cash);});
test('save and restore continue with identical routing, finances and random events',()=>{const a=S.create();advance(a,35);const b=S.restore(S.serialize(a));advance(a,210);advance(b,210);assert.equal(S.serialize(a),S.serialize(b));assert.throws(()=>S.restore('{broken'));assert.throws(()=>S.restore('{"version":999}'));});
test('all three scenarios have a reproducible strategy that completes goals',()=>{const report=[];for(const scenario of ['coast','surge','rescue']){const s=play(S.create(scenario));assert.equal(s.completedScenario,true,scenario);assert(!s.failed);conserved(s);report.push({scenario,seconds:Math.round(s.t),shipments:s.metrics.delivered,profit:Math.round(S.profit(s)),cash:Math.round(s.cash),repairs:s.metrics.repairs});}console.log('SCENARIO_REPORT '+JSON.stringify(report));});
test('insolvency freezes the simulation; continuing never drains more funds',()=>{const s=S.create();s.cash=-2999;S.step(s,1);assert(s.failed);const t=s.t,cash=s.cash;S.step(s);assert.equal(s.t,t);assert.equal(s.cash,cash);});
test('event transport support actually reduces duration of newly dispatched transport',()=>{const a=S.create(),b=S.create();S.triggerEvent(b,3);S.step(a);S.step(b);assert(b.jobs[0].travelTime<a.jobs[0].travelTime);});
