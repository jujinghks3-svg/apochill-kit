import {qualityLevel} from './device-profile.js';
import {QUALITY_KEY,QUALITY_PROFILES} from './quality-profiles.js';

export function setupQuality(){
  const panel=document.createElement('section');panel.className='quality-panel';panel.setAttribute('aria-label','그래픽 품질');
  const heading=document.createElement('strong');heading.textContent='그래픽 품질';
  const options=document.createElement('div');options.className='quality-options';options.setAttribute('role','group');options.setAttribute('aria-label','품질 선택');
  const hint=document.createElement('p');hint.className='quality-hint';hint.setAttribute('role','status');
  hint.textContent=QUALITY_PROFILES[qualityLevel].description;
  const note=document.createElement('small');note.textContent='변경 시 장면을 다시 불러옵니다.';
  for(const profile of Object.values(QUALITY_PROFILES)){
    const button=document.createElement('button');button.type='button';button.textContent=profile.label;
    button.setAttribute('aria-pressed',String(profile.id===qualityLevel));button.title=profile.description;
    button.addEventListener('click',()=>{
      try{localStorage.setItem(QUALITY_KEY,profile.id);}catch{}
      if(profile.id===qualityLevel)return;
      options.querySelectorAll('button').forEach(b=>{b.disabled=true;});hint.textContent=`품질 ${profile.label} 적용 중…`;
      try{sessionStorage.setItem('apochill.quality-reload','1');}catch{}
      const url=new URL(location.href);url.searchParams.set('quality',profile.id);location.replace(url.href);
    });options.append(button);
  }
  panel.append(heading,options,hint,note);document.querySelector('.scene-controls').append(panel);
  return {dispose(){panel.remove();}};
}
