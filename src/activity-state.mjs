// Only process identifiers enter this mapper; unknown process names never leave it.
const phrases = {
  notion: ['Notion', 'Notion으로 아이디어 정리 중'],
  chatgpt: ['ChatGPT', 'ChatGPT로 대화하는 중'],
  codex: ['Codex', 'Codex로 프로젝트 작업 중'],
  unrealeditor: ['Unreal Engine', '언리얼에서 배경 작업 중'],
  blender: ['Blender', 'Blender로 모델링하는 중'],
  photoshop: ['Photoshop', 'Photoshop으로 이미지 작업 중'],
  capcut: ['CapCut', 'CapCut으로 영상 편집 중'],
  code: ['VS Code', 'VS Code로 코드 작성 중'],
  chrome: ['Chrome', 'Chrome으로 작업 중'],
  msedge: ['Edge', 'Edge로 작업 중'],
  firefox: ['Firefox', 'Firefox로 작업 중'],
  figma: ['Figma', 'Figma로 디자인 작업 중'],
};
export function mapActivity(processName) {
  const pair=phrases[String(processName).toLowerCase().replace(/\.exe$/, '')];
  return pair ? {app:pair[0],text:pair[1]} : {app:'',text:'집중해서 작업하는 중'};
}
export function createActivityState({settleMs=1000}={}) {
  let pending='',since=0,current=mapActivity(''),connected=false,lastSample=0;
  return {
    sample(name,now=Date.now()) {
      if(!String(name).trim()){this.reset();return;}
      if(!connected)current=mapActivity(name);
      connected=true;
      lastSample=now;
      const next=mapActivity(name),key=next.text;
      if(key!==pending){pending=key;since=now;}
      if(now-since>=settleMs)current=next;
    },
    reset(){pending='';since=0;connected=false;current=mapActivity('');},
    get(now=Date.now()){
      const fresh=connected&&now-lastSample<6500;
      return {...(fresh?current:mapActivity('')),connected:fresh};
    },
  };
}
export function allowedActivityRequest({host,origin,remoteAddress}) {
  return host==='127.0.0.1:5175' && ['127.0.0.1','::ffff:127.0.0.1'].includes(remoteAddress)
    && (origin==='https://apochill.lastweek.chatgpt.site'||/^http:\/\/(127\.0\.0\.1|localhost):(5174|4173|4174)$/.test(origin??''));
}
