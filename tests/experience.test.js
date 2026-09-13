const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../dist/simulation.js'),O=require('../dist/operations.js'),H=require('../dist/hud-layout.js'),P=require('../dist/planner.js');
const advance=(s,n)=>{for(let i=0;i<Math.round(n/S.STEP);i++)S.step(s);};
function until(s,predicate,max=300){for(let i=0;i<max/S.STEP&&!predicate(s)&&!s.failed;i++)S.step(s);assert(predicate(s),'expected milestone within '+max+' seconds');}
function reconcile(s){const l=s.ledger;assert(Math.abs(s.cash-(s.initialCash+l.revenue+l.rewards-l.materials-l.operating-l.capex))<1e-5);assert.equal(s.employees,S.freeStaff(s)+s.buildings.reduce((n,b)=>n+b.staff,0));}
function quiet(s){s.nextEvent=s.nextDecision=s.nextOffer=Number.MAX_SAFE_INTEGER;s.decision=null;return s;}
test('tutorial is an action-gated journey from initial layout through real shipment and revenue',()=>{
 let s=S.create('coast',{tutorial:true});assert.equal(s.orders.length,0);assert.equal(s.tutorial.step,'layout');
 const untouched=S.serialize(s);advance(s,30);assert.equal(S.serialize(s),untouched);assert(!S.accept(s,s.offers[0].id).ok);
 assert(!S.reject(s,s.offers[0].id).ok);assert.equal(s.offers.length,1);
 assert(O.configureLayout(s,[1,1,2,1]).ok);assert.equal(s.buildings.length,5);assert.equal(s.cash,18000);assert.equal(s.tutorial.step,'order');
 assert(S.accept(s,s.offers[0].id).ok);assert.equal(s.ledger.materials,0);assert.equal(s.ledger.revenue,0);assert.equal(s.tutorial.step,'launch');
 assert(O.tutorialContinue(s).ok);until(s,x=>x.tutorial.step==='funding');assert.equal(s.ledger.materials,2850);assert.equal(s.ledger.revenue,0);assert.equal(s.ledger.cogs,0);
 const paused=S.serialize(s);advance(s,20);assert.equal(S.serialize(s),paused);s=S.restore(paused);assert(O.tutorialContinue(s).ok);
 until(s,x=>x.tutorial.step==='shipping');const job=s.jobs.find(j=>j.status==='finished');assert(job);assert.equal(s.metrics.delivered,0);assert.equal(O.finance(s).uncollected,4300);
 const cash=s.cash;advance(s,60);assert.equal(s.cash,cash);assert(O.shipNow(s,job.id).ok);assert.equal(s.cash,cash+4300);assert.equal(s.metrics.delivered,1);assert.equal(s.ledger.cogs,2850);assert.equal(s.tutorial.step,'debrief');assert(!O.shipNow(s,job.id).ok);
 assert(O.tutorialContinue(s).ok);assert.equal(s.tutorial.step,'done');assert.equal(s.offers.length,3);advance(s,1);reconcile(s);
});
test('startup choices have valid routes, real parallel machines and distinct ongoing cost',()=>{
 const report=[];for(const counts of [[1,1,1,1],[1,1,2,1],[3,1,1,1],[2,2,2,2],[1,1,1,3]]){
  const s=S.create('coast',{tutorial:true}),q=O.layoutQuote(s,counts);assert(q.ok);assert(O.configureLayout(s,counts).ok);
  assert.deepEqual(O.loads(s).map(l=>l.count),counts);assert.equal(s.employees,q.employees);
  for(const b of s.buildings)assert(S.route(s,S.sales,S.port(b)));reconcile(s);report.push(q.burn);
 }
 assert(report[0]<report[3]);
 const s=S.create('coast',{tutorial:true}),before=S.serialize(s);assert(!O.configureLayout(s,[3,3,3,3]).ok);assert(!O.configureLayout(s,[0,1,1,1]).ok);assert.equal(S.serialize(s),before);
});
test('two and three parallel design rooms actually work at the same time',()=>{
 for(const n of [2,3]){const s=S.create('coast',{tutorial:true});assert(O.configureLayout(s,[n,1,1,1]).ok);s.tutorial.step='done';s.releaseEnabled=true;s.wipLimit=8;s.offers=[];quiet(s);
  const o=S.makeOffer(s,'panorama',n,500);s.offers.push(o);assert(S.accept(s,o.id).ok);advance(s,18);
  assert.equal(s.buildings.filter(b=>b.type==='design'&&b.active).length,n);assert.equal(s.jobs.length,n);reconcile(s);
 }
});
test('one-click expansion includes staffing, and rejected expansion has no partial effects',()=>{
 const s=quiet(S.create('sandbox'));assert(O.addParallel(s,0).ok);assert.equal(O.loads(s)[0].count,2);assert.equal(O.loads(s)[0].staff,4);assert(O.addParallel(s,0).ok);assert.equal(O.loads(s)[0].count,3);assert.equal(O.loads(s)[0].staff,6);reconcile(s);
 const before=S.serialize(s);assert(!O.addParallel(s,0).ok);assert.equal(S.serialize(s),before);
 const poor=S.create();poor.cash=100;const unchanged=S.serialize(poor);assert(!O.addParallel(poor,2).ok);assert.equal(S.serialize(poor),unchanged);
});
test('completion stays unmonetized; optional early factory shipment charges exactly one 2% fee',()=>{
 const s=quiet(S.create());s.orders=s.orders.slice(0,1);assert(!O.shipNow(s,'j1').ok);until(s,x=>x.jobs.some(j=>j.status==='finished'));
 const j=s.jobs[0],cash=s.cash;assert.equal(s.ledger.revenue,0);assert.equal(s.ledger.cogs,0);assert(O.shipNow(s,j.id).ok);
 assert.equal(s.ledger.revenue,4300);assert.equal(s.ledger.freight,86);assert.equal(s.cash,cash+4300-86);assert.equal(s.ledger.cogs,2850);const before=S.serialize(s);assert(!O.shipNow(s,j.id).ok);assert.equal(S.serialize(s),before);reconcile(s);
});
test('late shipment is late even when manufacturing was finished before the deadline',()=>{
 const s=quiet(S.create());s.orders=s.orders.slice(0,1);s.orders[0].autoShip=false;advance(s,160);assert(s.jobs[0].finishedAt<s.orders[0].deadline);assert(O.shipNow(s,s.jobs[0].id).ok);assert.equal(s.metrics.late,1);assert.equal(s.metrics.ontime,0);assert(s.ledger.penalties>0);assert.equal(s.ledger.freight,0);reconcile(s);
});
test('investment guidance subtracts commitments and current operating reserve without treating unsold stock as cash',()=>{
 const s=quiet(S.create()),before=O.finance(s);assert.equal(before.commitment,9850);assert.equal(before.available,Math.max(0,s.cash-9850-before.burn*60));
 assert(S.buyMaterials(s,'kintetsu').ok);const after=O.finance(s);assert.equal(after.commitment,7000);assert(Math.abs(after.available-before.available)<.001);
 until(s,x=>x.jobs.some(j=>j.status==='finished'));const f=O.finance(s);assert(f.uncollected>0);assert.equal(f.cash,s.cash);assert(f.available<=s.cash);reconcile(s);
});
test('event choices affect only the selected resource and expire without permanent upgrades',()=>{
 const s=quiet(S.create()),base=S.speed(s,s.buildings[2]);s.decision={id:'test',expires:s.t+32};assert(O.chooseSupport(s,'focus',2).ok);assert.equal(S.speed(s,s.buildings[2]),base*1.35);assert.equal(S.speed(s,s.buildings[0]),1);assert.equal(s.ledger.service,220);assert.equal(s.decision,null);assert(!O.chooseSupport(s,'focus',2).ok);advance(s,36);assert.equal(S.speed(s,s.buildings[2]),base);reconcile(s);
});
test('material express updates the reserved job and lot together and survives saving',()=>{
 const s=quiet(S.create());until(s,x=>x.jobs.some(j=>j.status==='procurement'));const j=s.jobs.find(j=>j.status==='procurement'),old=j.materialReadyAt;s.decision={id:'d',expires:s.t+32};assert(O.chooseSupport(s,'materials').ok);assert.equal(j.materialReadyAt,old-12);assert.equal(s.materials.find(l=>l.id===j.materialLot).readyAt,j.materialReadyAt);assert.equal(S.serialize(S.restore(S.serialize(s))),S.serialize(s));reconcile(s);
});
test('advance to next change uses normal ticks, preserves costs, and cannot jump past a tutorial gate',()=>{
 const a=quiet(S.create()),b=S.restore(S.serialize(a)),r=O.advanceToDecision(a);assert(r.ok);advance(b,r.seconds);assert.equal(S.serialize(a),S.serialize(b));
 const t=S.create('coast',{tutorial:true}),before=S.serialize(t);assert(!O.advanceToDecision(t).ok);assert.equal(S.serialize(t),before);
 O.configureLayout(t,[1,1,2,1]);S.accept(t,t.offers[0].id);O.tutorialContinue(t);
 for(let i=0;i<15&&t.tutorial.step!=='funding';i++)O.advanceToDecision(t);
 assert.equal(t.tutorial.step,'funding');const cash=t.cash;assert(!O.advanceToDecision(t).ok);assert.equal(t.cash,cash);
});
test('every third on-time shipment grants one transparent reward, never fake sales',()=>{
 const s=quiet(S.create());advance(s,230);assert.equal(s.ledger.revenue,14700);assert.equal(s.metrics.streak,3);assert.equal(s.metrics.bestStreak,3);assert.equal(s.ledger.rewards,300);assert.equal(s.transactions.filter(t=>t.category==='rewards').length,1);advance(s,2);assert.equal(s.ledger.rewards,300);reconcile(s);
});
test('v3 progress migrates without a tutorial reset, and tutorial planning remains read-only',()=>{
 const s=S.create();advance(s,40);s.version=3;delete s.tutorial;delete s.transactions;delete s.nextDecision;const old=S.restore(JSON.stringify(s));assert.equal(old.tutorial.step,'done');assert.equal(old.cash,s.cash);assert.equal(old.t,s.t);
 const tutorial=S.create('coast',{tutorial:true});O.configureLayout(tutorial,[1,1,2,1]);S.accept(tutorial,tutorial.offers[0].id);O.tutorialContinue(tutorial);until(tutorial,x=>x.tutorial.step==='funding');const before=S.serialize(tutorial),plan=P.predict(tutorial);assert.equal(S.serialize(tutorial),before);assert(plan.rows.some(r=>r.spans.some(b=>b.kind==='finished')));assert(plan.rows.every(r=>!r.shipped));
});
test('map labels remain on screen and never intersect artwork or other labels, even at narrow sizes',()=>{
 for(const [width,height] of [[1440,680],[390,280],[844,180],[320,200]]){
  const obstacles=[{x:width*.3,y:height*.3,w:width*.4,h:height*.4}],items=Array.from({length:18},(_,i)=>({id:i,w:i%2?125:160,h:30,x:width/2,y:height/2,priority:i}));
  const out=H.layout(items,obstacles,width,height);assert(out.length>0);for(const r of out){assert(r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);assert(!obstacles.some(o=>H.overlaps(o,r)));assert(!out.some(o=>o.id!==r.id&&H.overlaps(o,r)));}
 }
 assert.equal(H.layout([{w:200,h:30,x:50,y:50}],[{x:0,y:0,w:100,h:100}],100,100).length,0);
});
test('management views render all tutorial checkpoints, funded layouts and populated shipment/decision panels',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),context={YardSim:S,YardOperations:O};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../dist/management.js'),'utf8'),context);const V=context.YardManagement;
 const s=S.create('coast',{tutorial:true});for(const step of Object.keys(O.TUTORIAL)){s.tutorial.step=step;for(const html of [V.briefing(s),V.moneyFlow(s),V.funds(s),V.layout(s,[1,1,2,1]),V.shipping(s),V.transactions(s)]){assert.equal(typeof html,'string');assert(!/undefined|NaN/.test(html));}}
 const live=quiet(S.create());until(live,x=>x.jobs.some(j=>j.status==='finished'));assert(V.shipping(live).includes('data-action="ship"'));live.decision={expires:live.t+32};assert(V.decision(live).includes('data-support="materials"'));assert(V.transactions(live).includes('材料の発注'));
});
