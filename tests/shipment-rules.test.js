const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../dist/simulation.js'),O=require('../dist/operations.js'),P=require('../dist/planner.js');
function until(s,p,max=400){for(let i=0;i<max/S.STEP&&!p(s)&&!s.failed;i++)S.step(s);assert(p(s));}
function quiet(s){s.nextOffer=s.nextEvent=s.nextDecision=Number.MAX_SAFE_INTEGER;return s;}
function training(){const s=S.create('coast',{tutorial:true});O.configureLayout(s,[1,1,2,1]);S.accept(s,s.offers[0].id);O.tutorialContinue(s);until(s,x=>x.tutorial.step==='funding');O.tutorialContinue(s);until(s,x=>x.tutorial.step==='shipping');return s;}
test('v4 tutorial holding saves keep their cash and jobs, resume the lesson and ship at the original due time',()=>{
 const old=training();old.version=4;old.orders[0].autoShip=false;delete old.tutorial.storageLesson;
 const raw=S.serialize(old),s=S.restore(raw);assert.equal(s.version,S.VERSION);assert.equal(s.t,old.t);assert.equal(s.cash,old.cash);assert.deepEqual(s.jobs,old.jobs);assert.equal(s.tutorial.step,'shipping');
 assert.equal(s.orders[0].autoShip,undefined);assert.equal(s.tutorial.storageLesson.deadline,160);assert(!O.shipNow(s,s.jobs[0].id).ok);
 const snapshot=S.serialize(s),plan=P.predict(s);assert.equal(S.serialize(s),snapshot);assert(plan.rows[0].shipped);assert(Math.abs(plan.rows[0].finish-(160-s.t))<S.STEP);
 assert(O.tutorialContinue(s).ok);assert.equal(s.metrics.delivered,1);assert.equal(s.tutorial.step,'debrief');assert(Math.abs(s.t-160)<S.STEP);assert.equal(s.ledger.revenue,4300);assert(s.ledger.storageFinished>65);
});
test('legacy manual flags cannot defer normal due-date shipping and historical freight remains unchanged',()=>{
 const old=quiet(S.create());old.orders=old.orders.slice(0,1);until(old,x=>x.jobs.some(j=>j.status==='finished'));old.version=4;old.orders[0].autoShip=false;
 const s=S.restore(S.serialize(old));s.orders[0].autoShip=false;until(s,x=>x.metrics.delivered===1);assert(Math.abs(s.t-s.orders[0].deadline)<S.STEP);assert.equal(s.metrics.late,0);
 s.version=4;s.ledger.freight=86;s.ledger.operating+=86;s.cash-=86;const restored=S.restore(S.serialize(s));assert.equal(restored.cash,s.cash);assert.equal(restored.ledger.freight,86);assert.equal(restored.metrics.delivered,1);
});
test('delaying a single training-style order 60 seconds cuts storage cost by about 54G without changing shipment time or sales',()=>{
 function run(delay){const s=S.create('coast',{tutorial:true});O.configureLayout(s,[1,1,2,1]);S.accept(s,s.offers[0].id);s.tutorial.step='done';s.releaseEnabled=true;quiet(s);assert(S.setRelease(s,s.orders[0].id,delay).ok);until(s,x=>x.metrics.delivered===1);return s;}
 const early=run(0),planned=run(60);assert(Math.abs(early.t-planned.t)<S.STEP);assert.equal(early.ledger.revenue,planned.ledger.revenue);assert.equal(planned.metrics.late,0);
 assert(Math.abs(early.ledger.storageFinished-65.25)<1e-5);assert(Math.abs(planned.ledger.storageFinished-11.25)<=S.STEP*.9+1e-5);assert(Math.abs(planned.cash-early.cash-54)<=S.STEP*.9+1e-5);
 assert(Math.abs(early.ledger.wages-planned.ledger.wages)<1e-5);assert(Math.abs(early.ledger.upkeep-planned.ledger.upkeep)<1e-5);
 const payment=s=>s.transactions.find(x=>x.category==='materials').t;assert(Math.abs(payment(planned)-payment(early)-60)<=S.STEP+.000001);
});
test('a tutorial delayed beyond the due date reaches debrief on arrival, without a stuck shipping lesson',()=>{
 const s=S.create('coast',{tutorial:true});O.configureLayout(s,[1,1,2,1]);S.accept(s,s.offers[0].id);S.setRelease(s,s.orders[0].id,170);O.tutorialContinue(s);
 until(s,x=>x.tutorial.step==='funding');O.tutorialContinue(s);until(s,x=>x.tutorial.step==='debrief');assert.equal(s.metrics.delivered,1);assert.equal(s.metrics.late,1);assert(s.ledger.penalties>0);assert(O.tutorialContinue(s).ok);
});
