import {startupStage,setStartupLabel} from './startup-progress.js';
import './ui-shell.js';
import {startPrologue} from './prologue.js';
import './prologue.css';
const root=document.documentElement;
const stopPrologue=startPrologue();
function showFailure(message){root.dataset.renderReady='false';setStartupLabel(message);window.dispatchEvent(new CustomEvent('apochill-failed',{detail:message}));void startupStage('failed',message);}
window.addEventListener('apochill-ready',()=>{root.dataset.renderReady='true';});
document.querySelector('#scene').addEventListener('webglcontextlost',()=>{
  showFailure('3D 화면이 중단됐어요. 아래 모바일 모드로 다시 열어주세요.');
});
const slow=setTimeout(()=>{
  if(root.dataset.renderReady!=='true')setStartupLabel('로딩이 오래 걸리고 있어요. 모바일 모드로 다시 열거나 이미지를 먼저 확인하세요.');
},15000);
window.addEventListener('apochill-ready',()=>clearTimeout(slow),{once:true});
await startupStage('bootstrap','Apochill 화면을 준비하고 있어요…');
import('./main.js').catch(error=>{
  clearTimeout(slow);console.error('[Apochill] Startup failed:',error);
  showFailure('3D를 시작하지 못했어요. Safari 또는 Chrome에서 모바일 모드로 열어주세요.');
});
if(import.meta.hot)import.meta.hot.dispose(stopPrologue);
