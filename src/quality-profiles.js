export const QUALITY_KEY='apochill.quality';
export const QUALITY_PROFILES=Object.freeze({
  high:Object.freeze({id:'high',label:'상',pixels:2073600,dpr:1.5,cascades:3,shadowSize:2048,shadowFar:340,shadowHz:12,reflectionHz:15,reflectionSize:1024,cityReduced:false,growthDensity:1,vineDistance:Infinity,rainCount:1600,description:'풍부한 반사 · 그림자 · 대기 효과'}),
  medium:Object.freeze({id:'medium',label:'중',pixels:1296000,dpr:1,cascades:2,shadowSize:1024,shadowFar:230,shadowHz:8,reflectionHz:8,reflectionSize:512,cityReduced:true,growthDensity:.7,vineDistance:180,rainCount:1000,description:'반사와 블룸 유지 · 균형 잡힌 품질'}),
  low:Object.freeze({id:'low',label:'하',pixels:640000,dpr:1,cascades:1,shadowSize:1024,shadowFar:120,shadowHz:6,reflectionHz:0,reflectionSize:0,cityReduced:true,growthDensity:.45,vineDistance:125,rainCount:650,description:'가벼운 빛 효과 · 실행 성능 우선'}),
});
export function normalizeQuality(value){
  if(value==='desktop')return 'high';
  if(value==='mobile')return 'low';
  return Object.hasOwn(QUALITY_PROFILES,value)?value:null;
}
export function resolveQuality(requested,saved,isMobile=false){
  return normalizeQuality(requested)??normalizeQuality(saved)??'high';
}
