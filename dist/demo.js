/* A complete, deterministic demonstration. UI and tests use the same director. */
(function(root){'use strict';
const S=root.YardSim||(typeof require==='function'?require('./simulation.js'):null);
const O=root.YardOperations||(typeof require==='function'?require('./operations.js'):null);
const GATES=['layout','order','launch','funding','shipping','debrief'];
const HOLD={layout:3,order:2.4,launch:1.8,funding:4,shipping:6,debrief:4.4};
function create(){return {elapsed:0,phase:null,dwell:0,accumulator:0,paused:false,finished:false,error:null};}
function tick(s,d,seconds){
 if(d.paused||d.finished||!Number.isFinite(seconds)||seconds<=0)return;
 const dt=Math.min(.3,seconds);d.elapsed+=dt;
 const phase=s.tutorial?.step;
 if(phase!==d.phase){d.phase=phase;d.dwell=0;d.accumulator=0;}
 d.dwell+=dt;
 if(GATES.includes(phase)){
  if(d.dwell<(HOLD[phase]||2))return;
  let r;
  if(phase==='layout')r=O.configureLayout(s,[1,1,2,1]);
  else if(phase==='order')r=S.accept(s,s.offers.find(o=>o.training)?.id);
  else r=O.tutorialContinue(s);
  if(!r?.ok){d.error=r?.message||'デモを再開できませんでした。';d.finished=true;}
  else if(phase==='debrief')d.finished=true;
  return;
 }
 d.accumulator+=dt*8;
 while(d.accumulator>=S.STEP){S.step(s);d.accumulator-=S.STEP;if(s.failed){d.finished=true;d.error='デモの資金が不足しました。';break;}if(s.tutorial.step!==phase){d.accumulator=0;break;}}
}
function pace(s,fastWait=true,manual=2){
 if(s.failed||GATES.includes(s.tutorial?.step))return 0;
 if(!fastWait)return manual;
 const guided=['watch','manufacture'].includes(s.tutorial?.step);
 const inProduction=s.jobs.filter(j=>j.status!=='finished');
 const urgent=inProduction.some(j=>j.deadline-s.t<=10||j.status==='material_funds'||j.held)||s.buildings.some(b=>b.broken&&!b.repairRemaining);
 if(urgent||s.decision||s.cash<1000)return manual;
 if(!guided&&s.offers.some(o=>o.expires-s.t<=10))return manual;
 const onlyTravel=s.jobs.length>0&&s.jobs.every(j=>['procurement','transfer','finished'].includes(j.status));
 if(onlyTravel)return 8;
 return s.jobs.length?4:manual;
}
function canSave({opening=false,demo=null}={}){return !opening&&!demo;}
const api={GATES,HOLD,create,tick,pace,canSave};root.YardDemo=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
