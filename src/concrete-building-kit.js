import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {weatherMaterial} from './surface-weathering.js';
import {createVerticalFacadeLod} from './vertical-facade-lod.js';

// Punched-window buildings: opaque piers/lintels, recessed rooms and genuinely
// open broken windows. Both LODs share their openings and growth sockets.
export function createConcreteKit(){
  const catalog=new Map();
  const wall=weatherMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94}),{strength:.7});
  wall.name='aged-plaster-concrete';
  const glass=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.54,metalness:.1});glass.name='recessed-residential-windows';
  for(let variant=0;variant<13;variant++){
    const levels=[];
    for(const detailed of [true,false]){
      const root=new THREE.Group(),solid=[],panes=[],sockets=[];
      const vertical=variant>=9,v=variant-9;
      const finish=vertical?[1,2,1,2][v]:variant%3,shape=vertical?[0,1,0,1][v]:Math.floor(variant/3);
      const floors=[8,13,18,10,17,12,8,12,16,8,16,22,12][variant],w=vertical?[12,16,8.8,13][v]:shape===1?16:shape===2?13:10,d=vertical?[11,7,8.8,7.8][v]:shape===1?6:shape===2?12:10,fh=2.8,h=floors*fh;
      const base=['#a36e59','#dad9cb','#a4ada7'][finish],trim=['#c1a18a','#aaaFA6','#7c8c84'][finish];
      if(vertical&&!detailed){
        levels.push(createVerticalFacadeLod({variant,w,d,h,floors,base}));
        continue;
      }
      const outline=shape===2?[[-w/2,-d/2],[w/2,-d/2],[w/2,-1],[-1,-1],[-1,d/2],[-w/2,d/2]]:[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
      const add=(g,color,target=solid)=>{
        if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
        const c=new THREE.Color(color),a=new Float32Array(g.attributes.position.count*3);
        for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
        g.setAttribute('color',new THREE.BufferAttribute(a,3));target.push(g);
      };
      const box=(x,y,z,sx,sy,sz,c=base)=>add(new THREE.BoxGeometry(sx,sy,sz).translate(x,y,z),c);
      // Floor plates remain visible through the missing glazing, with a dark
      // setback core rather than black quads on top of an unbroken wall.
      if(shape===2){
        box((-w/2-1)/2,h/2,0,w/2-2.8,h,d-1.8,'#58635e');
        box((w/2-1)/2,h/2,(-d/2-1)/2,w/2- .8,h,d/2-2.8,'#58635e');
      }else box(0,h/2,0,w-1.8,h,d-1.8,'#58635e');
      // Recess slab edges 6 cm behind the facade. Full-width extrusions used
      // to share the wall plane with every sill/pier, causing depth flicker.
      // Offset both adjacent edges, including the concave corner of L plans.
      const slabOutline=outline.map(([x,z],i)=>{
        const prev=outline[(i+outline.length-1)%outline.length],next=outline[(i+1)%outline.length];
        const a=new THREE.Vector2(x-prev[0],z-prev[1]).normalize(),b=new THREE.Vector2(next[0]-x,next[1]-z).normalize();
        return [x-(a.y+b.y)*.06,z+(a.x+b.x)*.06];
      });
      const slabShape=new THREE.Shape(slabOutline.map(([x,z])=>new THREE.Vector2(x,-z)));
      for(let f=0;f<=floors;f++){
        const slab=new THREE.ExtrudeGeometry(slabShape,{depth:.16,bevelEnabled:false,curveSegments:1});
        slab.rotateX(-Math.PI/2).translate(0,f*fh-.08,0);add(slab,base);
      }
      for(let face=0;face<outline.length;face++){
        const a=outline[face],b=outline[(face+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],span=Math.hypot(dx,dz);
        const tangent=new THREE.Vector3(dx/span,0,dz/span),normal=new THREE.Vector3(dz/span,0,-dx/span);
        const horizontal=Math.abs(dx)>0,yaw=Math.atan2(normal.x,normal.z);
        const position=(along,y,offset=0)=>[(a[0]+b[0])/2+tangent.x*along+normal.x*offset,y,(a[1]+b[1])/2+tangent.z*along+normal.z*offset];
        const panel=(along,y,pw,ph,c,offset=0,target=solid)=>{
          const g=new THREE.PlaneGeometry(pw,ph).rotateY(yaw).translate(...position(along,y,offset));add(g,c,target);
        };
        const columns=Math.max(2,Math.round(span/(vertical?[1.7,1.3,1.15,1.9][v]:finish===2?1.38:1.65))),bay=span/columns,win=bay*(vertical?[.62,.53,.70,.60][v]:finish===1?.64:.59),wh=vertical?2.46:finish===2?1.72:1.55;
        // Corners are authored once below, rather than two crossing rib boxes.
        if(vertical)for(let col=1;col<columns;col++){
          const along=-span/2+col*bay;
          if(detailed){const p=position(along,h/2,.055);box(...p,horizontal?.095:.19,h,horizontal?.19:.095,base);}
          else panel(along,h/2,.095,h,base,.055);
        }
        for(let f=0;f<floors;f++){
          const y=f*fh,bottom=vertical?.16:.76,top=fh-bottom-wh;
          if(!vertical){
            panel(0,y+bottom/2,span,bottom,base);
            panel(0,y+fh-top/2,span,top,base);
            if(finish!==1||f%3===0)panel(0,y+.10,span,.12,trim,.015);
          }
          if(finish===0&&detailed)for(const sy of [.32,.54])panel(0,y+sy,span,.018,'#866658',.008);
          for(let col=0;col<=columns;col++){
            const boundary=-span/2+col*bay;
            const pw=(bay-win)*(col===0||col===columns?.5:1);
            const a=boundary+(col===0?pw/2:col===columns?-pw/2:0);
            panel(a,vertical?y+fh/2:y+bottom+wh/2,pw,vertical?fh:wh,base);
          }
          for(let col=0;col<columns;col++){
            const a=-span/2+(col+.5)*bay,py=y+bottom+wh/2;
            if(vertical){
              panel(a,y+bottom/2,win,bottom,'#617875',-.12);
              panel(a,y+fh-top/2,win,top,'#617875',-.12);
            }
            const broken=f>1&&(f*13+col*7+face*5+variant*3)%17===0;
            if(broken)sockets.push({position:position(a,y+bottom+.025,-.13),normal:normal.toArray(),openingWidth:win,openingHeight:wh});
            else panel(a,py,win,wh,['#667c79','#82928b','#768c8a','#94a19a'][(f*3+col+face)%4],-.14,panes);
            if(detailed){
              // Four inward reveals close the wall thickness, not the opening.
              for(const side of [-1,1]){
                const g=new THREE.PlaneGeometry(.16,wh).rotateY(yaw+side*Math.PI/2);
                g.translate(...position(a+side*win/2,py,-.08));add(g,'#929a8e');
              }
              for(const side of [-1,1]){
                const g=new THREE.PlaneGeometry(win,.16).rotateX(side*Math.PI/2).rotateY(yaw);
                g.translate(...position(a,py+side*wh/2,-.08));add(g,'#a6ab9c');
              }
              if(!broken)panel(a,py,vertical?.023:.035,wh,'#adb5a9',-.105);
            }
            // Scattered shallow balconies/AC brackets break the residential grid.
            if(!vertical&&finish===1&&col%3===1&&f%3===1){
              const p=position(a,y+.65,.25);
              box(...p,horizontal?win+.22:.58,.12,horizontal?.58:win+.22,'#a4aa9c');
              if(detailed)panel(a,y+.92,win+.18,.08,'#6e7e73',.51);
            }
          }
        }
        panel(0,h+.28,span,.56,base,.015);
      }
      // Broad square office roofs reserve a clear deck for a landing pad.
      if(variant!==2&&!vertical){
        box(-w*.29,h+.68,-d*.28,2.0,1.25,2.0,trim);
        box(-w*.28,h+.27,d*.23,1.0,.43,1.3,'#7d8b80');
      }
      if(vertical||finish===2&&shape!==2)for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box(x,h/2,z,.18,h,.18,vertical?base:'#bfc1ae');
      for(const [pieces,material] of [[solid,wall],[panes,glass]]){
        const mesh=new THREE.Mesh(mergeGeometries(pieces),material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);pieces.forEach(g=>g.dispose());
      }
      root.name=`kit-concrete-${variant}`;root.userData.treeSockets=sockets;
      root.userData.shoreOutline=outline;
      root.userData.facadeStyle=vertical?'vertical-ribbons':'punched-windows';
      root.userData.helipadDeck=variant===2||vertical&&shape===0;
      root.userData.buildingShape=['square','slab','L'][shape];root.userData.buildingFinish=['red-masonry','white-plaster','exposed-concrete'][finish];
      root.userData.roofZones=shape===2?[{x:(-w/2-1)/2,z:0,w:w/2-1,d,y:h+.08},{x:(w/2-1)/2,z:(-d/2-1)/2,w:w/2+1,d:d/2-1,y:h+.08}]:[{x:0,z:0,w,d,y:h+.08}];
      levels.push(root);
    }
    catalog.set(`kit-concrete-${variant}`,[levels[0],levels[0],levels[1],levels[1]]);
  }
  return catalog;
}
