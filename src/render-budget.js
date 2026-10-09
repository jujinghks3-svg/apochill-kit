// Cap offscreen buffer area as well as DPR: a 4K/Retina window must not
// allocate full-resolution HDR, AO, bloom and fog targets at twice its size.
export function boundedPixelRatio(width,height,deviceRatio=1,mobile=false){
  const area=Math.max(1,width)*Math.max(1,height);
  const profile=typeof mobile==='object'?mobile:null;
  const budget=profile?.pixels??(mobile?900000:2073600);
  return Math.min(Math.max(.1,deviceRatio||1),profile?.dpr??(mobile?1:1.5),Math.sqrt(budget/area));
}
