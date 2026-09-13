// Exercise the real app controller with a small DOM adapter. Canvas/audio are
// replaced; this checks actions, dialogs and storage, not browser layout.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../dist/simulation.js'),O=require('../dist/operations.js'),D=require('../dist/demo.js');
const SAVE='railworks-yard-save-v1';
function app(saved){
 let now=0,raf,world;const ids=new Map(),roots=[],listeners={},micro=[],timers=new Map(),storage=new Map(saved?[[SAVE,saved]]:[]),writes=[];let timerId=0;
 const key=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
 class Element{
  constructor(tag='div',attrs='',parent=null){this.tagName=tag.toUpperCase();this.parent=parent;this.dataset={};this.style={};this.attrs={};this.children=[];this.hidden=false;this.inert=false;this.open=false;this.scrollTop=0;this._text='';this._html='';this.listeners={};
   const classes=new Set();this.classList={add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle:(x,v)=>{const on=v??!classes.has(x);on?classes.add(x):classes.delete(x);return on;}};
   for(const m of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){const [_,name,value='']=m;this.setAttribute(name,value);if(name==='class')value.split(' ').forEach(x=>classes.add(x));if(name==='hidden'||name==='disabled'||name==='inert')this[name]=true;}
  }
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='id'){this.id=v;ids.set(v,this);}if(k.startsWith('data-'))this.dataset[key(k.slice(5))]=String(v);}
  getAttribute(k){return this.attrs[k];}
  set innerHTML(html){this._html=html;this.children=parse(html,this);}
  get innerHTML(){return this._html;}
  set textContent(s){this._text=String(s);this.children=[];}
  get textContent(){return this._text||this._html.replace(/<[^>]+>/g,'');}
  matches(selector){return selector.split(',').some(part=>{const p=part.trim(),tag=p.match(/^[a-z]+/i)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;const id=p.match(/#([\w-]+)/)?.[1];if(id&&id!==this.id)return false;const cls=p.match(/\.([\w-]+)/)?.[1];if(cls&&!this.classList.contains(cls))return false;return [...p.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)].every(([,k,v])=>v===undefined?this.attrs[k]!==undefined:this.attrs[k]===v);});}
  closest(s){return this.matches(s)?this:this.parent?.closest(s)||null;}
  querySelectorAll(s){return this.children.filter(e=>e.matches(s));}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  focus(){document.activeElement=this;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  showModal(){this.open=true;}
  close(){this.open=false;}
 }
 function parse(html,parent){return [...html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(([,tag,attrs])=>new Element(tag,attrs,parent));}
 const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');roots.push(...parse(html));
 const body=new Element('body');const document={body,hidden:false,activeElement:body,getElementById:id=>ids.get(id)||null,querySelectorAll:s=>[...roots,...roots.flatMap(e=>e.children)].filter(e=>e.matches(s)),addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn)};
 ids.get('opening').innerHTML=html.slice(html.indexOf('<div class="opening-layout">'),html.indexOf('<div id="demo-bar"'));
 class World{constructor(_a,_b,get){this.get=get;this.camera={z:1};world=this;}home(){}draw(){}zoom(){}focus(){}}
 class Audio{setLevel(){}setChannel(){}setStage(){}effect(){}reset(){this.playing=false;}setPlaying(v){this.playing=v;}unlock(){return Promise.resolve();}}
 const sandbox={document,performance:{now:()=>now},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{storage.set(k,v);writes.push([k,v]);}},YardSim:S,YardOperations:O,YardDemo:D,YardWorld:World,FactoryAudio:Audio,YardPlanner:require('../dist/planner.js'),matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>raf=fn,queueMicrotask:fn=>micro.push(fn),setTimeout:(fn,ms=0)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(k,fn)=>(listeners[k]??=[]).push(fn)};
 sandbox.window=sandbox;vm.createContext(sandbox);for(const name of ['management','app'])vm.runInContext(fs.readFileSync(require.resolve('../dist/'+name+'.js'),'utf8'),sandbox);
 function flush(){for(let guard=0;guard<1000;guard++){if(micro.length){micro.shift()();continue;}const due=[...timers].find(([,t])=>t.at<=now);if(!due)break;timers.delete(due[0]);due[1].fn();}}
 function emit(k,e={}){(listeners[k]||[]).forEach(fn=>fn(e));flush();}
 function click(selector,scope){const el=(scope?ids.get(scope).querySelector(selector):[...ids.values(),...roots].find(x=>x.matches(selector)));assert(el,'button exists: '+selector);assert(!el.disabled);const e={target:el,preventDefault(){}};el.onclick?.(e);emit('click',e);return el;}
 function run(seconds){const stop=now+seconds*1000;while(now<stop){now+=1000/60;raf(now);flush();}}
 flush();return {ids,click,run,emit,document,storage,writes,state:()=>world.get(),saved:()=>storage.get(SAVE)};
}
test('opening offers an automatic demo that completes and returns to the untouched saved factory',()=>{
 const old=S.create();for(let i=0;i<400;i++)S.step(old);const raw=S.serialize(old),a=app(raw);
 assert(!a.ids.get('opening').hidden);assert(!a.ids.get('modal').open);a.run(2);assert.equal(a.saved(),raw);assert.equal(a.state().t,old.t);
 a.click('[data-opening="demo"]','opening');assert(a.ids.get('opening').hidden);assert(a.ids.get('modal').open);assert.equal(a.ids.get('modal').dataset.panel,'layout');
 a.run(14);const paused=S.serialize(a.state());a.click('[data-demo="pause"]','demo-bar');a.run(3);assert.equal(S.serialize(a.state()),paused);a.click('[data-demo="pause"]','demo-bar');
 a.run(18);assert.equal(a.state().metrics.delivered,1);assert.equal(a.ids.get('modal').dataset.panel,'demoFinish');assert.equal(a.saved(),raw);assert.equal(a.writes.filter(([k])=>k===SAVE).length,0);
 a.click('[data-opening="back"]','modal-body');assert(!a.ids.get('opening').hidden);a.click('[data-opening="continue"]','opening');assert.equal(S.serialize(a.state()),raw);a.run(1);assert(a.state().t>old.t);
});
test('interactive opening starts the real tutorial; management tabs switch without advancing game time',()=>{
 const a=app();a.click('[data-opening="tutorial"]','opening');assert.equal(a.ids.get('modal').dataset.panel,'layout');assert(!a.ids.get('game').inert);
 a.click('[data-action="configure"]','modal-body');assert.equal(a.ids.get('modal').dataset.panel,'orders');a.click('[data-action="accept"]','modal-body');assert.equal(a.ids.get('modal').dataset.panel,'flow');a.click('[data-action="tutorialContinue"]','modal-body');a.run(4);
 assert.equal(a.state().tutorial.step,'funding');assert.equal(a.ids.get('modal').dataset.panel,'finance');const t=a.state().t;a.click('[data-panel="staff"]','modal-tabs');a.run(2);assert.equal(a.state().t,t);a.click('[data-panel="finance"]','modal-tabs');
 a.click('[data-action="tutorialContinue"]','modal-body');a.run(20);assert.equal(a.ids.get('modal').dataset.panel,'shipping');assert.equal(a.state().ledger.revenue,0);a.click('[data-action="ship"]','modal-body');assert.equal(a.state().ledger.revenue,4300);assert.equal(a.ids.get('modal').dataset.panel,'finance');
 a.click('[data-action="tutorialContinue"]','modal-body');assert.equal(a.state().tutorial.step,'done');assert.equal(S.restore(a.saved()).metrics.delivered,1);
});
test('new tutorial replacement is explicit and backgrounding a demo never overwrites a save',()=>{
 const raw=S.serialize(S.create('surge')),a=app(raw);a.click('[data-opening="tutorial"]','opening');assert(a.ids.get('modal').open);assert.equal(a.saved(),raw);
 a.click('[data-opening="back"]','modal-body');a.click('[data-opening="demo"]','opening');a.run(10);a.document.hidden=true;a.emit('visibilitychange');const paused=S.serialize(a.state());a.run(10);a.emit('pagehide');assert.equal(S.serialize(a.state()),paused);assert.equal(a.saved(),raw);
 a.click('[data-demo="exit"]','modal-demo-controls');a.click('[data-opening="tutorial"]','opening');a.click('[data-opening="confirm"]','modal-body');assert.equal(a.state().tutorial.step,'layout');assert.equal(S.restore(a.saved()).scenario,'coast');assert.notEqual(a.saved(),raw);
});
