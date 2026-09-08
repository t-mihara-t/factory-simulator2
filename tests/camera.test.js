const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),S=require('../dist/simulation.js');
test('factory fits portrait, landscape and the space remaining beside management panels',()=>{
 const context={YardSim:S,Image:class{},ResizeObserver:class{observe(){}},matchMedia:()=>({matches:false}),devicePixelRatio:2};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../dist/world.js'),'utf8'),context);
 for(const [width,height] of [[390,602],[778,262],[354,348],[390,307],[280,180]]){
  const size={width,height};const canvas={getContext:()=>({}),getBoundingClientRect:()=>size,addEventListener(){}};const mini={getContext:()=>({}),addEventListener(){}};const s=S.create();const world=new context.YardWorld(canvas,mini,()=>s,()=>{},()=>{});
  for(const b of s.buildings){const point=world.screen(b.x+1.5,b.y+1.5),z=world.camera.z;assert(point.x-130*z>=0&&point.x+130*z<=width);assert(point.y-158*z>=0&&point.y+128*z<=height);const inverse=world.tile(point.x,point.y);assert(Math.abs(inverse.x-b.x-1.5)<1e-8);assert(Math.abs(inverse.y-b.y-1.5)<1e-8);}
  world.focus('b3');size.width-=40;world.resize();const selected=world.screen(s.buildings[2].x+1.5,s.buildings[2].y+1.5);assert(Math.abs(selected.x-size.width/2)<1e-8);
 }
});
