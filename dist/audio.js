/* Original procedural soundtrack: Sunny Assembly, 112 BPM, C major. No samples. */
(function(root){
'use strict';
const BEAT=60/112, STEP=BEAT/4;
const chords=[[60,64,67],[57,60,64],[53,57,60],[55,59,62],[60,64,67],[57,60,64],[53,57,60],[55,59,62]];
const melody=[[76,0,79,0,81,79,76,0,74,0,72,0,74,76,79,0],[76,0,72,0,69,0,72,74,76,0,79,76,74,0,72,0],[77,0,76,0,72,0,69,0,72,74,77,0,76,0,72,0],[74,0,79,0,83,0,81,79,74,0,76,74,71,0,67,0],[84,0,79,81,79,0,76,0,74,0,76,79,81,0,79,0],[81,0,76,0,72,74,76,0,79,76,74,0,72,0,69,0],[77,0,81,0,84,0,81,79,77,0,76,0,72,0,74,0],[79,0,74,0,71,74,79,0,83,81,79,0,74,0,72,0]];
class FactoryAudio{
 constructor(){this.ctx=null;this.enabled=true;this.musicLevel=.65;this.fxLevel=.7;this.musicEnabled=true;this.fxEnabled=true;this.playing=false;this.timer=null;this.voices=new Set();this.step=0;this.next=0;this.failed=false;this.media=null;this.mediaFailed=false;this.mediaPending=null;this.onstatus=null;this.stageURL=null;this.stageSeed=null;this.mediaRevision=0;}
 setStage(seed){if(seed===this.stageSeed)return;this.setPlaying(false);this.mediaRevision++;this.mediaPending=null;this.stageSeed=seed;
  const previous=this.stageURL;this.stageURL=null;if(root.FactoryMusic&&root.URL?.createObjectURL&&typeof root.Blob==='function'){try{this.stageURL=root.URL.createObjectURL(new root.Blob([root.FactoryMusic.renderWav(seed)],{type:'audio/wav'}));}catch(_){this.stageURL=null;}}
  if(this.media){this.media.src=this.stageURL||'assets/sunny-assembly.wav';this.media.currentTime=0;this.mediaFailed=false;}if(previous)root.URL.revokeObjectURL(previous);
 }
 async unlock(){
  if(!this.enabled)return false;
  try{if(root.navigator?.audioSession)root.navigator.audioSession.type='playback';}catch(_){}
  this.prepareMedia();const mediaReady=this.playing?this.playMedia():Promise.resolve(false);
  try{if(!this.ctx||this.ctx.state==='closed'){const C=root.AudioContext||root.webkitAudioContext;if(!C)throw Error('Audio unavailable');this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.9;this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-18;this.compressor.ratio.value=5;this.master.connect(this.compressor).connect(this.ctx.destination);}
   if(this.ctx.state!=='running')await this.ctx.resume();this.failed=this.ctx.state!=='running';if(this.playing)this.startMusic();const mediaOK=await mediaReady;return !this.failed||mediaOK;
  }catch(_){this.failed=true;return await mediaReady;}
 }
 prepareMedia(){if(!this.media&&typeof root.Audio==='function'){this.media=new root.Audio(this.stageURL||'assets/sunny-assembly.wav');this.media.loop=true;this.media.preload='auto';this.media.setAttribute('playsinline','');this.media.addEventListener('error',()=>{this.mediaFailed=true;this.onstatus?.();});}if(this.media)this.media.volume=this.musicLevel;}
 playMedia(){this.prepareMedia();if(!this.media||!this.playing||!this.enabled||!this.musicEnabled||this.musicLevel<=0)return Promise.resolve(false);if(this.mediaPending)return this.mediaPending;
  try{const revision=this.mediaRevision,p=this.media.play();this.mediaPending=Promise.resolve(p).then(()=>{if(revision!==this.mediaRevision)return false;if(!this.playing||!this.enabled||!this.musicEnabled){this.media.pause();return false;}this.mediaFailed=false;this.onstatus?.();return true;},()=>{if(revision===this.mediaRevision){this.mediaFailed=true;this.onstatus?.();}return false;}).finally(()=>{if(revision===this.mediaRevision)this.mediaPending=null;});return this.mediaPending;}catch(_){this.mediaFailed=true;this.onstatus?.();return Promise.resolve(false);}}
 ready(){return this.media?!this.media.paused&&!this.mediaFailed:this.ctx?.state==='running';}
 tone(note,time,duration,volume,type='sine',channel='fx'){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
  if(channel==='music'?!this.musicEnabled:!this.fxEnabled)return;const level=channel==='music'?this.musicLevel:this.fxLevel;if(level<=0)return;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=440*Math.pow(2,(note-69)/12);
  g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*level),time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+duration);
  o.connect(g).connect(this.master);const voice={o,g,channel};this.voices.add(voice);o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(voice);};o.start(time);o.stop(time+duration+.02);
 }
 schedule(){
  if(!this.ctx||this.ctx.state!=='running'||!this.playing||!this.enabled||!this.musicEnabled)return;
  if(this.next<this.ctx.currentTime)this.next=this.ctx.currentTime+.03;
  while(this.next<this.ctx.currentTime+.12){const p=this.step%16,b=Math.floor(this.step/16)%8,c=chords[b],t=this.next;
   if(melody[b][p])this.tone(melody[b][p],t,.19,.20,'triangle','music');
   if(p%4===0){this.tone(c[p===8?2:0]-24,t,.23,.23,'sine','music');this.tone(p%8===0?36:44,t,.065,.20,'sine','music');}
   if(p%4===2){this.tone(c[(p/2)%3|0]+12,t,.075,.055,'sine','music');this.tone(102,t,.025,.025,'triangle','music');}
   if(p===0||p===8)c.forEach(n=>this.tone(n,t,.35,.035,'triangle','music'));
   this.step++;this.next+=STEP;
  }
 }
 startMusic(){if(this.media){if(!this.mediaFailed&&this.media.paused)this.playMedia();return;}if(this.timer||!this.playing||!this.enabled||!this.musicEnabled||this.ctx?.state!=='running')return;this.next=this.ctx.currentTime+.03;this.schedule();this.timer=setInterval(()=>this.schedule(),25);}
 stopVoices(channel){for(const v of this.voices)if(!channel||v.channel===channel){try{v.o.stop();}catch(_){}v.o.disconnect();v.g.disconnect();this.voices.delete(v);}}
 setPlaying(value){this.playing=!!value;if(value){this.prepareMedia();this.startMusic();}else{this.media?.pause();clearInterval(this.timer);this.timer=null;this.stopVoices('music');}}
 setEnabled(value){this.enabled=!!value;if(!value){this.media?.pause();clearInterval(this.timer);this.timer=null;this.stopVoices();}else this.unlock();}
 setChannel(channel,value){if(channel==='music'){this.musicEnabled=!!value;if(!value){this.media?.pause();clearInterval(this.timer);this.timer=null;this.stopVoices('music');}else this.startMusic();}else{this.fxEnabled=!!value;if(!value)this.stopVoices('fx');}}
 setLevel(channel,value){const level=Math.min(1,Math.max(0,Number(value)||0));if(channel==='music'){this.musicLevel=level;if(this.media)this.media.volume=level;}else this.fxLevel=level;this.stopVoices(channel==='music'?'music':'fx');}
 suspend(){this.setPlaying(false);this.stopVoices();if(this.ctx&&this.ctx.state==='running')this.ctx.suspend().catch(()=>{});}
 reset(){this.setPlaying(false);this.stopVoices();this.step=0;if(this.media)this.media.currentTime=0;}
 effect(kind,combo=1){
  if(!this.enabled||this.ctx?.state!=='running')return;
  const t=this.ctx.currentTime+.01,play=(notes,spacing=.09,duration=.24,vol=.24)=>notes.forEach((n,i)=>this.tone(n,t+i*spacing,duration,vol));
  if(kind==='notice')play([79,72,79,84],.11,.23,.35);
  else if(kind==='great')play([72,76,79,84,88],.07,.28,.32);
  else if(kind==='win'){[0,.45,1.0].forEach((offset,i)=>[60,64,67,72].forEach(n=>this.tone(n+(i===1?5:0),t+offset,.65,.14)));play([72,76,79,84,79,84],.15,.4,.3);}
  else if(kind==='delivery'){const lift=Math.min(3,Math.max(0,combo-1))*2;play([72+lift,76+lift,79+lift,84+lift],.075,.25,.28);}
  else if(kind==='support')play([60,67,72,79],.055,.16,.22);
  else if(kind==='stage')play([76,79],.06,.10,.12);
  else if(kind==='tick')play([79],.08,.05,.11);
  else if(kind==='late')play([64,60],.14,.16,.14);
  else if(kind==='count')play([72],.1,.08,.12);
  else play([72,76],.05,.12,.17);
 }
}
root.FactoryAudio=FactoryAudio;
if(typeof module==='object'&&module.exports)module.exports={FactoryAudio,melody,chords,BEAT};
})(typeof globalThis!=='undefined'?globalThis:this);
