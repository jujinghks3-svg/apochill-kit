import {passages,beats,storyFrame} from './prologue-story.js';

export function startPrologue(){
  let qualityReload=false;
  try{qualityReload=sessionStorage.getItem('apochill.quality-reload')==='1';sessionStorage.removeItem('apochill.quality-reload');}catch{}
  const root=document.documentElement,overlay=document.querySelector('#prologue');
  const copy=overlay.querySelector('.prologue-copy'),text=document.querySelector('#prologue-text');
  const layout=document.querySelector('#prologue-layout'),accessible=document.querySelector('#prologue-accessible');
  const skip=document.querySelector('#prologue-skip'),wait=document.querySelector('#prologue-wait');
  const recovery=document.querySelector('#prologue-recovery'),counter=document.querySelector('#prologue-count');
  const progress=document.querySelector('#prologue-progress');
  const dock=document.querySelector('.ui-dock'),canvas=document.querySelector('#scene'),loading=document.querySelector('#loading');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let ready=false,finished=false,failed=false,leaving=false,elapsed=0,last=null,index=-1,frame=0,exitTimer=0;
  dock.inert=true;canvas.inert=true;loading.inert=true;
  progress.dataset.state='loading';
  function reveal(){
    if(!finished||!ready||failed||leaving)return;
    leaving=true;cancelAnimationFrame(frame);overlay.dataset.leaving='true';
    exitTimer=setTimeout(()=>{
      const hadFocus=overlay.contains(document.activeElement);
      overlay.hidden=true;root.dataset.introActive='false';dock.inert=false;canvas.inert=false;loading.inert=false;
      if(hadFocus)document.querySelector('.ui-menu-toggle').focus({preventScroll:true});
    },reduced.matches?0:1800);
  }
  function finish(){
    if(finished||failed)return;
    finished=true;cancelAnimationFrame(frame);copy.style.opacity='1';
    layout.textContent=text.textContent='APOCHILL';accessible.textContent='Apochill. 서울의 옥상으로 들어갑니다.';
    counter.textContent='SEOUL';skip.disabled=true;skip.textContent='들어가는 중…';
    reveal();
  }
  function paintStory(){
    const state=storyFrame(elapsed);
    if(state.finished){finish();return;}
    if(index!==state.index){
      index=state.index;layout.textContent=state.text;accessible.textContent=state.text;
      counter.textContent=`${String(index+1).padStart(2,'0')} / 07`;
    }
    text.textContent=reduced.matches?state.text:state.visible;
    copy.style.opacity=reduced.matches?'1':String(state.opacity);
    skip.textContent=index===passages.length-1?'옥상으로 →':'다음 →';
  }
  function nextPassage(){
    if(finished||failed)return;
    const current=storyFrame(elapsed).index;
    if(current>=passages.length-1){finish();return;}
    // Advance exactly one passage, even during typing; never skip the whole intro.
    elapsed=beats[current+1].start;last=null;paintStory();
  }
  function tick(now){
    if(finished||failed)return;
    // Heavy scene preparation or a hidden tab must not skip unread sentences.
    if(last!==null&&!document.hidden)elapsed+=Math.min(100,now-last);
    last=now;
    paintStory();if(!finished)frame=requestAnimationFrame(tick);
  }
  function readingMode(){
    if(finished||failed)return;
    cancelAnimationFrame(frame);overlay.dataset.reading='true';copy.style.opacity='1';
    paintStory();
  }
  function onReady(){ready=true;progress.dataset.state='ready';wait.textContent='준비 완료';reveal();}
  function onFailure(event){
    if(overlay.hidden)return;
    failed=true;cancelAnimationFrame(frame);clearTimeout(exitTimer);delete overlay.dataset.leaving;
    copy.style.opacity='1';layout.textContent=text.textContent='잠시 연결이 멈췄어요.';
    accessible.textContent=text.textContent;wait.textContent=event.detail;wait.hidden=false;progress.dataset.state='failed';recovery.hidden=false;skip.hidden=true;
  }
  const onVisibility=()=>{last=null;};
  const onPreference=()=>{
    if(finished||failed)return;
    if(reduced.matches)readingMode();
    else {delete overlay.dataset.reading;last=null;frame=requestAnimationFrame(tick);}
  };
  skip.addEventListener('click',nextPassage);
  window.addEventListener('apochill-ready',onReady);window.addEventListener('apochill-failed',onFailure);
  document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',onPreference);
  if(qualityReload)finish();else if(reduced.matches)readingMode();else frame=requestAnimationFrame(tick);
  return ()=>{
    cancelAnimationFrame(frame);clearTimeout(exitTimer);skip.removeEventListener('click',nextPassage);
    window.removeEventListener('apochill-ready',onReady);window.removeEventListener('apochill-failed',onFailure);
    document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onPreference);
    dock.inert=false;canvas.inert=false;loading.inert=false;
  };
}
