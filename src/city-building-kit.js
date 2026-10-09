import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createGlassBuildingKit} from './glass-building-kit.js';
import {createConcreteKit} from './concrete-building-kit.js';
import {weatherMaterial} from './surface-weathering.js';

// Local authored kits complement the existing Tripo buildings. Open ruins have
// actual missing floors/walls and exposed reinforcement, rather than dark decals.
export function createBuildingKit(){
  const catalog=new Map();
  const concrete=weatherMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}),{strength:.8});
  concrete.name='kit-aged-concrete';
  for(const type of ['skeleton'])for(let variant=0;variant<3;variant++){
    const group=new THREE.Group(),solid=[];
    group.userData.treeSockets=[];
    const floors=[6,10,15][variant],w=11,d=9;
    const add=(geometry,color,target=solid)=>{
      const g=geometry.index?geometry.toNonIndexed():geometry;
      const c=new THREE.Color(color),colors=[];
      for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);
      g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));target.push(g);
      if(g!==geometry)geometry.dispose();
    };
    const box=(x,y,z,sx,sy,sz,color,target)=>add(new THREE.BoxGeometry(sx,sy,sz).translate(x,y,z),color,target);
    const bar=(a,b,r=.045)=>{
      const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),4);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,'#725641');
    };
    {
      for(let f=0;f<floors;f++){
        const y=f*3.15,loss=f>floors*.65;
        if(f>1&&f%2===0)group.userData.treeSockets.push({position:[-2.1,y+.27,4.32],normal:[0,0,1],openingWidth:2.2,openingHeight:2.8});
        // Fractured L-shaped slabs become progressively smaller near the crown.
        const cut=loss?2+(f%3)*.8:.8;
        const shape=new THREE.Shape();
        shape.moveTo(-w/2,-d/2);shape.lineTo(w/2,-d/2);shape.lineTo(w/2,d/2-cut);
        shape.lineTo(w/2-cut*.6,d/2-cut-.3);shape.lineTo(w/2-cut,d/2);shape.lineTo(-w/2,d/2);shape.closePath();
        const slab=new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false});slab.rotateX(-Math.PI/2);slab.translate(0,y,0);add(slab,'#abb2a3');
        for(const x of [-4.4,0,4.4])for(const z of [-3.8,3.8]){
          const broken=loss&&x>0&&z>0;
          if(!broken)box(x,y+1.56,z,.40,2.87,.40,'#8b978d');
          for(let r=0;r<(broken?3:0);r++)bar(new THREE.Vector3(x+(r-1)*.12,y+.26,z),new THREE.Vector3(x+(r-1)*.15-.14,y+1.6+r*.21,z+.12));
        }
        // Surviving side infill and lintels frame the black, open interior.
        if(f%3!==1)box(-5.28,y+1.02,-1.7,.3,1.65,4.3,'#aeb4a3');
        if(f%4<2)box(-2,y+1.12,-4.24,4.7,2.0,.28,'#b6b8aa');
        if(loss)for(let r=0;r<4;r++)bar(new THREE.Vector3(3-r*.7,y+.28,3.2),new THREE.Vector3(3-r*.7+.23,y+.9+r*.23,3.35));
      }
      // Broken stair core and a narrow diagonal brace interrupt the floor grid.
      box(-2,floors*1.2,-1,2.6,floors*2.4,2.8,'#737f78');
      for(let f=0;f<Math.min(5,floors);f++)bar(new THREE.Vector3(-4.3,f*3.15,3.8),new THREE.Vector3(0,(f+1)*3.15,3.8),.075);
    }
    for(const [pieces,material] of [[solid,concrete]]){
      if(!pieces.length)continue;
      const mesh=new THREE.Mesh(mergeGeometries(pieces),material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);pieces.forEach(g=>g.dispose());
    }
    const id=`kit-${type}-${variant}`;group.name=id;catalog.set(id,[group,group,group,group]);
  }
  for(const [id,levels] of createGlassBuildingKit())catalog.set(id,levels);
  for(const [id,levels] of createConcreteKit())catalog.set(id,levels);
  return catalog;
}
