/* Isometric map, camera and pointer input. Rendering reads authoritative simulation state. */
(function(root){'use strict';
const S=root.YardSim,TW=42,TH=22;const iso=(x,y)=>({x:(x-y)*TW,y:(x+y)*TH});const uniso=(x,y)=>({x:(x/TW+y/TH)/2,y:(y/TH-x/TW)/2});
class YardWorld{
 constructor(canvas,minimap,getState,onSelect,onPlace){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.mini=minimap;this.mc=minimap.getContext('2d');this.get=getState;this.onSelect=onSelect;this.onPlace=onPlace;this.camera={x:0,y:520,z:.95};this.selected=null;this.placement=null;this.hover=null;this.heat=false;this.pointers=new Map();this.dragged=false;this.anim=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.width=1;this.height=1;this.atlas=new Image();this.atlas.src='assets/factory-buildings.png';this.trains=new Image();this.trains.src='assets/trains-v08.png';this.workers=new Image();this.workers.src='assets/worker-v08.png';this.dpr=Math.min(2,devicePixelRatio||1);new ResizeObserver(()=>this.resize()).observe(canvas);this.bind();this.resize();this.home();}
 resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.canvas.width=Math.round(r.width*this.dpr);this.canvas.height=Math.round(r.height*this.dpr);}
 home(){this.camera.x=0;this.camera.y=525;this.camera.z=this.width<560?.62:this.width<900?.82:1.03;}
 focus(id){const b=this.get().buildings.find(b=>b.id===id);if(!b)return;const p=iso(b.x+1.5,b.y+1.5);this.camera.x=p.x;this.camera.y=p.y-10;this.selected=id;}
 screen(x,y){const p=iso(x,y);return {x:(p.x-this.camera.x)*this.camera.z+this.width*.53,y:(p.y-this.camera.y)*this.camera.z+this.height*.50};}
 tile(sx,sy){return uniso((sx-this.width*.53)/this.camera.z+this.camera.x,(sy-this.height*.50)/this.camera.z+this.camera.y);}
 zoom(factor,anchor){const a=anchor||{x:this.width/2,y:this.height/2},before=this.tile(a.x,a.y);this.camera.z=Math.max(.35,Math.min(1.8,this.camera.z*factor));const p=iso(before.x,before.y);this.camera.x=p.x-(a.x-this.width*.53)/this.camera.z;this.camera.y=p.y-(a.y-this.height*.5)/this.camera.z;this.clamp();}
 clamp(){this.camera.x=Math.max(-1200,Math.min(1600,this.camera.x));this.camera.y=Math.max(150,Math.min(1350,this.camera.y));}
 bind(){const el=this.canvas,point=e=>{const r=el.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);const p=point(e);this.pointers.set(e.pointerId,p);this.last=p;this.start=p;this.dragged=false;this.pinched=this.pointers.size>1;if(this.pointers.size===2){const [a,b]=[...this.pointers.values()];this.pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
  el.addEventListener('pointermove',e=>{const p=point(e);this.hover=this.tile(p.x,p.y);if(this.placement)this.placement.pos={x:Math.floor(this.hover.x)-1,y:Math.floor(this.hover.y)-1};if(!this.pointers.has(e.pointerId))return;const old=this.pointers.get(e.pointerId);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===2){const [a,b]=[...this.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(this.pinch>0)this.zoom(distance/this.pinch,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});this.pinch=distance;this.dragged=true;this.pinched=true;return;}
   if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>6)this.dragged=true;
   if(this.dragged){this.camera.x-=(p.x-old.x)/this.camera.z;this.camera.y-=(p.y-old.y)/this.camera.z;this.clamp();}
  });
  const up=e=>{if(!this.pointers.has(e.pointerId))return;const p=point(e),shouldClick=!this.dragged&&!this.pinched;this.pointers.delete(e.pointerId);if(this.pointers.size){this.start=[...this.pointers.values()][0];this.dragged=true;return;}if(shouldClick){const t=this.tile(p.x,p.y);if(this.placement){this.placement.pos={x:Math.floor(t.x)-1,y:Math.floor(t.y)-1};this.onPlace(this.placement.pos);return;}const hit=this.hit(p.x,p.y,t);this.selected=hit?.id||null;this.onSelect(hit?.id||null);}this.pinch=0;};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.dragged=true;this.pinched=true;});el.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(-e.deltaY*.001),point(e));},{passive:false});
  el.addEventListener('keydown',e=>{const d=80/this.camera.z;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','+','-'].includes(e.key))e.preventDefault();if(e.key==='ArrowUp')this.camera.y-=d;if(e.key==='ArrowDown')this.camera.y+=d;if(e.key==='ArrowLeft')this.camera.x-=d;if(e.key==='ArrowRight')this.camera.x+=d;if(e.key==='+')this.zoom(1.2);if(e.key==='-')this.zoom(1/1.2);this.clamp();});
  this.mini.addEventListener('pointerdown',e=>{const r=this.mini.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*S.WIDTH,y=(e.clientY-r.top)/r.height*S.HEIGHT,p=iso(x,y);this.camera.x=p.x;this.camera.y=p.y;this.clamp();});
 }
 hit(sx,sy,t){const bs=[...this.get().buildings].sort((a,b)=>b.x+b.y-a.x-a.y);const footprint=bs.find(b=>t.x>=b.x&&t.x<b.x+3&&t.y>=b.y&&t.y<b.y+3);if(footprint)return footprint;return bs.find(b=>{const p=this.screen(b.x+1.5,b.y+1.5),z=this.camera.z;return sx>p.x-86*z&&sx<p.x+86*z&&sy>p.y-111*z&&sy<p.y+31*z;});}
 diamond(x,y,w,h,fill,stroke){const c=this.ctx,p1=iso(x,y),p2=iso(x+w,y),p3=iso(x+w,y+h),p4=iso(x,y+h);c.beginPath();c.moveTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.lineTo(p3.x,p3.y);c.lineTo(p4.x,p4.y);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 line(path,color,width=3,dash=[]){if(!path?.length)return;const c=this.ctx;c.beginPath();path.forEach((p,i)=>{const a=iso(p.x+.5,p.y+.5);i?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y);});c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.setLineDash(dash);c.stroke();c.setLineDash([]);}
 label(text,x,y,color='#244b3c',bg='#f9fcf3e8',size=13){const c=this.ctx;c.font=`600 ${size}px -apple-system, sans-serif`;const w=c.measureText(text).width+20;c.fillStyle=bg;c.beginPath();c.roundRect(x-w/2,y-13,w,26,7);c.fill();c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y);}
 draw(time,running){this.anim=this.reduced?0:time/1000;const c=this.ctx,s=this.get();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);c.fillStyle='#b2cfad';c.fillRect(0,0,this.width,this.height);c.save();c.translate(this.width*.53,this.height*.5);c.scale(this.camera.z,this.camera.z);c.translate(-this.camera.x,-this.camera.y);
  this.diamond(-5,-5,48,41,'#a6c89e');this.diamond(0,0,S.WIDTH,S.HEIGHT,'#b8d2ac','#8fab8a');
  for(let y=0;y<S.HEIGHT;y++)for(let x=0;x<S.WIDTH;x++){
   const locked=!s.expanded&&(x>=24||y>=23);let col=(x+y)%2?'#cbd9bc':'#c7d6b7';if(y>=27)col=['#70b1b6','#73b8bd','#80c2c4'][(x+y)%3];else if(x<2||y<2||x>35)col='#a8c69b';else if(locked)col=(x+y)%2?'#b5caa6':'#b8cda9';
   this.diamond(x,y,1,1,col,y<27?'#e7eddb35':null);
  }
  for(const [y,x1,x2] of [[10,3,32],[16,3,33],[22,3,33]]){this.diamond(x1,y,x2-x1,1,'#dce2d0');this.line([{x:x1,y},{x:x2-1,y}],'#a1ad94',1,[3,7]);}
  this.diamond(4,3,1,22,'#dde3d2');this.line([{x:4,y:3},{x:4,y:24}],'#a0b199',1,[4,7]);
  this.line([{x:2,y:25},{x:35,y:25}],'#727f72',9);this.line([{x:2,y:25},{x:35,y:25}],'#d3d4bc',5,[3,8]);this.line([{x:2,y:25},{x:35,y:25}],'#74857a',1);
  if(!s.expanded){this.line([{x:24,y:2},{x:24,y:23},{x:2,y:23}],'#829974',2,[7,6]);const p=iso(29,15);this.label('拡張用地 · 6,000 G',p.x,p.y,'#557346','#d5e3becc',15);this.label('建設 → 用地を拡張',p.x,p.y+34,'#718160','#d5e3be99',12);}
  const gate=iso(S.supply.x+.5,S.supply.y+.5);this.diamond(S.supply.x-1,S.supply.y-1,2,2,'#afc49b','#678a72');this.label('資材搬入口',gate.x,gate.y-18,'#4b684e','#eff4e1',12);
  const exit=iso(S.dispatch.x+.5,S.dispatch.y+.5);this.diamond(S.dispatch.x-1,S.dispatch.y-1,2,2,'#a8c0a2','#719486');this.label('出荷ゲート',exit.x,exit.y,'#166b65','#e7f5e6',12);
  for(let i=0;i<3;i++){const a=s.buildings.find(b=>S.TYPES[b.type].stage===i),b=s.buildings.find(b=>S.TYPES[b.type].stage===i+1);if(a&&b)this.line(S.route(s,S.port(a),S.port(b)),'#5eaa9466',3,[5,7]);}
  for(const j of s.jobs)if(j.status==='transfer'&&(this.heat||j.target===this.selected))this.line(j.path,'#30948988',2,[6,5]);
  if(this.heat)for(const b of s.buildings){const status=S.status(s,b),n=b.queue.length+S.incoming(s,b.id);this.diamond(b.x-.3,b.y-.3,3.6,3.6,status.kind==='broken'?'#e55d5277':n>=2||status.kind==='blocked'?'#eea64e88':'#46b39e66');}
  const objects=s.buildings.map(b=>({depth:b.x+b.y+3,kind:'building',b}));for(const j of s.jobs)if(j.status==='transfer'){const idx=Math.min(j.path.length-1,j.travel/j.travelTime*(j.path.length-1)),a=j.path[Math.floor(idx)],b=j.path[Math.min(j.path.length-1,Math.ceil(idx))],f=idx%1,pos={x:a.x+(b.x-a.x)*f+.5,y:a.y+(b.y-a.y)*f+.5};objects.push({depth:pos.x+pos.y,kind:'train',j,pos});}
  objects.sort((a,b)=>a.depth-b.depth);for(const o of objects){if(o.kind==='building')this.building(o.b,s,running);else this.train(o.j.product,o.pos.x,o.pos.y,53);}
  if(this.placement){const p=this.placement.pos||{x:19,y:7},valid=S.buildCheck(s,this.placement.type,p.x,p.y).ok;this.diamond(p.x,p.y,3,3,valid?'#40a68988':'#e4656288',valid?'#0c8166':'#c2382c');c.globalAlpha=.55;this.sprite(this.placement.type,p.x,p.y);c.globalAlpha=1;const a=iso(p.x+1.5,p.y+3);this.label(valid?'タップして建設位置を決定':'ここには建設できません',a.x,a.y+28,valid?'#146e5b':'#ba483d','#fffffff0',12);}
  for(const e of s.effects){if(e.kind==='delivery'){const a=iso(S.dispatch.x+.5,S.dispatch.y+.5);this.train(e.product,S.dispatch.x-1+(s.t-e.t)*1.5,S.dispatch.y+1,72);c.globalAlpha=Math.max(0,1-(s.t-e.t)/4);this.label('+'+e.amount.toLocaleString()+' G',a.x,a.y-35-(s.t-e.t)*14,'#006b57','#fff8da',17);c.globalAlpha=1;}}
  c.restore();this.drawMini(s);}
 sprite(type,x,y){const p=iso(x+1.5,y+1.5),i=S.TYPES[type].sprite,w=260;if(this.atlas.complete&&this.atlas.naturalWidth)this.ctx.drawImage(this.atlas,(i%3)*512,Math.floor(i/3)*512,512,512,p.x-w/2,p.y-w*.72,w,w);}
 building(b,s,running){const c=this.ctx,meta=S.TYPES[b.type],p=iso(b.x+1.5,b.y+1.5),st=S.status(s,b),selected=b.id===this.selected;
  if(selected)this.diamond(b.x-.12,b.y-.12,3.24,3.24,'#fcfff322','#fefae2');
  this.sprite(b.type,b.x,b.y);
  const busy=st.kind==='working'&&meta.stage!==null;if(busy){const j=s.jobs.find(j=>j.id===b.active);if(j)this.train(j.product,b.x+1.9,b.y+2.4,64);if(this.workers.complete&&this.workers.naturalWidth){const w=36,yy=running?Math.sin(this.anim*6+b.x)*2:0;c.drawImage(this.workers,p.x+54,p.y-7+yy,w,w);}}
  const title=meta.short+' '+b.id.replace('b','').padStart(2,'0');this.label(title,p.x,p.y+75,selected?'#fff':'#254d3a',selected?'#1c685b':'#fcfdf4e8',13);
  const statusColor=st.kind==='broken'?'#c54b3b':st.kind==='blocked'?'#bf742c':st.kind==='working'?'#238b75':'#758467';
  c.font='11px -apple-system,sans-serif';c.textAlign='center';c.fillStyle=statusColor;c.fillText(st.label+(meta.stage!==null?' · '+b.staff+'人':''),p.x,p.y+97);
  if(meta.stage!==null){c.fillStyle='#46634b33';c.beginPath();c.roundRect(p.x-44,p.y+108,88,4,2);c.fill();const j=s.jobs.find(j=>j.id===b.active);const progress=b.repairRemaining?1-b.repairRemaining/(b.preventive?8:16):j&&j.status==='work'?Math.min(1,b.progress/S.PRODUCTS[j.product].work[j.stage]):j?1:0;c.fillStyle=statusColor;c.beginPath();c.roundRect(p.x-44,p.y+108,88*progress,4,2);c.fill();}
  const wait=b.queue.length+S.incoming(s,b.id);if(wait||st.kind==='broken'||st.kind==='blocked'){const bx=p.x+84,by=p.y-103;c.fillStyle=st.kind==='broken'?'#d46145':wait>=2||st.kind==='blocked'?'#d18439':'#608671';c.beginPath();c.arc(bx,by,14,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(st.kind==='broken'?'!':wait||'!',bx,by);}
  if(b.level>1)this.label('Lv.'+b.level,p.x-72,p.y-103,'#7a652d','#fff5cd',10);
 }
 train(id,x,y,size){if(!this.trains.complete||!this.trains.naturalWidth)return;const i=S.PRODUCT_IDS.indexOf(id),p=iso(x,y),sw=this.trains.naturalWidth/4,sh=this.trains.naturalHeight/2;this.ctx.drawImage(this.trains,(i%4)*sw,Math.floor(i/4)*sh,sw,sh,p.x-size/2,p.y-size*.72,size,size);}
 drawMini(s){const c=this.mc,w=this.mini.width,h=this.mini.height;c.fillStyle='#bfd2ad';c.fillRect(0,0,w,h);if(!s.expanded){c.fillStyle='#95b389';c.fillRect(24/S.WIDTH*w,0,w,h);c.fillRect(0,23/S.HEIGHT*h,w,h);}c.fillStyle='#6eafb2';c.fillRect(0,27/S.HEIGHT*h,w,h);for(const b of s.buildings){c.fillStyle=b.broken?'#d64e3e':S.TYPES[b.type].color;c.fillRect(b.x/S.WIDTH*w,b.y/S.HEIGHT*h,3/S.WIDTH*w,3/S.HEIGHT*h);}const corners=[[0,0],[this.width,0],[this.width,this.height],[0,this.height]].map(p=>this.tile(...p));c.strokeStyle='#fff9';c.fillStyle='#ffffff11';c.lineWidth=1.5;c.beginPath();corners.forEach((p,i)=>i?c.lineTo(p.x/S.WIDTH*w,p.y/S.HEIGHT*h):c.moveTo(p.x/S.WIDTH*w,p.y/S.HEIGHT*h));c.closePath();c.fill();c.stroke();}
}
root.YardWorld=YardWorld;
})(typeof globalThis!=='undefined'?globalThis:this);
