import {daylight,setDaylightHour} from './daylight-state.js';
import {createDayClock,DAY_SECONDS} from './day-clock.js';

export function setupTimeOfDay(lighting){
  const slider=document.querySelector('#time-of-day'),label=document.querySelector('#time-value');
  let saved=12;
  try{const stored=localStorage.getItem('apochill.time-of-day');if(stored!==null&&Number.isFinite(Number(stored)))saved=Number(stored);}catch{}
  const clock=createDayClock(saved,performance.now());
  let lastLabel='',editing=false,lastSave=performance.now();
  function update(hour,immediate=false){
    setDaylightHour(hour);lighting.setTimeOfDay({immediate});
    const minutes=Math.floor(daylight.hour*60)%1440;
    const text=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    if(text===lastLabel&&!immediate)return;
    lastLabel=text;
    slider.value=String(daylight.hour);label.value=text;slider.setAttribute('aria-valuetext',text);
    slider.style.setProperty('--time-progress',`${daylight.hour/24*100}%`);
    document.documentElement.dataset.timeOfDay=text;
    document.documentElement.dataset.sunDirection=daylight.hour===12?'concept-upper-right-62-82-minus32':'interactive-day-night-cycle';
  }
  const input=()=>{clock.seek(Number(slider.value),performance.now());update(clock.sample(performance.now()),true);};
  const save=()=>{try{localStorage.setItem('apochill.time-of-day',String(clock.sample(performance.now())));}catch{}};
  const begin=()=>{if(!editing){editing=true;clock.pause(performance.now());}};
  const end=()=>{if(editing){editing=false;clock.resume(performance.now());save();}};
  const keys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown']);
  const keydown=e=>{if(keys.has(e.key))begin();};
  const keyup=e=>{if(keys.has(e.key))end();};
  const hidden=()=>{if(document.hidden){end();save();}};
  update(clock.sample(performance.now()),true);slider.disabled=false;
  document.documentElement.dataset.dayDurationSeconds=String(DAY_SECONDS);
  slider.addEventListener('input',input);slider.addEventListener('change',save);
  slider.addEventListener('pointerdown',begin);slider.addEventListener('keydown',keydown);slider.addEventListener('keyup',keyup);slider.addEventListener('blur',end);
  window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);window.addEventListener('blur',end);
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',save);
  return {
    update(time){update(clock.sample(time));if(time-lastSave>30000){save();lastSave=time;}},
    dispose(){
      save();slider.disabled=true;
      slider.removeEventListener('input',input);slider.removeEventListener('change',save);
      slider.removeEventListener('pointerdown',begin);slider.removeEventListener('keydown',keydown);slider.removeEventListener('keyup',keyup);slider.removeEventListener('blur',end);
      window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);window.removeEventListener('blur',end);
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',save);
    },
  };
}
