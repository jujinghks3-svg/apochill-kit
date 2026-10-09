import './model-gallery.css';
const grid=document.querySelector('#grid'),filters=document.querySelector('#filters'),dialog=document.querySelector('#viewer');
const status=document.querySelector('#status'),stage=document.querySelector('#stage'),variant=document.querySelector('#variant');
let viewer,request=0,selected;
const fmt=n=>new Intl.NumberFormat('ko-KR').format(n);
async function boot(){
 const response=await fetch('/gallery/catalog.json');if(!response.ok)throw Error('목록을 불러오지 못했어요.');
 const catalog=await response.json();
 const categories=['전체',...new Set(catalog.map(x=>x.category)),'씬에서 제외'];
 function show(category){
  const items=catalog.filter(x=>category==='전체'||(category==='씬에서 제외'?!x.active:x.category===category));
  document.querySelector('#count').textContent=`${items.length}개 모델 / 전체 ${catalog.length}종`;
  grid.replaceChildren(...items.map(item=>{
   const card=document.createElement('button');card.className='card';
   const img=document.createElement('img');img.src='/'+item.thumbnail;img.alt=item.name+' 모델 미리보기';img.loading='lazy';img.width=480;img.height=480;
   const caption=document.createElement('span');caption.className='caption';
   const badge=document.createElement('span');badge.className='badge'+(item.active?'':' archived');badge.textContent=item.active?'씬 사용':'보관 · 씬 제외';
   const title=document.createElement('strong');title.textContent=item.name;
   const meta=document.createElement('span');meta.className='meta';meta.textContent=`${fmt(item.triangles)} 삼각형 · ${(item.bytes/1048576).toFixed(2)} MB`;
   caption.append(badge,title,meta);card.append(img,caption);card.onclick=()=>open(item);return card;
  }));
  [...filters.children].forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===category)));
 }
 categories.forEach(category=>{const b=document.createElement('button');b.textContent=category;b.onclick=()=>show(category);filters.append(b);});show('전체');
}
async function open(item){
 selected=item;document.querySelector('#model-title').textContent=item.name;
 variant.replaceChildren(...[{model:item.model,label:'웹용 최종 모델'},...item.variants].map(v=>{const o=document.createElement('option');o.value=v.model;o.textContent=v.label;return o;}));
 if(!dialog.open)dialog.showModal();await loadModel(item.model);
}
async function loadModel(url){
 const ticket=++request;status.textContent='3D 모델 불러오는 중…';document.querySelector('#download').href='/'+url;
 try{
  viewer??=createViewer();const v=await viewer;if(ticket!==request||!dialog.open)return;
  v.clear();v.resize();const gltf=await v.loader.loadAsync('/'+url);
  if(ticket!==request||!dialog.open){v.disposeModel(gltf.scene);return;}
  v.show(gltf.scene);status.textContent='드래그해서 모델을 둘러보세요';
 }catch(error){if(ticket===request)status.textContent='3D 보기를 열지 못했어요. GLB 다운로드를 이용해 주세요.';console.error(error);}
}
variant.onchange=()=>loadModel(variant.value);
document.querySelector('#close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{request++;viewer?.then(v=>v.clear()).catch(()=>{});});
async function createViewer(){
 const [T,{GLTFLoader},{DRACOLoader},{OrbitControls},{RoomEnvironment}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/loaders/DRACOLoader.js'),import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js')]);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;stage.prepend(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#e3e7df');
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
 scene.add(new T.HemisphereLight(0xffffff,0x6d7664,2));const sun=new T.DirectionalLight(0xffffff,2.5);sun.position.set(4,7,5);scene.add(sun);
 const camera=new T.PerspectiveCamera(38,1,.01,100);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.autoRotate=true;controls.autoRotateSpeed=.45;controls.target.set(0,1,0);
 const decoder=new DRACOLoader();decoder.setDecoderPath('/draco/');decoder.setWorkerLimit(1);const loader=new GLTFLoader().setDRACOLoader(decoder);
 let model;
 function disposeModel(object){const textures=new Set(),geometries=new Set(),materials=new Set();object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 function clear(){if(model){scene.remove(model);disposeModel(model);model=null;}renderer.setAnimationLoop(null);renderer.clear();}
 function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(stage);
 function show(object){model=new T.Group();model.add(object);scene.add(model);object.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(object,true),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const scale=2/Math.max(size.x,size.y,size.z,.001);object.position.sub(center);model.scale.setScalar(scale);model.position.y=size.y*scale/2;const height=size.y*scale;controls.target.set(0,height/2,0);const radius=size.length()*scale/2;const angle=Math.min(T.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.aspect));const distance=radius/Math.sin(angle)*1.15;camera.position.copy(controls.target).add(new T.Vector3(1,.55,1.6).normalize().multiplyScalar(distance));controls.minDistance=.4;controls.maxDistance=distance*3;controls.update();renderer.setAnimationLoop(()=>{if(document.hidden||!dialog.open)return;controls.update();renderer.render(scene,camera);});}
 return {loader,show,clear,resize,disposeModel};
}
boot().catch(error=>{document.querySelector('#count').textContent=error.message;});
