// Independent of Three.js: two streaming decks, Web Audio gain for iOS volume.
export class BgmPlayer {
  constructor({createAudio=()=>new Audio(),createContext=()=>new (window.AudioContext||window.webkitAudioContext)(),onChange=()=>{},volume=.3,muted=false,crossfade=5}={}){
    Object.assign(this,{createAudio,createContext,onChange,volume,muted,crossfade});
    this.tracks=[];this.index=0;this.active=0;this.state='empty';this.message='음원을 기다리고 있어요';this.token=0;this.disposed=false;
  }
  emit(){this.onChange({state:this.state,message:this.message,track:this.tracks[this.index],volume:this.volume,muted:this.muted,count:this.tracks.length});}
  initialize(){
    if(this.context)return;
    this.context=this.createContext();this.master=this.context.createGain();this.master.connect(this.context.destination);
    this.master.gain.value=this.muted?0:this.volume;
    this.decks=[0,1].map(()=>{
      const audio=this.createAudio();audio.preload='none';audio.crossOrigin='anonymous';audio.playsInline=true;
      const gain=this.context.createGain();gain.gain.value=0;
      this.context.createMediaElementSource(audio).connect(gain);gain.connect(this.master);
      return {audio,gain,index:-1};
    });
    this.decks.forEach((deck,i)=>{
      deck.audio.addEventListener('ended',()=>{if(this.state==='playing'&&i===this.active&&!this.fade)this.transition(0);});
      deck.audio.addEventListener('error',()=>{
        if(i===this.active&&['playing','loading'].includes(this.state))this.fail('음원을 읽지 못했어요. 파일 형식을 확인해 주세요.');
      });
    });
    this.timer=setInterval(()=>this.tick(),100);
  }
  gain(deck,value,seconds=0){
    const param=deck.gain.gain,now=this.context.currentTime;
    param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);
    if(seconds)param.linearRampToValueAtTime(value,now+seconds);else param.setValueAtTime(value,now);
  }
  setTracks(tracks){
    this.pause();this.tracks=tracks;this.index=0;this.active=0;
    this.decks?.forEach(d=>{d.audio.removeAttribute('src');d.audio.load();d.index=-1;});
    this.state=tracks.length?'ready':'empty';this.message=tracks.length?'눌러서 음악 시작':'음원을 기다리고 있어요';this.emit();
  }
  load(deck,index){
    if(deck.index===index&&deck.audio.src)return;
    deck.index=index;deck.audio.src=this.tracks[index].src;deck.audio.preload='auto';deck.audio.load();
  }
  async play({retryPending=false,autoplay=false}={}){
    if(this.disposed||!this.tracks.length||this.state==='playing'||(this.state==='loading'&&!retryPending))return;
    const token=++this.token;this.state='loading';this.message='음악 준비 중…';this.emit();
    let unlockTimer;
    try{
      this.initialize();
      // Called directly inside a click: unlock AudioContext and media together.
      const deck=this.decks[this.active];this.load(deck,this.index);this.gain(deck,0);
      const resume=this.context.resume(),start=deck.audio.play();
      // Some browsers leave resume() pending instead of rejecting autoplay.
      // Keep the controls usable and let the next real gesture retry both calls.
      if(autoplay)unlockTimer=setTimeout(()=>{
        if(token===this.token&&this.state==='loading'&&this.context.state==='suspended')
          this.fail('화면이나 다음 버튼을 누르면 음악이 시작돼요.','blocked');
      },1500);
      await Promise.all([resume,start]);
      if(token!==this.token||this.disposed)return;
      this.state='playing';this.message='';this.gain(deck,1,.8);this.preloadNext();this.emit();
    }catch(error){if(token===this.token)this.fail(error.name==='NotAllowedError'?'화면이나 다음 버튼을 누르면 음악이 시작돼요.':'음원을 재생하지 못했어요. 다시 열어 주세요.',error.name==='NotAllowedError'?'blocked':'error');}
    finally{clearTimeout(unlockTimer);}
  }
  preloadNext(){this.load(this.decks[1-this.active],(this.index+1)%this.tracks.length);}
  async transition(seconds){
    if(this.fade||this.switching||this.state!=='playing')return;
    this.switching=true;const token=this.token,incoming=this.decks[1-this.active];
    try{
      this.preloadNext();incoming.audio.currentTime=0;this.gain(incoming,0);await incoming.audio.play();
      if(token!==this.token||this.disposed)return;
      this.fade={end:this.context.currentTime+seconds};
      this.gain(this.decks[this.active],0,seconds);this.gain(incoming,1,seconds);this.tick();
    }catch{if(token===this.token)this.fail('다음 곡을 재생하지 못했어요. 음원 목록을 확인해 주세요.');}
    finally{if(token===this.token)this.switching=false;}
  }
  tick(){
    if(this.state!=='playing')return;
    if(this.fade){
      if(this.context.currentTime<this.fade.end)return;
      const previous=this.decks[this.active];previous.audio.pause();previous.audio.currentTime=0;this.gain(previous,0);
      this.active=1-this.active;this.index=this.decks[this.active].index;this.fade=null;this.preloadNext();this.emit();return;
    }
    const audio=this.decks[this.active].audio;
    const fade=Math.min(this.crossfade,audio.duration/3);
    if(Number.isFinite(audio.duration)&&audio.duration>0&&audio.duration-audio.currentTime<=fade&&this.decks[1-this.active].audio.readyState>=3)this.transition(Math.max(0,audio.duration-audio.currentTime));
  }
  pause(){
    ++this.token;this.switching=false;
    if(this.decks){
      // Keep the incoming track if a crossfade has begun; never resume two decks.
      if(this.fade){this.active=1-this.active;this.index=this.decks[this.active].index;}
      this.fade=null;this.decks.forEach((d,i)=>{d.audio.pause();this.gain(d,i===this.active?1:0);});
    }
    if(this.tracks.length){this.state='paused';this.message='일시정지';this.emit();}
  }
  stop(){
    this.pause();this.decks?.forEach(d=>{d.audio.currentTime=0;});
    if(this.tracks.length){this.state='ready';this.message='눌러서 음악 시작';this.emit();}
  }
  select(index){
    if(!Number.isInteger(index)||index<0||index>=this.tracks.length)return;
    this.stop();this.index=index;this.active=0;this.decks?.forEach(d=>{d.index=-1;});
    this.state='ready';this.message='눌러서 음악 시작';this.emit();
  }
  fail(message,state='error'){this.pause();this.state=state;this.message=message;this.emit();}
  setVolume(value){this.volume=Math.min(1,Math.max(0,Number(value)||0));this.updateVolume();}
  setMuted(value){this.muted=Boolean(value);this.updateVolume();}
  updateVolume(){
    if(this.master){const p=this.master.gain,t=this.context.currentTime;p.cancelScheduledValues(t);p.setTargetAtTime(this.muted?0:this.volume,t,.025);}
    this.emit();
  }
  async dispose(){
    if(this.disposed)return;this.pause();this.disposed=true;clearInterval(this.timer);
    this.decks?.forEach(d=>{d.audio.removeAttribute('src');d.audio.load();});await this.context?.close();
  }
}

export function validatePlaylist(data,baseUrl){
  if(!Array.isArray(data?.tracks))throw new Error('Invalid playlist');
  const base=new URL(baseUrl);
  return data.tracks.map(track=>{
    if(typeof track.src!=='string'||!track.src||typeof track.title!=='string')throw new Error('Invalid track');
    const url=new URL(track.src,base);
    if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||! /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname))throw new Error('Audio must be inside the BGM folder');
    return {src:url.href,title:track.title};
  });
}
