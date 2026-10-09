import {typingFrame,createBarkCycle} from './speech-animation.js';
import {createSpeechBubble} from './speech-bubble.js';
import {activityPhrase} from './activity-phrases.js';
import './work-status.css';
const helper='http://127.0.0.1:5175';
const restPhrase='옥상에서 잠시 쉬는 중';
export function createWorkStatus({camera,getAnchor,getDogAnchor=()=>null,isDogOutside=()=>false}) {
  const local=location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)
    && ['5174','4173','4174'].includes(location.port);
  const windows=/Win/i.test(navigator.userAgentData?.platform??navigator.platform??'');
  const canConnect=local||(windows&&location.origin==='https://apochill.lastweek.chatgpt.site');
  const bubble=createSpeechBubble(camera,{label:restPhrase});
  const dogBubble=createSpeechBubble(camera,{className:'dog-status-bubble',label:'월월!!'});
  dogBubble.setLabel('월월!!','');
  const bark=createBarkCycle();
  const panel=document.createElement('div');panel.className='work-status-panel';
  const button=document.createElement('button');button.type='button';button.textContent='내 PC 작업 연결';
  button.setAttribute('aria-pressed','false');button.title='이 PC의 앱 이름만 읽습니다. 창 제목이나 문서 내용은 읽지 않습니다.';
  const hint=document.createElement('span');hint.textContent=canConnect?'PC 도우미 실행 후 연결 · 앱 이름만 감지':'앱 감지는 Windows PC에서 연결할 수 있어요';
  panel.append(button,hint);button.disabled=!canConnect;document.querySelector('.scene-controls').append(panel);
  let enabled=false,disposed=false,busy=false,inFlight=false,phrase=restPhrase,abort=null,age=0,lastSeconds=null;
  let detectedApp='',mood=0,nextAttempt=0,failures=0;
  let requested=canConnect,preferDetection=canConnect;
  try{const pref=localStorage.getItem('apochill-app-detection');preferDetection=canConnect&&pref!=='off';requested=preferDetection;}catch{}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function setPhrase(text){
    text=text.replace(/[.\u2026\s]+$/u,'');
    if(phrase===text)return;
    phrase=text;age=0;bubble.setLabel(phrase);
  }
  function setApp(app){
    if(app===detectedApp)return;
    detectedApp=app;mood=0;age=0;setPhrase(activityPhrase(app,mood));
  }
  function offline(){
    enabled=false;button.textContent='내 PC 작업 연결';button.setAttribute('aria-pressed','false');
    hint.textContent='PC 연결 재시도 중 · 연결 권한과 PC 도우미를 확인해 주세요';
    setApp('');setPhrase(restPhrase);
  }
  async function request(path,method='GET',permission=false){
    const controller=new AbortController();abort=controller;
    const timer=setTimeout(()=>controller.abort(),permission?30000:2500);
    try{return await fetch(helper+path,{method,mode:'cors',cache:'no-store',credentials:'omit',targetAddressSpace:'loopback',signal:controller.signal,
      ...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});}
    finally{clearTimeout(timer);if(abort===controller)abort=null;}
  }
  async function readStatus(){
    const response=await request('/status');if(!response.ok)throw Error('Helper unavailable');
    const status=await response.json();if(disposed)return;
    if(status.protocol!==2)throw Error('Restart updated helper');
    enabled=status.enabled===true;
    button.textContent=enabled?'작업 감지 끄기':'내 PC 작업 연결';button.setAttribute('aria-pressed',String(enabled));
    setApp(enabled&&status.connected&&typeof status.app==='string'?status.app.trim().slice(0,40):'');
    hint.textContent=enabled?(status.connected?(detectedApp?`현재 앱: ${detectedApp} · 실시간 연결`:'앱 연결됨 · 지원하지 않는 앱'):'활성 앱을 확인하는 중…'):'앱 감지 꺼짐';
    failures=0;nextAttempt=0;
  }
  async function poll(){
    if(!canConnect||!requested||disposed||busy||inFlight||document.hidden||performance.now()<nextAttempt)return;
    inFlight=true;
    try{
      await readStatus();
      // Recover when the helper restarts or its sampler process exits.
      if(!enabled&&requested){const response=await request('/start','POST');if(!response.ok)throw Error('Helper unavailable');await readStatus();}
    }
    catch{if(!disposed){offline();failures++;nextAttempt=performance.now()+Math.min(30000,3000*2**Math.min(4,failures-1));}}
    finally{inFlight=false;}
  }
  async function toggle(){
    if(!canConnect||busy||inFlight)return;busy=true;button.disabled=true;
    const starting=!enabled;
    hint.textContent=starting?'PC 연결 중 · 브라우저 연결 권한을 허용해 주세요':'앱 감지를 끄는 중…';
    try{
      const response=await request(starting?'/start':'/stop','POST',starting);if(!response.ok)throw Error('Helper unavailable');
      if(disposed)return;
      requested=starting;preferDetection=starting;
      try{localStorage.setItem('apochill-app-detection',starting?'on':'off');}catch{}
      await readStatus();
    }catch{if(!disposed){offline();requested=starting;nextAttempt=performance.now()+5000;}}
    finally{busy=false;button.disabled=!canConnect;}
  }
  const onVisible=()=>{if(!document.hidden){nextAttempt=0;void poll();}};
  document.addEventListener('visibilitychange',onVisible);
  button.addEventListener('click',toggle);const interval=setInterval(poll,1500);
  // Connect on Windows by default, respecting the saved off switch and the
  // browser's loopback permission. Activity never leaves this visitor's PC.
  if(canConnect&&preferDetection)void toggle();
  return {
    update(seconds){
      const dt=lastSeconds===null?0:Math.min(.1,Math.max(0,seconds-lastSeconds));lastSeconds=seconds;
      if(document.hidden||document.documentElement.dataset.introActive==='true'){bubble.update(null,'');dogBubble.update(null,'');return;}
      age+=dt;
      if(detectedApp&&age>=Array.from(phrase).length*.075+2.8){
        mood=(mood+1)%3;age=0;setPhrase(activityPhrase(detectedApp,mood));
      }
      const frame=typingFrame(phrase,age,{reduced:reduced.matches});
      bubble.update(getAnchor(),frame.text+frame.dots,frame.opacity);
      const dogFrame=bark.update(dt,isDogOutside(),reduced.matches);
      dogBubble.update(dogFrame.visible?getDogAnchor():null,dogFrame.text??'',dogFrame.opacity??0);
    },
    dispose(){disposed=true;clearInterval(interval);abort?.abort();document.removeEventListener('visibilitychange',onVisible);button.removeEventListener('click',toggle);bubble.dispose();dogBubble.dispose();panel.remove();},
  };
}
