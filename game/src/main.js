import {makeState,STEP} from './state.js';
import {mulberry32} from './rng.js';
import {makeInput} from './input.js';
import {makeBulletPool,updateBullets} from './bullets.js';
import {makeParticles,updateParticles,burst} from './particles.js';
import {spawnWells,force} from './wells.js';
import {updatePlayer} from './player.js';
import {updateEnemies} from './enemies.js';
import {startWave,spawnWaveEnemies} from './waves.js';
import {render,initRender} from './render.js';
import {setCallbacks,showTitle,showPause,showDraft,showEnd,updateHud,hideOverlay} from './hud.js';
import {shotSetup} from './shots.js';
import {sound} from './audio.js';

const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),input=makeInput(canvas),pool=makeBulletPool();
let seed=Number(new URLSearchParams(location.search).get('seed'))||1,s=makeState(seed);
s.rng=mulberry32(seed);s.particles=makeParticles();spawnWells(s,2);initRender(s.rng);
const shot=new URLSearchParams(location.search).get('shot');shotSetup(s,shot);if(shot==='play'){for(let n=0;n<15;n++)pool.fire(380+n*20,510-(n%3)*12,310+n*4,-115-n*3,0);}
function reset(){const best=s.best;s=makeState((Date.now()&0xffffffff)>>>0);s.best=best;s.rng=mulberry32(s.seed);s.particles=makeParticles();spawnWells(s,2);initRender(s.rng);for(const b of pool.items)b.active=false;hideOverlay();startWave(s,1);s.phase='playing'}
setCallbacks({start:reset,resume:()=>{s.phase='playing';hideOverlay()}});if(s.phase==='title'&&!s.shot)showTitle(s);
let last=performance.now(),acc=0;
function step(dt){
 s.time+=dt;
 if(s.phase==='playing'){
  s.runTime+=dt;s.waveClock+=dt;s.spawnTimer-=dt;s.damageFlash=Math.max(0,s.damageFlash-dt);s.banner=Math.max(0,s.banner-dt);s.slowmo=Math.max(0,s.slowmo-dt);
  if(s.hitstop>0){s.hitstop-=dt;return}
  spawnWaveEnemies(s);
  updatePlayer(s,input,dt,pool,(o,d)=>force(s,o,d),burst,sound);
  updateEnemies(s,dt,pool,(o,d)=>force(s,o,d),burst,sound);
  updateBullets(s,pool,dt,(o,d)=>force(s,o,d),(e,b)=>{s.hits++;if(b.pierce>0)b.pierce--;else b.active=false;if(e.hp<=0)s.score+=20});
  for(const q of s.pickups){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.95;q.vy*=.95;if(Math.hypot(q.x-s.player.x,q.y-s.player.y)<s.player.r+13){if(q.kind==='heal')s.player.hp=Math.min(100,s.player.hp+24);if(q.kind==='shield')s.player.shield=6;if(q.kind==='overdrive')s.player.overdrive=8;if(q.kind==='magnet')s.player.magnet=10;sound('pickup',s.muted);burst(s,q.x,q.y,'#f4cb70',12,90);q.life=0}}
  s.pickups=s.pickups.filter(q=>q.life>0);updateParticles(s,dt);
  if(s.player.hp<=0){s.player.hp=0;s.phase='gameover';s.best=Math.max(s.best,s.score);localStorage.setItem('starwake-best',String(s.best));showEnd(s)}
  else if(!s.enemies.length&&!s.spawnLeft&&s.waveClock>.8){s.phase='draft';s.between=true;s.slowmo=.4;s.bannerText=`WAVE ${String(s.wave).padStart(2,'0')} CLEARED`;s.banner=2;sound('clear',s.muted);showDraft(s)}
  updateHud(s);
 }else if(s.phase==='title'){
  for(const e of s.enemies){e.x+=Math.sin(s.time+e.phase)*.2;e.y+=Math.cos(s.time+e.phase)*.18}updateParticles(s,dt);if(input.fire||input.keys.has('enter'))reset();
 }else if(s.phase==='draft'){s.banner=Math.max(0,s.banner-dt);updateParticles(s,dt)}
 else if(s.phase==='victory'){if(!document.getElementById('overlay').classList.contains('show'))showEnd(s,true)}
 if(input.keys.has('m')){s.muted=!s.muted;input.keys.delete('m')}
 if(input.keys.has('p')||input.keys.has('escape')){if(s.phase==='playing'){s.phase='paused';showPause()}else if(s.phase==='paused'){s.phase='playing';hideOverlay()}input.keys.delete('p');input.keys.delete('escape')}
}
function frame(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;acc+=elapsed;while(acc>=STEP){step(s.slowmo>0?STEP*.35:STEP);acc-=STEP}render(ctx,s,pool);if(s.shot&&!window.__shotReady){updateHud(s);if(s.phase==='title')showTitle(s);if(s.phase==='draft'&&!document.querySelector('.card'))showDraft(s);if(s.phase==='victory')showEnd(s,true);requestAnimationFrame(()=>{window.__shotReady=true})}requestAnimationFrame(frame)}
requestAnimationFrame(frame);
