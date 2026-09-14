const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../dist/simulation.js'),O=require('../dist/operations.js'),P=require('../dist/planner.js');
function advance(s,seconds){for(let i=0;i<Math.round(seconds/S.STEP);i++)S.step(s);}
function review(){const s=S.create('coast',{tutorial:true});O.configureLayout(s,[1,1,2,1]);O.acceptForPlanning(s,s.offers[0].id);s.tutorial.step='done';s.releaseEnabled=true;s.nextOffer=s.nextEvent=s.nextDecision=Number.MAX_SAFE_INTEGER;return s;}
test('unconfirmed reservations survive time, setting changes and reload; only confirmation permits launch',()=>{
 let s=review(),o=s.orders[0];assert(o.releasePending);assert(S.setRelease(s,o.id,60).ok);advance(s,20);
 assert.equal(o.released,0);assert.equal(s.jobs.length,0);assert.equal(s.ledger.materials,0);
 s=S.restore(S.serialize(s));o=s.orders[0];assert(o.releasePending);assert.equal(o.releaseAt,60);const cash=s.cash,t=s.t;
 assert(O.confirmRelease(s,o.id).ok);assert.equal(s.cash,cash);assert.equal(s.t,t);assert(!o.releasePending);advance(s,39);assert.equal(o.released,0);advance(s,2);
 assert.equal(o.released,1);assert.equal(s.jobs.length,1);assert(s.jobs[0].started>=60-S.STEP);assert.equal(s.ledger.materials,0);assert(!O.confirmRelease(s,o.id).ok);
});
test('Gantt review simulates the selected confirmation without changing live orders and predicts storage savings',()=>{
 const s=review(),o=s.orders[0];s.offers.push({...o,id:'o99',status:'offer',expires:1000,deadline:200});assert(O.acceptForPlanning(s,'o99').ok);
 const before=S.serialize(s),first=P.predict(s,{reviewOrderId:o.id}),early=P.orderForecast(s,first,o.id);assert.equal(S.serialize(s),before);assert(early.known);assert(Math.abs(early.storageCost-65.25)<.1);
 const held=first.rows.find(r=>r.order==='o99');assert(!held.shipped);assert.equal(held.warning,'着工予約が未確定');assert.equal(P.orderForecast(s,first,'o99').ready,null);
 S.setRelease(s,o.id,60);const saved=S.serialize(s),plan=P.predict(s,{reviewOrderId:o.id}),later=P.orderForecast(s,plan,o.id);assert.equal(S.serialize(s),saved);assert(later.known);assert(later.margin>10);assert(Math.abs(later.ready-early.ready-60)<=S.STEP+.00001);assert(Math.abs(early.storageCost-later.storageCost-54)<=S.STEP*.9+.00001);
 assert(O.confirmRelease(s,o.id).ok);advance(s,160);assert.equal(s.metrics.delivered,1);assert.equal(s.orders[1].released,0);assert(Math.abs(s.ledger.storageFinished-later.storageCost)<=S.STEP*.9+.00001);assert.equal(s.ledger.revenue,4300);
});
test('late and blocked reservations are distinguished from a feasible, on-time plan',()=>{
 const s=review(),id=s.orders[0].id;S.setRelease(s,id,120);const late=P.orderForecast(s,P.predict(s,{reviewOrderId:id}),id);assert(late.known);assert(late.late);assert(late.margin<0);assert.equal(late.storageCost,0);
 s.buildings.find(b=>b.type==='design').staff=0;const blocked=P.orderForecast(s,P.predict(s,{reviewOrderId:id}),id);assert(!blocked.known);assert.equal(blocked.ready,null);assert.equal(blocked.margin,null);assert.equal(blocked.storageCost,null);assert(blocked.warning);
});
test('existing v5 orders retain their confirmed behavior and invalid pending data is rejected',()=>{
 const old=S.create();old.version=5;const s=S.restore(S.serialize(old));assert.equal(s.version,S.VERSION);assert.equal(s.cash,old.cash);assert(s.orders.every(o=>!o.releasePending));S.step(s);assert(s.jobs.length>0);
 const corrupt=review();corrupt.orders[0].releasePending='false';assert.throws(()=>S.restore(S.serialize(corrupt)),/着工予約/);
});
