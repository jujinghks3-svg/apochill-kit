import * as THREE from 'three';

const cache=new WeakMap();
// Axis-facing facade queries use a 2D triangle grid. This projects every leaf
// ribbon vertex without raycasting the complete building for every vertex.
export function ivySurfaceProjector(surface,normal){
  if(!cache.has(surface))cache.set(surface,new Map());
  const key=normal.toArray().join(','),cached=cache.get(surface);
  if(cached.has(key))return cached.get(key);
  const along=normal.z!==0?'x':'z',depth=normal.z!==0?'z':'x',sign=normal[depth],cell=1.25,buckets=new Map();
  const roots=Array.isArray(surface)?surface:[surface];
  for(const root of roots){
    root.updateWorldMatrix(true,true);
    root.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh)return;
      const p=mesh.geometry.attributes.position,indices=mesh.geometry.index;
      for(let i=0;i<(indices?.count??p.count);i+=3){
        const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,indices?indices.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
        const n=new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).normalize();
        if(n.dot(normal)<.32)continue;
        const [a,b,c]=v,den=(b.y-c.y)*(a[along]-c[along])+(c[along]-b[along])*(a.y-c.y);
        if(Math.abs(den)<1e-9)continue;
        const triangle={v,n,den};
        const minU=Math.floor(Math.min(...v.map(p=>p[along]))/cell),maxU=Math.floor(Math.max(...v.map(p=>p[along]))/cell);
        const minV=Math.floor(Math.min(...v.map(p=>p.y))/cell),maxV=Math.floor(Math.max(...v.map(p=>p.y))/cell);
        for(let u=minU;u<=maxU;u++)for(let y=minV;y<=maxV;y++){
          const k=`${u}:${y}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(triangle);
        }
      }
    });
  }
  const project=(point,offset=.018)=>{
    let best=null,bestDepth=-Infinity;
    for(const {v:[a,b,c],n,den} of buckets.get(`${Math.floor(point[along]/cell)}:${Math.floor(point.y/cell)}`)??[]){
      const u=((b.y-c.y)*(point[along]-c[along])+(c[along]-b[along])*(point.y-c.y))/den;
      const v=((c.y-a.y)*(point[along]-c[along])+(a[along]-c[along])*(point.y-c.y))/den;
      if(u<-.00001||v<-.00001||u+v>1.00001)continue;
      const d=a[depth]*u+b[depth]*v+c[depth]*(1-u-v);
      if(d*sign>bestDepth){bestDepth=d*sign;best={d,n};}
    }
    if(!best)return null;
    const p=point.clone();p[depth]=best.d;return p.addScaledVector(best.n,offset);
  };
  cached.set(key,project);return project;
}
