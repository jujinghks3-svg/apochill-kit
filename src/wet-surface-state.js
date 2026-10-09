// Integrate rainfall rather than snapping materials to the weather UI selection.
// Surface water responds quickly; shallow pools accumulate and dry more slowly.
export function stepWetness(state,rain,dt){
  const delta=Number.isFinite(dt)?Math.max(0,Math.min(dt,1)):0;
  const amount=Number.isFinite(rain)?Math.max(0,Math.min(rain,1)):0;
  const damp=(a,b,rate)=>a+(b-a)*(1-Math.exp(-rate*delta));
  const target=Math.min(1,amount*2.8);
  state.wetness=damp(state.wetness,target,target>state.wetness?.16:.018);
  const poolTarget=Math.min(1,amount*1.65);
  state.puddles=damp(state.puddles,poolTarget,poolTarget>state.puddles?.045:.008);
  return state;
}
