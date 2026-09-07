/* Original stage arrangements, rendered to PCM for gesture-started HTML Audio. */
(function(root){'use strict';
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function arrange(seed){seed=Math.max(1,Math.floor(Number(seed)||1));const rand=random(seed*719),bpm=[104,112,118,124,108,120,116,100,126,110,122,114][(seed-1)%12],beat=60/bpm;
 const tonic=[60,62,65,67,69][(seed-1)%5],scale=[0,2,4,5,7,9,11],progressions=[[0,5,3,4],[0,3,5,4],[0,4,5,3],[0,5,4,3]],progression=progressions[Math.floor(seed/5)%4],events=[],bars=8;
 const pitch=degree=>tonic+scale[((degree%7)+7)%7]+12*Math.floor(degree/7);
 for(let bar=0;bar<bars;bar++){const chord=progression[bar%4],at=bar*4*beat;
  for(let p=0;p<16;p++){const t=at+p*beat/4;if(p%2===0||((seed+bar+p)%7===0)){const degree=p%4===0?chord+[0,2,4][Math.floor(rand()*3)]:Math.floor(rand()*7);const lead=pitch(degree)+12;events.push({note:lead>96?lead-12:lead,time:t,duration:beat*(p%4===0?.65:.32),volume:.2,voice:seed%3});}
   if(p%4===0){events.push({note:pitch(chord)-24,time:t,duration:beat*.6,volume:.24,voice:0});events.push({note:36+(p%8?7:0),time:t,duration:.08,volume:.17,voice:0});}
   if(p===0||p===8)for(const degree of [chord,chord+2,chord+4])events.push({note:pitch(degree),time:t,duration:beat*.8,volume:.045,voice:2});
  }
 }
 return {seed,bpm,duration:bars*4*beat,events};
}
function renderWav(seed){const score=arrange(seed),rate=16000,length=Math.round(score.duration*rate),samples=new Float32Array(length);
 for(const e of score.events){const start=Math.round(e.time*rate),count=Math.round(e.duration*rate),frequency=440*Math.pow(2,(e.note-69)/12),phase=2*Math.PI*frequency/rate;
  for(let i=0;i<count;i++){const envelope=Math.min(1,i/(rate*.006))*Math.exp(-5*i/count),x=phase*i;const wave=Math.sin(x)+(e.voice===1?.28*Math.sin(2*x):e.voice===2?.16*Math.sin(3*x):0);samples[(start+i)%length]+=wave*envelope*e.volume;}
 }
 let peak=.001;for(const n of samples)peak=Math.max(peak,Math.abs(n));const bytes=new Uint8Array(44+length*2),view=new DataView(bytes.buffer),word=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i);};
 word(0,'RIFF');view.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,length*2,true);
 const gain=.65/peak;for(let i=0;i<length;i++)view.setInt16(44+i*2,Math.round(samples[i]*gain*32767),true);return bytes;
}
const api={arrange,renderWav};root.FactoryMusic=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
