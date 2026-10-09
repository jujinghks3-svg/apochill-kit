export const FLOOD_LEVEL=-24.15;
// Shared by visible side terrain, its tree roots and the shoreline mask.
export const sideMountainHeight=(x,z,side,layer)=>-29+Math.pow(Math.max(0,Math.cos(x/210*Math.PI)),.7)*
  (46+15*Math.sin(z*.019+layer)+9*Math.cos(z*.043+side))*(side<0?.58:1);
export const namsanHeight=(x,z)=>Math.exp(-(x*x/1750+z*z/1000))*30+Math.sin(x*.12)*Math.cos(z*.14)*2.5;
export function namsanGround(x,z){
  const u=x+82,v=z+198;
  return Math.abs(u)<=56&&Math.abs(v)<=42?-28+namsanHeight(u,v):-28.1;
}
