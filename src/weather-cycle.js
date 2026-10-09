export const WEATHER_STEP_SECONDS=105;
export const WEATHER_STATES=[
  {id:'sunny',label:'맑음',rain:0,clouds:.16,shade:0},
  {id:'cloudy',label:'구름 많음',rain:0,clouds:.78,shade:.48},
  {id:'drizzle',label:'비 조금',rain:.25,clouds:.88,shade:.65},
  {id:'storm',label:'폭우',rain:1,clouds:1,shade:1},
];
export function createWeatherCycle(){
  let mode='auto',epoch=0;
  const sample=seconds=>{
    // Tiny tolerance keeps a resumed cycle on the correct exact boundary.
    const step=(Math.max(0,seconds-epoch)+1e-9)/WEATHER_STEP_SECONDS;
    const index=mode==='auto'?Math.floor(step)%WEATHER_STATES.length:WEATHER_STATES.findIndex(s=>s.id===mode);
    return {mode,...WEATHER_STATES[index],progress:mode==='auto'?step%1:0};
  };
  return {sample,select(id,seconds){
    if(id==='auto'){
      if(mode!=='auto')epoch=seconds-WEATHER_STATES.findIndex(s=>s.id===mode)*WEATHER_STEP_SECONDS;
      mode='auto';
    }else if(WEATHER_STATES.some(s=>s.id===id))mode=id;
  }};
}
