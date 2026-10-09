// Exact coordinates only. Opposite-facing copies are necessary for single-sided
// meshes, but both rasterize on top of each other with a double-sided material.
export function cleanBuildingGeometry(geometry,{doubleSided=false}={}){
  if(geometry.userData.facadeCleanup&&geometry.userData.facadeCleanup.doubleSided===doubleSided)return geometry.userData.facadeCleanup;
  if(geometry.groups.length>1)return {removed:0};
  const p=geometry.attributes.position,ix=geometry.index,seen=new Set(),indices=[];
  let removed=0;
  for(let i=0;i<(ix?.count??p.count);i+=3){
    const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);
    const v=ids.map(j=>`${p.getX(j)},${p.getY(j)},${p.getZ(j)}`);
    const key=doubleSided?[...v].sort().join('|'):[v.join('|'),[v[1],v[2],v[0]].join('|'),[v[2],v[0],v[1]].join('|')].sort()[0];
    if(seen.has(key)){removed++;continue;}
    seen.add(key);indices.push(...ids);
  }
  if(removed){geometry.setIndex(indices);if(geometry.groups.length)geometry.groups[0].count=indices.length;}
  return geometry.userData.facadeCleanup={removed,doubleSided};
}
