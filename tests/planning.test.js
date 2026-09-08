const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../dist/simulation.js'),P=require('../dist/planner.js');
function advance(s,seconds){for(let i=0;i<Math.round(seconds/S.STEP);i++)S.step(s);}
function quiet(s){s.nextEvent=Number.MAX_SAFE_INTEGER;s.nextOffer=Number.MAX_SAFE_INTEGER;s.offers=[];return s;}
function alternate(s){const r=S.build(s,'design',18,7);assert(r.ok);assert(S.assign(s,r.id,1).ok);assert(S.assign(s,r.id,1).ok);return r.id;}
test('early completion waits for due shipment, charges storage, and releases manufacturing WIP',()=>{
 const s=quiet(S.create());advance(s,99);assert.equal(s.metrics.delivered,0);assert(s.jobs.some(j=>j.status==='finished'));assert(s.ledger.storageFinished>0);assert.equal(s.ledger.cogs,0);assert(S.wip(s)<s.jobs.length);
 advance(s,1);assert.equal(s.metrics.delivered,1);assert.equal(s.metrics.late,0);assert(s.ledger.cogs>0);
 advance(s,5);assert.equal(s.jobs.filter(j=>j.status==='finished').length,2);const cost=s.ledger.storageFinished;advance(s,10);assert(Math.abs(s.ledger.storageFinished-cost-18)<1e-6);
 advance(s,50);assert.equal(s.metrics.delivered,3);assert.equal(s.jobs.length,0);assert(Math.abs(s.ledger.storage-s.ledger.storageFinished-s.ledger.storageFloor-s.ledger.storageIntermediate)<1e-6);
});
test('hiring is charged once and all employees incur ongoing wages even when unassigned',()=>{
 const s=S.create();s.releaseEnabled=false;const cash=s.cash;assert(S.hire(s).ok);assert.equal(s.cash,cash-350);assert.equal(s.employees,11);advance(s,10);assert(Math.abs(s.ledger.wages-11*.48*10)<1e-6);assert(S.dismiss(s).ok);assert.equal(s.ledger.service,550);const w=s.ledger.wages;advance(s,10);assert(Math.abs(s.ledger.wages-w-10*.48*10)<1e-6);
});
test('order route overrides default; changing a route preserves an in-flight transfer',()=>{
 const s=quiet(S.create('sandbox')),b=alternate(s),first=s.orders[0];assert(S.setRoute(s,null,0,b).ok);assert(S.setRoute(s,first.id,0,'b1').ok);S.step(s);assert.equal(s.jobs[0].target,'b1');assert(S.setRoute(s,first.id,0,b).ok);assert.equal(s.jobs[0].target,'b1');advance(s,4.1);assert.equal(s.jobs.find(j=>j.order===s.orders[1].id).target,b);
});
test('an unstaffed explicit destination waits without preventing other eligible orders',()=>{
 const s=quiet(S.create('sandbox')),r=S.build(s,'design',18,7);assert(r.ok);assert(S.setRoute(s,s.orders[0].id,0,r.id).ok);advance(s,1);assert(!s.jobs.some(j=>j.order===s.orders[0].id));assert(s.jobs.some(j=>j.order===s.orders[1].id));assert.equal(S.setRoute(s,null,1,r.id).ok,false);
});
test('manual intermediate storage is cheaper than floor waiting and requires explicit resumption',()=>{
 const s=quiet(S.create('sandbox'));s.releaseEnabled=false;const wh=S.build(s,'warehouse',18,13);assert(wh.ok);const b=s.buildings[1];b.staff=0;const j={id:'j100',product:'kintetsu',order:s.orders[0].id,stage:1,started:0,deadline:800,materialCost:2100,status:'queue',location:b.id};s.jobs.push(j);b.queue.push(j.id);s.orders[0].released=1;
 const before=s.ledger.storageFloor;advance(s,5);assert(Math.abs(s.ledger.storageFloor-before-3)<1e-6);assert(S.park(s,j.id).ok);advance(s,15);assert.equal(j.status,'buffer');assert(j.held);const fee=s.ledger.storageIntermediate;advance(s,5);assert(Math.abs(s.ledger.storageIntermediate-fee-1.25)<1e-6);assert(S.assign(s,b.id,1).ok);advance(s,10);assert.equal(j.status,'buffer');assert(S.resumeJob(s,j.id).ok);advance(s,1);assert.equal(j.status,'transfer');assert.equal(j.target,b.id);
});
test('remaining Gantt is read-only and has no overlapping work on the same facility',()=>{
 const s=quiet(S.create());advance(s,12);const saved=S.serialize(s),r=P.predict(s);assert.equal(S.serialize(s),saved);const all=[];for(const row of r.rows)for(const b of row.spans)if(b.kind==='work')all.push({...b,job:row.id});for(const a of all)for(const b of all)if(a.job!==b.job&&a.facility===b.facility)assert(a.end<=b.start+.000001||b.end<=a.start+.000001);assert(r.rows.every(r=>r.shipped));
});
test('predicted completion responds to staffing and matches live engine absent new events',()=>{
 const a=quiet(S.create()),before=P.predict(a);S.assign(a,'b3',1);S.assign(a,'b3',1);const after=P.predict(a);assert(after.rows[0].ready<before.rows[0].ready);const first=after.rows[0];while(a.t<first.ready-.001)S.step(a);assert(a.jobs.some(j=>j.id===first.id&&j.status==='finished'));assert(Math.abs(a.jobs.find(j=>j.id===first.id).finishedAt-first.ready)<.2);
});
test('Gantt uses the selected parallel resource and reports unrepaired or held work as uncertain',()=>{
 const s=quiet(S.create('sandbox')),b=alternate(s);S.setRoute(s,null,0,b);const plan=P.predict(s);assert(plan.rows.flatMap(r=>r.spans).filter(b=>b.kind==='work'&&b.stage===0).every(x=>x.facility===b));
 S.setRoute(s,null,0,'b1');s.buildings[0].broken=true;const stuck=P.predict(s);assert(stuck.rows.every(r=>!r.shipped&&r.warning));assert(stuck.rows.every(r=>!r.spans.some(b=>b.kind==='work')));
});
test('release reservations delay material spending and flow through the same forecast',()=>{
 const s=quiet(S.create()),o=s.orders[0];s.orders=s.orders.slice(0,1);assert(S.setRelease(s,o.id,60).ok);const plan=P.predict(s);assert(plan.rows[0].spans[0].start>=60);advance(s,59);assert.equal(s.ledger.materials,0);advance(s,2);assert(s.ledger.materials>0);assert.equal(S.setRelease(s,o.id,-1).ok,false);
});
test('v1 saves migrate without changing cash; v2 routing, reservations and inventory survive reload',()=>{
 const old=S.create();old.version=1;delete old.routeDefaults;delete old.ledger.storageFloor;delete old.ledger.storageFinished;delete old.ledger.storageIntermediate;const restored=S.restore(JSON.stringify(old));assert.equal(restored.version,2);assert.equal(restored.cash,old.cash);assert.equal(restored.ledger.storageFinished,0);const b=alternate(restored);S.setRoute(restored,null,0,b);S.setRelease(restored,restored.orders[0].id,40);assert.equal(S.serialize(S.restore(S.serialize(restored))),S.serialize(restored));
});
