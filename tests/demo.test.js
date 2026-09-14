const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../dist/simulation.js'),O=require('../dist/operations.js'),D=require('../dist/demo.js');
function drive(s,d,until=()=>d.finished,max=40){for(let i=0;i<max*60&&!until();i++)D.tick(s,d,1/60);assert(until());}
test('automatic demo reviews a 60-second reservation, finishes within 40 seconds, and books revenue only at dispatch',()=>{
 const s=S.create('coast',{tutorial:true}),d=D.create(),seen=[];
 for(let i=0;i<40*60&&!d.finished;i++){
  if(seen.at(-1)!==s.tutorial.step)seen.push(s.tutorial.step);
  if(!['debrief','done'].includes(s.tutorial.step))assert.equal(s.ledger.revenue,0);
  if(s.tutorial.step==='shipping'){assert.equal(O.finance(s).uncollected,4300);assert.equal(s.ledger.cogs,0);}
  if(s.tutorial.step==='launch'){assert(s.orders[0].releasePending);assert.equal(s.jobs.length,0);assert.equal(s.ledger.materials,0);}
  D.tick(s,d,1/60);
 }
 assert.deepEqual(seen,['layout','order','launch','watch','funding','manufacture','shipping','debrief']);
 assert(d.finished);assert.equal(d.error,null);assert.equal(s.tutorial.step,'done');assert.equal(s.metrics.delivered,1);
 assert(d.planned);assert.equal(s.orders[0].releaseAt,60);assert(!s.orders[0].releasePending);
 assert.equal(s.ledger.revenue,4300);assert.equal(s.ledger.materials,2850);assert.equal(s.ledger.cogs,2850);assert.equal(s.ledger.freight,0);assert(Math.abs(s.t-160)<S.STEP);assert(Math.abs(s.ledger.storageFinished-11.34)<1e-5);assert(s.transactions.filter(x=>x.category==='revenue').every(x=>x.t>=160-.000001));
 assert(Math.abs(s.cash-(s.initialCash+s.ledger.revenue+s.ledger.rewards-s.ledger.materials-s.ledger.operating-s.ledger.capex))<1e-5);
 const snapshot=S.serialize(s);D.tick(s,d,20);assert.equal(S.serialize(s),snapshot);
 console.log('DEMO_TIMING',JSON.stringify({realSeconds:+d.elapsed.toFixed(2),gameSeconds:+s.t.toFixed(1)}));
});
test('demo pause freezes production and lesson dwell, with no time leap on resume',()=>{
 const s=S.create('coast',{tutorial:true}),d=D.create();drive(s,d,()=>s.tutorial.step==='manufacture');
 d.paused=true;const sim=S.serialize(s),director=JSON.stringify(d);for(let i=0;i<120;i++)D.tick(s,d,1);
 assert.equal(S.serialize(s),sim);assert.equal(JSON.stringify(d),director);d.paused=false;const t=s.t;D.tick(s,d,100);assert(s.t-t<=2.41);
 drive(s,d);assert.equal(s.metrics.delivered,1);
});
test('automatic pace accelerates safe waiting and slows for actual decisions',()=>{
 const s=S.create('coast',{tutorial:true});assert.equal(D.pace(s),0);O.configureLayout(s,[1,1,2,1]);S.accept(s,s.offers[0].id);O.tutorialContinue(s);S.step(s);
 assert.equal(D.pace(s),8);assert.equal(D.pace(s,false,1),1);
 const job=s.jobs[0];job.status='work';assert.equal(D.pace(s),4);job.status='procurement';assert.equal(D.pace(s),8);
 job.deadline=s.t+8;assert.equal(D.pace(s),2);job.deadline=s.t+150;
 job.status='material_funds';assert.equal(D.pace(s),2);job.status='work';job.held=true;assert.equal(D.pace(s),2);job.held=false;
 s.buildings[0].broken=true;assert.equal(D.pace(s),2);s.buildings[0].broken=false;s.decision={id:'d'};assert.equal(D.pace(s),2);s.decision=null;
 s.tutorial.step='done';s.offers=[{expires:s.t+9}];assert.equal(D.pace(s),2);s.offers=[];job.status='finished';assert.equal(D.pace(s),8);
 s.failed=true;assert.equal(D.pace(s),0);
});
test('manual tutorial waiting is accelerated without passing payment or shipping gates',()=>{
 const s=S.create('coast',{tutorial:true});O.configureLayout(s,[1,1,2,1]);S.accept(s,s.offers[0].id);O.tutorialContinue(s);
 let real=0,acc=0;for(let i=0;i<35*60&&s.tutorial.step!=='shipping';i++){
  if(s.tutorial.step==='funding'){assert.equal(s.ledger.materials,2850);assert.equal(D.pace(s),0);O.tutorialContinue(s);}
  real+=1/60;acc+=D.pace(s)/60;while(acc>=S.STEP){S.step(s);acc-=S.STEP;if(D.GATES.includes(s.tutorial.step)){acc=0;break;}}
 }
 assert.equal(s.tutorial.step,'shipping');assert(real<20);assert.equal(s.ledger.revenue,0);assert.equal(D.pace(s),0);
 console.log('TUTORIAL_WAIT',JSON.stringify({realSeconds:+real.toFixed(2),gameSeconds:+s.t.toFixed(1)}));
});
test('next decision skips a routine transfer arrival and stops at material purchase',()=>{
 const s=S.create('coast',{tutorial:true});O.configureLayout(s,[1,1,2,1]);S.accept(s,s.offers[0].id);O.tutorialContinue(s);S.step(s);
 assert.equal(s.jobs[0].status,'transfer');const start=s.t,r=O.advanceToDecision(s);assert(r.seconds>5);assert.equal(s.tutorial.step,'funding');assert.equal(s.ledger.materials,2850);
 assert.equal(s.t,start+r.seconds);assert.equal(s.ledger.revenue,0);
});
test('opening and all demo states are excluded from normal saving',()=>{
 assert(D.canSave());assert(!D.canSave({opening:true}));assert(!D.canSave({demo:D.create()}));assert(!D.canSave({demo:{finished:true}}));
});
