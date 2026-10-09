import {BgmPlayer,validatePlaylist} from './bgm-player.js';
import {createBgmAutoplay} from './bgm-autoplay.js';
import './bgm.css';
const panel=document.createElement('section');
panel.className='bgm-panel';panel.setAttribute('aria-label','내 음악 라디오');
panel.innerHTML=`<div class="radio-heading"><span class="bgm-label">APOCHILL RADIO</span><button class="radio-toggle" type="button" disabled aria-label="음악 재생"><span class="radio-icon" aria-hidden="true">▶</span><span class="radio-toggle-label">재생</span></button></div><label class="radio-track-label" for="radio-track">내 음악</label><select id="radio-track" class="radio-track" disabled aria-label="재생할 음악"><option>음원 없음</option></select><div class="radio-local-controls"><label class="radio-files">음원 선택<input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" multiple></label><label class="radio-volume">볼륨<input type="range" min="0" max="100" value="30" aria-label="음악 볼륨"></label></div><p class="radio-status" role="status" aria-live="polite">음원 목록을 확인하는 중…</p>`;
document.querySelector('.scene-controls').append(panel);
const toggle=panel.querySelector('.radio-toggle'),select=panel.querySelector('.radio-track'),status=panel.querySelector('.radio-status');
const volume=panel.querySelector('.radio-volume input'),files=panel.querySelector('input[type=file]');
const introMusic=document.querySelector('#prologue-music');
let urls=[],disposed=false,sourceVersion=0;
const controller=new AbortController();
let savedVolume=.3;
try{const stored=localStorage.getItem('apochill-bgm-volume');if(stored!==null&&Number.isFinite(Number(stored)))savedVolume=Math.max(0,Math.min(1,Number(stored)));}catch{}
volume.value=String(Math.round(savedVolume*100));
const player=new BgmPlayer({volume:savedVolume,onChange:s=>{
  panel.dataset.playback=s.state;
  const active=['playing','loading'].includes(s.state);
  toggle.disabled=!s.count;toggle.setAttribute('aria-label',active?'음악 정지':'음악 재생');
  toggle.setAttribute('aria-pressed',String(s.state==='playing'));
  toggle.querySelector('.radio-icon').textContent=active?'■':'▶';
  toggle.querySelector('.radio-toggle-label').textContent=active?'정지':'재생';
  select.value=String(player.index);
  status.textContent=s.state==='playing'?`${s.track.title} · 순환 재생`:s.message;
  if(introMusic){
    introMusic.disabled=!s.count;introMusic.textContent=active?'음악 끄기':'음악 켜기';
    introMusic.setAttribute('aria-pressed',String(s.state==='playing'));
    introMusic.title=s.track?`${s.track.title} · ${s.message||'재생 중'}`:'음원을 준비하고 있어요';
  }
}});
const autoplay=createBgmAutoplay({player});
function replaceTracks(tracks){
  player.setTracks(tracks);urls.forEach(url=>URL.revokeObjectURL(url));urls=[];
  select.replaceChildren(...tracks.map((track,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=track.title;return option;}));
  select.disabled=!tracks.length;
  if(!tracks.length){const option=document.createElement('option');option.textContent='음원 없음';select.append(option);status.textContent='제작한 음악을 선택하면 이 화면에서 재생돼요.';}
  select.value='0';
}
function togglePlayback(){
  autoplay.cancel();
  if(['playing','loading'].includes(player.state))player.stop();else void player.play();
}
toggle.addEventListener('click',togglePlayback);introMusic?.addEventListener('click',togglePlayback);
select.addEventListener('change',()=>{autoplay.cancel();player.select(Number(select.value));void player.play();});
volume.addEventListener('input',()=>{player.setVolume(Number(volume.value)/100);try{localStorage.setItem('apochill-bgm-volume',String(player.volume));}catch{}});
files.addEventListener('change',()=>{
  const chosen=[...files.files].filter(file=>/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name));
  if(!chosen.length)return;
  autoplay.cancel();
  ++sourceVersion;
  const local=chosen.map(file=>({title:file.name.replace(/\.[^.]+$/,''),src:URL.createObjectURL(file)}));
  replaceTracks(local);urls=local.map(track=>track.src);
  status.textContent='선택한 음원은 이 기기에서만 재생돼요. ▶ 재생을 눌러 주세요.';files.value='';
});
const version=sourceVersion;
fetch(`${import.meta.env.BASE_URL}audio/bgm/playlist.json`,{signal:controller.signal,cache:'no-store'})
  .then(response=>{if(!response.ok)throw Error('playlist');return response.json();})
  .then(data=>{if(disposed||version!==sourceVersion)return;replaceTracks(validatePlaylist(data,new URL(`${import.meta.env.BASE_URL}audio/bgm/`,location.href).href));autoplay.start();})
  .catch(error=>{if(disposed||error.name==='AbortError'||version!==sourceVersion)return;replaceTracks([]);});
const pause=()=>{autoplay.cancel();player.pause();};
const hidden=()=>{if(document.hidden)pause();};
document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pause);
if(import.meta.hot)import.meta.hot.dispose(()=>{
  disposed=true;autoplay.dispose();controller.abort();void player.dispose();urls.forEach(url=>URL.revokeObjectURL(url));
  introMusic?.removeEventListener('click',togglePlayback);
  document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pause);panel.remove();
});
