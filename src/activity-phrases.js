const particles={Notion:'으로',ChatGPT:'로',Codex:'로','Unreal Engine':'으로',Blender:'로',Photoshop:'으로',CapCut:'으로','VS Code':'로',Chrome:'으로',Edge:'로',Firefox:'로',Figma:'로'};
export const activityMoods=['작업하는 중','구상하는 중','달리는 중'];
export function activityPhrase(app,index=0){
  const label=typeof app==='string'?app.trim().slice(0,40):'';
  if(!label)return '옥상에서 잠시 쉬는 중';
  return `${label}${particles[label]??'에서'} ${activityMoods[index%activityMoods.length]}`;
}
