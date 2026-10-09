import * as THREE from 'three';
import {CONCEPT,conceptGLSL} from './concept-palette.js';
import {softFoliageGLSL} from './soft-foliage-lighting.js';
import {dayUniforms} from './daylight-state.js';
import {bindFoliageWind} from './foliage-wind.js';

// Applied identically to colour and AO/depth so silhouettes never separate.
export function patchTreeBillboard(shader){
  bindFoliageWind(shader);
  shader.vertexShader='attribute vec3 terrainTint; attribute float terrainBlend; varying vec3 treeTerrainTint; varying float treeTerrainBlend; attribute float treeVariant; varying vec2 treeSpriteUv; varying float treeAerial;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    treeTerrainTint=terrainTint;treeTerrainBlend=terrainBlend;
    treeSpriteUv=vec2((uv.x+treeVariant)*.25,uv.y);
    vec3 treeCenter=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    treeAerial=smoothstep(220.,620.,distance(cameraPosition,treeCenter))*.27;
    vec3 treeRight=normalize(vec3(cameraPosition.z-treeCenter.z,0.,treeCenter.x-cameraPosition.x));
    vec3 treeWorld=treeCenter+treeRight*position.x*length(instanceMatrix[0].xyz)
      +vec3(0.,position.y*length(instanceMatrix[1].xyz),0.);
    // Signed linear weight pins the painted root even on a two-triangle card.
    // The tiny negative strip is transparent below the root in the atlas.
    float treeWindRoot=(uv.y-12./384.)/(1.-12./384.);
    float treeWind=foliageGust(treeCenter)*min(.12,length(instanceMatrix[1].xyz)*.012)
      *treeWindRoot*(1.+.35*clamp(foliageWindRain,0.,1.));
    treeWorld+=vec3(1.,0.,.30)*treeWind;`);
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
    vec4 mvPosition=viewMatrix*vec4(treeWorld,1.);
    gl_Position=projectionMatrix*mvPosition;`);
  shader.fragmentShader='varying vec3 treeTerrainTint; varying float treeTerrainBlend; varying vec2 treeSpriteUv; varying float treeAerial;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    vec4 sampledDiffuseColor=texture2D(map,treeSpriteUv);
    diffuseColor*=sampledDiffuseColor;
    diffuseColor.rgb=mix(diffuseColor.rgb,${conceptGLSL(CONCEPT.distant[1])},treeAerial);`);
}

let treeMaterial;
function material(){
  if(treeMaterial)return treeMaterial;
  const map=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/tree-billboard-atlas.png`,
    ()=>{document.documentElement.dataset.treeBillboardTexture='loaded';},undefined,
    error=>{document.documentElement.dataset.treeBillboardTexture='error';console.error('[Apochill] Tree atlas failed',error);});
  map.colorSpace=THREE.SRGBColorSpace;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
  const normalReady={value:0};
  const normalMap=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/tree-billboard-normals.png`,
    ()=>{normalReady.value=1;document.documentElement.dataset.treeBillboardNormals='loaded';},undefined,
    error=>{document.documentElement.dataset.treeBillboardNormals='error';console.error('[Apochill] Tree normals failed',error);});
  normalMap.colorSpace=THREE.NoColorSpace;
  normalMap.minFilter=THREE.LinearMipmapLinearFilter;normalMap.magFilter=THREE.LinearFilter;
  treeMaterial=new THREE.MeshBasicMaterial({map,color:'#ffffff',alphaTest:.32,side:THREE.DoubleSide,fog:true});
  treeMaterial.name='soft-lit-tree-billboards';treeMaterial.userData.softFoliage=true;
  treeMaterial.userData.billboard=patchTreeBillboard;
  treeMaterial.userData.normalAtlas=normalMap;
  treeMaterial.addEventListener('dispose',()=>normalMap.dispose());
  treeMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,dayUniforms);
    shader.uniforms.treeNormalAtlas={value:normalMap};shader.uniforms.treeNormalReady=normalReady;
    patchTreeBillboard(shader);
    shader.vertexShader='attribute float crownRelief; varying float treeRelief; varying vec3 treeLightPosition; varying vec3 treeLightRight; varying vec2 treeLocalUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
      treeLightPosition=treeWorld;treeLightRight=treeRight;treeLocalUv=uv;treeRelief=crownRelief;
    `);
    shader.fragmentShader='uniform sampler2D treeNormalAtlas; uniform float treeNormalReady; varying float treeRelief; varying vec3 treeLightPosition; varying vec3 treeLightRight; varying vec2 treeLocalUv;\n'+softFoliageGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 crownXY=vec2((treeLocalUv.x-.5)*1.85,(treeLocalUv.y-.58)*1.8);
      vec3 treeForward=normalize(cross(treeLightRight,vec3(0.,1.,0.)));
      vec3 crownNormal=normalize(treeLightRight*crownXY.x+vec3(0.,crownXY.y+.35,0.)
        +treeForward*sqrt(max(.08,1.-dot(crownXY,crownXY))));
      vec3 lobeTangent=texture2D(treeNormalAtlas,treeSpriteUv).xyz*2.-1.;
      lobeTangent=normalize(vec3(lobeTangent.xy,max(.18,lobeTangent.z)));
      vec3 lobeNormal=normalize(treeLightRight*lobeTangent.x+vec3(0.,lobeTangent.y,0.)+treeForward*lobeTangent.z);
      // Fade fine lobe detail with distance; preserve the far ridges' matched tone.
      float lobeWeight=treeNormalReady*(.48+.30*treeRelief)*(1.-treeAerial);
      crownNormal=normalize(mix(crownNormal,lobeNormal,lobeWeight));
      vec3 treeResponse=clamp(foliageIrradiance(crownNormal,treeLightPosition),vec3(.55),vec3(1.08));
      outgoingLight*=mix(vec3(.82),treeResponse*.86,.55+.35*treeRelief)*daySurfaceTint;
      float canopyDetail=dot(texture2D(map,treeSpriteUv).rgb,vec3(.2126,.7152,.0722));
      vec3 mountainCanopy=treeTerrainTint*(.83+.30*smoothstep(.015,.23,canopyDetail))*daySurfaceTint;
      mountainCanopy*=mix(vec3(1.),treeResponse,.20);
      outgoingLight=mix(outgoingLight,mountainCanopy,treeTerrainBlend);
      #include <opaque_fragment>
    `);
  };
  treeMaterial.customProgramCacheKey=()=> 'tree-billboard-lobe-normals-wind-v7';
  return treeMaterial;
}

export function addTreeBillboards(parent,trees,label='distant',cellSize=80){
  const buckets=new Map(),dummy=new THREE.Object3D(),tint=new THREE.Color();
  trees.forEach((tree,i)=>{
    const key=`${Math.floor(tree.x/cellSize)}:${Math.floor(tree.z/cellSize)}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({...tree,variant:tree.variant??i%4});
  });
  for(const [key,spots] of buckets){
    const geometry=new THREE.PlaneGeometry(1,1);geometry.translate(0,.5,0);
    geometry.setAttribute('terrainTint',new THREE.InstancedBufferAttribute(new Float32Array(spots.flatMap(p=>p.terrainTint??[0,0,0])),3));
    geometry.setAttribute('terrainBlend',new THREE.InstancedBufferAttribute(new Float32Array(spots.map(p=>p.terrainTint?1:0)),1));
    geometry.setAttribute('treeVariant',new THREE.InstancedBufferAttribute(new Float32Array(spots.map(p=>p.variant)),1));
    geometry.setAttribute('crownRelief',new THREE.InstancedBufferAttribute(new Float32Array(spots.map(p=>p.hill?1:0)),1));
    const mesh=new THREE.InstancedMesh(geometry,material(),spots.length);mesh.name=`tree-billboard-${label}-${key}`;
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.softFoliage=true;
    let maxWidth=0;
    spots.forEach((p,i)=>{
      const width=p.height*(p.wide??1)*.85;maxWidth=Math.max(maxWidth,width);
      // The portrait's root is 12px above the lower image edge.
      dummy.position.set(p.x,p.y-p.height*(12/384),p.z);dummy.rotation.set(0,0,0);dummy.scale.set(width,p.height,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      const tone=p.tone??(.92+(i%7)*.015);tint.setRGB(tone,tone,tone);mesh.setColorAt(i,tint);
    });
    mesh.computeBoundingBox();mesh.boundingBox.expandByScalar(maxWidth/2+.24);mesh.boundingSphere=new THREE.Sphere();mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);
    parent.add(mesh);
  }
  return {instances:trees.length,batches:buckets.size,triangles:trees.length*2};
}
