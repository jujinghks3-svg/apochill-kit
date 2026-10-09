import {mkdir,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
export function startupTracePlugin(){
  return {name:'apochill-startup-trace',configureServer(server){
    let requests=0,windowStart=Date.now();
    server.middlewares.use('/__apochill_startup',(req,res)=>{
      if(req.method!=='POST'){res.writeHead(405);res.end();return;}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
      if(Date.now()-windowStart>60000){requests=0;windowStart=Date.now();}
      if(++requests>120){res.writeHead(429);res.end();return;}
      let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1024)req.destroy();});
      req.on('end',async()=>{try{
        const {stage,elapsedMs,profile}=JSON.parse(body);
        if(!/^[a-z-]{1,40}$/.test(stage)||!Number.isFinite(elapsedMs)||!['initial','desktop','mobile'].includes(profile))throw Error('Invalid stage');
        const dir=join(server.config.root,'diagnostics');await mkdir(dir,{recursive:true});
        await appendFile(join(dir,'startup.jsonl'),JSON.stringify({at:new Date().toISOString(),stage,elapsedMs,profile})+'\n');
        res.writeHead(204);res.end();
      }catch{res.writeHead(400);res.end();}});
    });
  }};
}
