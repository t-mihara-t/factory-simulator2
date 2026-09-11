/* Screen-space label packing. If space is exhausted, the persistent stage strip
   and management tabs retain the information; labels never cover other art. */
(function(root){'use strict';
function overlaps(a,b,gap=4){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
function layout(items,obstacles,width,height){
 const placed=[],used=[...obstacles];
 for(const item of [...items].sort((a,b)=>(b.priority||0)-(a.priority||0))){
  if(item.w>width-8||item.h>height-8)continue;
  const candidates=[],seen=new Set();
  for(let ring=0;ring<10;ring++)for(const dy of ring?[ring,-ring]:[0])for(const dx of [0,1,-1,2,-2]){
   const x=Math.max(4,Math.min(width-item.w-4,item.x-item.w/2+dx*(item.w+8))),y=Math.max(4,Math.min(height-item.h-4,item.y+dy*(item.h+8))),key=x+':'+y;
   if(!seen.has(key)){candidates.push({x,y,w:item.w,h:item.h});seen.add(key);}
  }
  candidates.sort((a,b)=>Math.hypot(a.x+item.w/2-item.x,a.y-item.y)-Math.hypot(b.x+item.w/2-item.x,b.y-item.y));
  const box=candidates.find(r=>!used.some(b=>overlaps(r,b)));
  if(box){placed.push({...item,...box,anchorX:item.anchorX??item.x,anchorY:item.anchorY??item.y});used.push(box);}
 }
 return placed;
}
const api={layout,overlaps};root.YardHudLayout=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
