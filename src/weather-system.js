import * as THREE from 'three';
import {daylight,dayUniforms} from './daylight-state.js';
import {createWeatherCycle,WEATHER_STATES,WEATHER_STEP_SECONDS} from './weather-cycle.js';
import {pixelIcon} from './pixel-icons.js';
import {stepWetness} from './wet-surface-state.js';

export function setupWeather(scene,lighting){
  const panel=document.createElement('section');panel.className='weather-panel';panel.setAttribute('aria-label','날씨');
  panel.innerHTML=`<div class="weather-heading"><output aria-live="polite">맑음</output>
    <button class="weather-auto" type="button" aria-label="날씨 자동 순환" aria-pressed="true" title="105초마다 다음 날씨로 자동 전환">${pixelIcon('auto')}<span>자동</span></button></div>
    <div class="weather-options" role="group" aria-label="날씨 선택">${WEATHER_STATES.map(s=>`<button type="button" class="weather-option" data-weather="${s.id}" aria-label="${s.label}" aria-pressed="false" title="${s.label} 유지">${pixelIcon(s.id)}<span>${s.label}</span><i aria-hidden="true"></i></button>`).join('')}</div>
    <div class="weather-hint">자동 순환 · 1분 45초씩</div>`;
  document.querySelector('.scene-controls').append(panel);
  const status=panel.querySelector('output'),auto=panel.querySelector('.weather-auto'),hint=panel.querySelector('.weather-hint');
  const buttons=[...panel.querySelectorAll('[data-weather]')],cycle=createWeatherCycle();
  // Start automatically even if an earlier version saved a manual weather mode.
  let seconds=0,amount=0,clouds=WEATHER_STATES[0].clouds,shade=0,lastUi='';
  const surface={wetness:0,puddles:0};
  dayUniforms.dayWetness.value=dayUniforms.dayPuddleFill.value=0;
  function updateUi(target){
    const key=`${target.mode}:${target.id}`;
    if(key!==lastUi){
      lastUi=key;status.value=target.label;auto.setAttribute('aria-pressed',String(target.mode==='auto'));
      hint.textContent=target.mode==='auto'?`자동 순환 · ${Math.floor(WEATHER_STEP_SECONDS/60)}분 ${WEATHER_STEP_SECONDS%60}초씩`:'선택한 날씨 유지 · 자동으로 재개';
      buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weather===target.id)));
    }
    panel.style.setProperty('--weather-progress',`${target.progress*100}%`);
  }
  const choose=event=>{cycle.select(event.currentTarget.dataset.weather,seconds);updateUi(cycle.sample(seconds));};
  const resume=()=>{cycle.select('auto',seconds);updateUi(cycle.sample(seconds));};
  buttons.forEach(b=>b.addEventListener('click',choose));auto.addEventListener('click',resume);updateUi(cycle.sample(0));
  const fogDensity=scene.fog.density,gray=new THREE.Color('#a0afb4'),overcast=new THREE.Color('#73878e'),temp=new THREE.Color();
  return {
    update(time,dt){
      seconds=time;const target=cycle.sample(seconds),delta=Math.max(0,Math.min(dt,1));
      amount=THREE.MathUtils.damp(amount,target.rain,.65,delta);
      clouds=THREE.MathUtils.damp(clouds,target.clouds,.40,delta);
      shade=THREE.MathUtils.damp(shade,target.shade,.40,delta);
      // setupTimeOfDay restores base light/colour values immediately beforehand.
      dayUniforms.dayWeatherRain.value=amount;dayUniforms.dayCloudCoverage.value=clouds;
      stepWetness(surface,amount,delta);
      dayUniforms.dayWetness.value=surface.wetness;dayUniforms.dayPuddleFill.value=surface.puddles;
      dayUniforms.daySunStrength.value*=1-shade*.91;
      daylight.intensity*=1-shade*.77;daylight.hemisphere*=1+shade*.20;
      daylight.sunColor.lerp(gray,shade*.7);daylight.skyLight.lerp(gray,shade*.75);
      daylight.fog.lerp(temp.copy(overcast).multiply(dayUniforms.daySurfaceTint.value),shade*.6);
      dayUniforms.daySkyTop.value.lerp(dayUniforms.dayCloudDark.value,shade*.85);
      dayUniforms.dayCloudLight.value.multiplyScalar(1-shade*.46);
      dayUniforms.dayCloudDark.value.multiplyScalar(1-shade*.43);
      for(const key of ['daySkyTop','dayCloudLight','dayCloudDark']){
        const c=dayUniforms[key].value,luma=c.r*.2126+c.g*.7152+c.b*.0722;
        c.lerp(temp.setRGB(luma*.94,luma,luma*1.04),shade*.8);
      }
      dayUniforms.daySurfaceTint.value.multiplyScalar(1-shade*.18);
      scene.fog.density=fogDensity+shade*.0004+amount*.001;
      lighting.setTimeOfDay({immediate:false});updateUi(target);
      const data=document.documentElement.dataset;
      data.weather=target.mode;data.weatherState=target.id;data.rainAmount=amount.toFixed(3);data.cloudAmount=clouds.toFixed(3);
      data.surfaceWetness=surface.wetness.toFixed(3);data.puddleFill=surface.puddles.toFixed(3);
      return amount;
    },
    dispose(){buttons.forEach(b=>b.removeEventListener('click',choose));auto.removeEventListener('click',resume);panel.remove();scene.fog.density=fogDensity;}
  };
}
