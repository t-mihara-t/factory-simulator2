const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../dist/simulation.js'),P=require('../dist/planner.js');
function single(){const s=S.create('sandbox');s.orders=s.orders.slice(0,1);s.nextOffer=Number.MAX_SAFE_INTEGER;s.nextEvent=Number.MAX_SAFE_INTEGER;s.offers=[];return s;}
function advance(s,seconds){for(let n=0;n<Math.round(seconds/S.STEP);n++)S.step(s);}
function until(s,predicate,limit=500){for(let n=0;n<limit/S.STEP&&!predicate()&&!s.failed;n++)S.step(s);assert(predicate(),'expected state within simulation limit');}

test('sales sends paperwork; only after design and full procurement lead does the yard send raw material',()=>{
 const s=single();S.step(s);const j=s.jobs[0];assert.equal(j.cargo,'paper');assert.deepEqual(j.path[0],S.sales);assert.equal(s.ledger.materials,0);
 until(s,()=>j.status==='procurement');assert.equal(j.stage,1);assert.equal(j.location,'supply');assert.equal(s.buildings[0].active,null);assert.equal(j.materialReadyAt,j.designFinishedAt+S.materialLead(s,j.product));assert.equal(s.ledger.materials,S.PRODUCTS[j.product].cost);
 const alt=S.build(s,'machining',18,7);assert(alt.ok);S.assign(s,alt.id,1);S.assign(s,alt.id,1);assert(S.setRoute(s,j.order,1,alt.id).ok);
 advance(s,S.materialLead(s,j.product)-.2);assert.equal(j.status,'procurement');until(s,()=>j.status==='transfer');assert.equal(j.cargo,'materials');assert(j.materialDispatchedAt>=j.materialReadyAt-1e-6);assert.deepEqual(j.path[0],S.supply);assert.equal(j.target,alt.id);assert.equal(s.materials.length,0);
});

test('paid stock removes post-design procurement delay, incurs time storage, and is never purchased twice',()=>{
 const a=single(),b=single(),p=a.orders[0].product,cost=S.PRODUCTS[p].cost;a.releaseEnabled=b.releaseEnabled=false;assert(S.buyMaterials(a,p).ok);assert.equal(S.materialCommitment(a),0);
 const lead=S.materialLead(a,p);advance(a,lead+5);advance(b,lead+5);assert.equal(S.materialSummary(a,p).onHand,1);assert(Math.abs(a.ledger.storageMaterials-5*S.MATERIAL_STORAGE)<1e-6);
 a.releaseEnabled=b.releaseEnabled=true;const saved=S.serialize(a),planA=P.predict(a),planB=P.predict(b);assert.equal(S.serialize(a),saved);assert(!planA.rows[0].spans.some(x=>x.kind==='procurement'));assert(planB.rows[0].spans.some(x=>x.kind==='procurement'));assert(planB.rows[0].ready-planA.rows[0].ready>lead-.3);
 advance(a,220);assert.equal(a.metrics.delivered,1);assert.equal(a.ledger.materials,cost);assert.equal(a.ledger.cogs,cost);assert.equal(a.metrics.stockUses,1);assert.equal(a.metrics.materialLeadSaved,lead);assert.equal(a.materials.length,0);
});

test('an advance order still in transit is reserved once and keeps its original arrival time through reload',()=>{
 const s=single(),p=s.orders[0].product;assert(S.buyMaterials(s,p).ok);const arrival=s.materials[0].readyAt;until(s,()=>s.jobs[0]?.status==='procurement');const j=s.jobs[0];assert.equal(j.materialReadyAt,arrival);assert.equal(s.materials.length,1);assert.equal(s.materials[0].reservedFor,j.id);assert(s.metrics.materialLeadSaved>0);assert.equal(s.ledger.materials,S.PRODUCTS[p].cost);
 const copy=S.restore(S.serialize(s));advance(s,80);advance(copy,80);assert.equal(S.serialize(copy),S.serialize(s));assert.equal(s.ledger.materials,S.PRODUCTS[p].cost);
});

test('inventory caps include inbound stock; rejected purchases preserve money and stock',()=>{
 const s=single();s.releaseEnabled=false;for(let n=0;n<4;n++)assert(S.buyMaterials(s,'kintetsu',3).ok);assert.equal(S.materialSummary(s).inbound,12);const cash=s.cash,lots=s.materials.length;
 for(const [p,n] of [['kintetsu',1],['n700',0],['n700',1.5],['unknown',1]])assert.equal(S.buyMaterials(s,p,n).ok,false);assert.equal(s.cash,cash);assert.equal(s.materials.length,lots);
 advance(s,29);assert.equal(S.materialSummary(s).onHand,12);assert(Math.abs(s.ledger.storageMaterials-12*5*.18)<1e-6);
});

test('delaying release shifts the Gantt start and every future step, including delayed starts beyond ten minutes',()=>{
 const s=single(),o=s.orders[0],base=P.predict(s).rows[0];assert(S.setRelease(s,o.id,60).ok);const delayed=P.predict(s).rows[0];assert(Math.abs(delayed.start-60)<.11);assert(Math.abs(delayed.ready-base.ready-59.9)<.3);assert.equal(delayed.alreadyStarted,false);
 assert(S.setRelease(s,o.id,1800).ok);const far=P.predict(s).rows[0];assert(Math.abs(far.start-1800)<.11);assert(far.shipped);assert(far.ready>1800);assert(far.late);
});

test('after a partial launch only unreleased units are rescheduled; started work keeps its real history',()=>{
 const s=single(),o=s.orders[0];o.quantity=3;S.step(s);const j=s.jobs[0],path=JSON.stringify(j.path),started=j.started;assert(S.setRelease(s,o.id,60).ok);const plan=P.predict(s),live=plan.rows.find(r=>r.id===j.id);assert(live.alreadyStarted);assert.equal(live.start,0);assert(plan.rows.filter(r=>r.id!==j.id).every(r=>r.start>=60-S.STEP));assert.equal(JSON.stringify(j.path),path);assert.equal(j.started,started);
 until(s,()=>o.released===o.quantity);const reserved=o.releaseAt;assert.equal(S.setRelease(s,o.id,120).ok,false);assert.equal(o.releaseAt,reserved);
});

test('v2 paid design jobs migrate without a second material bill or cash change',()=>{
 const s=single();S.step(s);const j=s.jobs[0],cost=S.PRODUCTS[j.product].cost;j.materialCost=cost;delete j.materialPaid;s.ledger.materials=cost;s.cash-=cost;s.version=2;delete s.materials;delete s.nextMaterial;delete s.ledger.storageMaterials;
 const migrated=S.restore(S.serialize(s));assert.equal(migrated.cash,s.cash);assert.equal(migrated.version,3);assert.equal(migrated.jobs[0].materialPaid,true);advance(migrated,230);assert.equal(migrated.metrics.delivered,1);assert.equal(migrated.ledger.materials,cost);assert.equal(migrated.ledger.cogs,cost);
});

test('finished storage retains and bills all vehicles beyond the three displayed icons',()=>{
 const s=single();s.orders[0].quantity=7;s.orders[0].deadline=600;s.wipLimit=12;advance(s,500);assert.equal(s.jobs.filter(j=>j.status==='finished').length,7);const fee=s.ledger.storageFinished;advance(s,10);assert(Math.abs(s.ledger.storageFinished-fee-7*.9*10)<1e-6);advance(s,90);assert.equal(s.metrics.delivered,7);assert.equal(s.jobs.length,0);
});
