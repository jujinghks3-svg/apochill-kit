import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createActivityState,allowedActivityRequest} from './activity-state.mjs';
const state=createActivityState();let child=null,enabled=false,buffer='',closing=false;
const sampler=readFileSync(new URL('./foreground-app.ps1',import.meta.url),'utf8');
function stop(){enabled=false;child?.kill();child=null;buffer='';state.reset();}
function start(){
  if(child)return;
  if(process.platform!=='win32')return;
  enabled=true;
  // Run the fixed project command without changing Windows execution policy.
  const worker=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',sampler],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  child=worker;
  worker.stdout.setEncoding('utf8');
  worker.stdout.on('data',data=>{
    if(child!==worker)return;
    buffer+=data;const lines=buffer.split(/\r?\n/);buffer=lines.pop();
    for(const line of lines)state.sample(line.trim());
  });
  const disconnected=()=>{if(child===worker){child=null;enabled=false;buffer='';state.reset();}};
  worker.on('error',disconnected);worker.on('exit',disconnected);
}
const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!allowedActivityRequest({host:req.headers.host,origin:req.headers.origin,remoteAddress:req.socket.remoteAddress})){
    res.writeHead(403);res.end();return;
  }
  res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){
    if(req.headers['access-control-request-private-network']==='true')res.setHeader('Access-Control-Allow-Private-Network','true');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204);res.end();return;
  }
  if(req.url==='/status'&&req.method==='GET'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({protocol:2,enabled,...state.get()}));return;
  }
  if(['/start','/stop'].includes(req.url)&&req.method==='POST'&&req.headers['content-type']==='application/json'){
    req.resume();req.url==='/start'?start():stop();res.writeHead(204);res.end();return;
  }
  res.writeHead(404);res.end();
});
function shutdown(){if(closing)return;closing=true;stop();server.close();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
server.on('error',()=>{stop();console.error('Activity helper could not bind 127.0.0.1:5175');process.exitCode=1;});
server.listen(5175,'127.0.0.1',()=>console.log(`Apochill app-name helper ready at 127.0.0.1:5175 (pid ${process.pid}); use the scene button to start/stop.`));
