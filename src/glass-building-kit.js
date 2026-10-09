import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {glassWeathering} from './glass-weathering.js';
import {weatherMaterial} from './surface-weathering.js';
import {createGlassRoofFactory} from './glass-roof-services.js';

// A single depth surface per wall: mullions are filtered colour, never stacks of
// projecting slabs casting stair-step shadows across the curtain wall.
export function curtainWallTexture(variant=0){
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*4,v=y/size*4,a=u%1,b=v%1;
    const vertical=a<.055||a>.945,horizontal=b<.045||b>.955;
    const room=(Math.floor(u)*13+Math.floor(v)*7+variant*3)%5;
    const reflection=Math.sin(u*1.4+v*.32)*3+Math.cos(v*.9)*2;
    let rgb=vertical?[191,205,198]:horizontal?[178,194,191]:
      [117+room*3+reflection,156+room*2+reflection,166+room*2+reflection];
    // Narrow restrained spandrel; no near-black interiors or diagonal cracks.
    if(!vertical&&!horizontal&&b<.17)rgb=[126,153,155];
    data.set([...rgb.map(Math.round),255],(y*size+x)*4);
  }
  const map=new T.DataTexture(data,size,size);map.name=`silver-curtain-wall-${variant}`;
  map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;
  map.magFilter=T.LinearFilter;map.anisotropy=4;map.needsUpdate=true;
  return map;
}

export function createGlassBuildingKit(){
  const catalog=new Map();
  const services=createGlassRoofFactory();
  for(let variant=0;variant<3;variant++){
    const root=new T.Group(),walls=[],solids=[],height=[22.4,38.4,54.4][variant];
    const glass=new T.MeshStandardMaterial({map:curtainWallTexture(variant),roughness:.22,metalness:.42});
    glass.userData.glassFacade='masked';
    glassWeathering(glass);
    glass.name=`silver-continuous-glass-${variant}`;
    const stone=weatherMaterial(new T.MeshStandardMaterial({color:'#bcc6b9',roughness:.84}),{strength:.7,scale:.7});stone.name=`silver-office-trim-${variant}`;
    const box=(x,y,z,w,h,d)=>solids.push(new T.BoxGeometry(w,h,d).translate(x,y,z));
    function tier(w,d,bottom,top,bevel){
      const x=w/2,z=d/2,c=bevel;
      const outline=[[-x+c,-z],[x-c,-z],[x,-z+c],[x,z-c],[x-c,z],[-x+c,z],[-x,z-c],[-x,-z+c]];
      for(let i=0;i<outline.length;i++){
        const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);
        const g=new T.PlaneGeometry(span,top-bottom),uv=g.attributes.uv;
        for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*span/4.0,uv.getY(k)*(top-bottom)/10.6);
        g.rotateY(Math.atan2(dz/span,-dx/span)).translate((a[0]+b[0])/2,(bottom+top)/2,(a[1]+b[1])/2);walls.push(g);
      }
      const shape=new T.Shape(outline.map(p=>new T.Vector2(...p)));
      // Roof lies inside the wall edge; no full-height service core pokes through.
      const roof=new T.ShapeGeometry(shape);roof.rotateX(-Math.PI/2).translate(0,top+.012,0);solids.push(roof);
      return outline;
    }
    const podium=5.3;
    const outline=tier(11.5,9.6,0,podium,.55);
    tier(10,9,podium,height,.65);
    for(const [parts,material] of [[walls,glass],[solids,stone]]){
      const mesh=new T.Mesh(mergeGeometries(parts),material);mesh.castShadow=mesh.receiveShadow=true;
      root.add(mesh);parts.forEach(g=>g.dispose());
    }
    root.name=`kit-glass-${variant}`;
    root.userData={treeSockets:[],shoreOutline:outline,facadeStyle:'continuous-silver-curtain-wall',roofZones:[{x:0,z:0,w:10,d:9,y:height+.012}]};
    const far=root.clone(true);
    root.add(services.build(variant,height+.025));
    far.add(services.build(variant,height+.025,{distant:true}));
    catalog.set(root.name,[root,root,far,far]);
  }
  services.disposeTemplates();
  return catalog;
}
