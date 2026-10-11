import {typingFrame,createBarkCycle} from './speech-animation.js';
import {createSpeechBubble} from './speech-bubble.js';
import {activityPhrase} from './activity-phrases.js';
import {workStates,helperDownload} from './work-status-options.js';
import './work-status.css';
const helper='http://127.0.0.1:5175';
export function createWorkStatus({camera,getAnchor,getDogAnchor=()=>null,isDogOutside=()=>false}) {
  const local=location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)&&['5174','4173','4174'].includes(location.port);
  const windows=/Win/i.test(navigator.userAgentData?.platform??navigator.platform??'');
  const canConnect=windows&&(local||location.origin==='https://apochill.lastweek.chatgpt.site');
  const make=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
  const makeButton=text=>{const el=make('button',text);el.type='button';return el;};
  const panel=make('div',null,'work-status-panel'),button=makeButton('작업 상태 · PC 연결'),hint=make('span');
  button.setAttribute('aria-haspopup','dialog');panel.append(button,hint);document.querySelector('.scene-controls').append(panel);
  const dialog=make('dialog',null,'work-connect-dialog');dialog.setAttribute('aria-labelledby','work-connect-title');
  const header=make('div',null,'work-connect-header'),title=make('h2','캐릭터와 함께 작업하기'),close=makeButton('닫기');title.id='work-connect-title';header.append(title,close);
  const manualSection=make('section'),label=make('label','작업 상태 직접 선택'),select=make('select');label.htmlFor='manual-work-state';select.id='manual-work-state';
  for(const [value,state] of Object.entries(workStates)){const option=make('option',state.label);option.value=value;select.append(option);}
  const manual=makeButton('선택한 상태 사용');manual.className='work-primary';
  const row=make('div',null,'work-manual-row');row.append(select,manual);
  manualSection.append(make('h3','지금 무엇을 하고 있나요?'),make('p','설치 없이 선택하면 캐릭터의 말풍선이 바뀌어요.'),label,row);
  const pcSection=make('section'),steps=make('ol');
  for(const text of ['도우미 ZIP을 내려받고 압축을 풀어 주세요.','Apochill Helper.exe를 더블클릭하세요. 창을 닫아도 작업 표시줄의 숨겨진 아이콘에서 실행돼요.','아래 연결 버튼을 누르고, 브라우저가 이 PC에 연결할 권한을 물으면 허용해 주세요.'])steps.append(make('li',text));
  const download=make('a','Windows 도우미 다운로드 ↓','work-download');download.href=helperDownload;download.download='Apochill-Helper-Windows.zip';
  const connect=makeButton('도우미 실행했어요 · 연결하기');connect.className='work-primary';connect.disabled=!canConnect;
  const stop=makeButton('앱 감지 끄고 직접 선택');stop.hidden=true;
  const actions=make('div',null,'work-connect-actions');actions.append(download,connect,stop);
  const status=make('p',null,'work-connect-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  pcSection.append(make('h3','사용 중인 앱과 자동으로 연결'),make('p',canConnect?'Windows PC에서 사용할 수 있어요. Node.js나 프로젝트 설치는 필요 없어요.':'자동 앱 감지는 Windows PC에서 사용할 수 있어요. 다른 기기에서는 위에서 상태를 선택해 주세요.'),steps,actions,status,
    make('p','허용된 앱의 이름만 이 PC 안에서 전달합니다. 창 제목·문서 내용·키 입력은 읽지 않습니다. 도우미의 ‘종료’로 완전히 끌 수 있어요.','work-connect-note'),
    make('p','배포 파일은 아직 코드 서명이 없어 Windows에서 게시자를 확인할 수 없다는 안내가 나올 수 있어요. 실행을 원하지 않으면 직접 선택으로도 사용할 수 있습니다.','work-connect-note'));
  dialog.append(header,manualSection,pcSection);document.body.append(dialog);
  let manualState='rest';try{const saved=localStorage.getItem('apochill-manual-state');if(Object.hasOwn(workStates,saved))manualState=saved;}catch{}select.value=manualState;
  const bubble=createSpeechBubble(camera,{label:workStates[manualState].phrase}),dogBubble=createSpeechBubble(camera,{className:'dog-status-bubble',label:'월월!!'});dogBubble.setLabel('월월!!','');
  const bark=createBarkCycle(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),controllers=new Set();
  let enabled=false,requested=false,disposed=false,inFlight=false,busy=false,epoch=0,queue=Promise.resolve();
  let phrase=workStates[manualState].phrase,detectedApp='',age=0,mood=0,lastSeconds=null,nextAttempt=0,failures=0;
  function setPhrase(text){if(phrase===text)return;phrase=text;age=0;bubble.setLabel(phrase);}
  function manualPhrase(){detectedApp='';setPhrase(workStates[manualState].phrase);}
  function showStatus(text){status.textContent=text;hint.textContent=text;}
  function refresh(){stop.hidden=!requested;connect.disabled=!canConnect||busy;connect.textContent=busy?'PC 연결 중…':enabled?'다시 연결하기':'도우미 실행했어요 · 연결하기';}
  function showManual(){showStatus('직접 선택 · '+workStates[manualState].label);refresh();}showManual();
  async function request(path,method='GET',permission=false){
    const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),permission?30000:2500);
    try{return await fetch(helper+path,{method,mode:'cors',cache:'no-store',credentials:'omit',targetAddressSpace:'loopback',signal:controller.signal,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});}
    finally{clearTimeout(timer);controllers.delete(controller);}
  }
  // Ordered commands ensure a manual selection during connection stops even a late /start.
  function control(path){const result=queue.then(()=>request(path,'POST',path==='/start'));queue=result.catch(()=>{});return result;}
  async function readStatus(version){
    const response=await request('/status');if(!response.ok)throw Error('Helper unavailable');const data=await response.json();
    if(disposed||!requested||version!==epoch)return;if(data.protocol!==2)throw Error('Update helper');enabled=data.enabled===true;
    const app=enabled&&data.connected&&typeof data.app==='string'?data.app.trim().slice(0,40):'';
    if(app!==detectedApp){detectedApp=app;mood=0;age=0;setPhrase(app?activityPhrase(app,0):workStates[manualState].phrase);}
    if(!enabled){requested=false;manualPhrase();}
    showStatus(enabled?(data.connected?(app?'현재 앱: '+app+' · 실시간 연결':'연결됨 · 지원하는 앱으로 전환해 주세요'):'연결됨 · 활성 앱을 확인하는 중…'):'앱 감지가 꺼졌어요 · 다시 연결하거나 직접 선택해 주세요.');failures=0;nextAttempt=0;refresh();
  }
  function offline(){enabled=false;manualPhrase();showStatus('도우미 연결을 기다리는 중 · 실행 여부와 브라우저 권한을 확인해 주세요. 연결 전에는 선택한 상태를 표시해요.');refresh();}
  async function poll(){
    if(!canConnect||!requested||disposed||busy||inFlight||document.hidden||performance.now()<nextAttempt)return;inFlight=true;const version=epoch;
    try{await readStatus(version);}
    catch{if(!disposed&&requested&&version===epoch){offline();failures++;nextAttempt=performance.now()+Math.min(30000,3000*2**Math.min(4,failures-1));}}
    finally{inFlight=false;}
  }
  async function start(){
    if(!canConnect||busy)return;const version=++epoch;requested=true;busy=true;refresh();showStatus('PC 연결 중 · 권한 요청이 나오면 허용해 주세요.');
    try{const r=await control('/start');if(!r.ok)throw Error('Start failed');await readStatus(version);}
    catch{if(!disposed&&requested&&version===epoch){offline();nextAttempt=performance.now()+5000;}}
    finally{busy=false;if(!disposed)refresh();}
  }
  function useManual(){
    const wasRequested=requested;requested=false;enabled=false;++epoch;manualState=Object.hasOwn(workStates,select.value)?select.value:'rest';
    try{localStorage.setItem('apochill-manual-state',manualState);localStorage.setItem('apochill-app-detection','off');}catch{}manualPhrase();showManual();
    if(wasRequested)void control('/stop').then(r=>{if(!r.ok)throw Error('Stop failed');}).catch(()=>{if(!disposed&&!requested)showStatus('직접 선택 중 · 도우미 중지 확인이 안 되면 도우미에서 종료해 주세요.');});
  }
  const open=()=>{if(!dialog.open)dialog.showModal();},dismiss=()=>{dialog.close();button.focus();};
  const backdrop=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}};
  const onVisible=()=>{if(!document.hidden){nextAttempt=0;void poll();}};
  button.addEventListener('click',open);close.addEventListener('click',dismiss);dialog.addEventListener('click',backdrop);manual.addEventListener('click',useManual);select.addEventListener('change',useManual);stop.addEventListener('click',useManual);connect.addEventListener('click',start);
  document.addEventListener('visibilitychange',onVisible);const interval=setInterval(poll,1500);
  return {
    update(seconds){
      const dt=lastSeconds===null?0:Math.min(.1,Math.max(0,seconds-lastSeconds));lastSeconds=seconds;
      if(document.hidden||document.documentElement.dataset.introActive==='true'){bubble.update(null,'');dogBubble.update(null,'');return;}
      age+=dt;if(detectedApp&&age>=Array.from(phrase).length*.075+2.8){mood=(mood+1)%3;age=0;setPhrase(activityPhrase(detectedApp,mood));}
      const frame=typingFrame(phrase,age,{reduced:reduced.matches});bubble.update(getAnchor(),frame.text+frame.dots,frame.opacity);
      const dogFrame=bark.update(dt,isDogOutside(),reduced.matches);dogBubble.update(dogFrame.visible?getDogAnchor():null,dogFrame.text??'',dogFrame.opacity??0);
    },
    dispose(){disposed=true;clearInterval(interval);for(const c of controllers)c.abort();document.removeEventListener('visibilitychange',onVisible);bubble.dispose();dogBubble.dispose();panel.remove();dialog.remove();},
  };
}
