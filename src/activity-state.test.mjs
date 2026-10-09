import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapActivity,createActivityState,allowedActivityRequest} from './activity-state.mjs';
test('process mapping never infers browser tabs or exposes unknown executable names',()=>{
  assert.equal(mapActivity('Notion.exe').app,'Notion');
  assert.equal(mapActivity('CapCut.exe').text,'CapCut으로 영상 편집 중');
  assert.equal(mapActivity('chrome').app,'Chrome');
  assert.equal(mapActivity('msedge').app,'Edge');
  assert.equal(mapActivity('firefox').app,'Firefox');
  assert.equal(mapActivity('private-sensitive-app').app,'');
});
test('brief app switches do not flicker and reset clears state',()=>{
  const s=createActivityState();s.sample('notion',0);s.sample('notion',3000);
  assert.equal(s.get(3000).app,'Notion');s.sample('chrome',3100);s.sample('notion',3500);
  assert.equal(s.get(3500).app,'Notion');s.sample('blender',4000);s.sample('blender',7100);
  assert.equal(s.get(7100).app,'Blender');s.reset();assert.equal(s.get().connected,false);assert.equal(s.get().app,'');
});
test('only the exact published site and local previews can connect from loopback',()=>{
  const local={host:'127.0.0.1:5175',origin:'http://127.0.0.1:5174',remoteAddress:'127.0.0.1'};
  assert.ok(allowedActivityRequest(local));
  assert.ok(allowedActivityRequest({...local,origin:'https://apochill.lastweek.chatgpt.site'}));
  assert.equal(allowedActivityRequest({...local,origin:'https://apochill.lastweek.chatgpt.site.evil.example'}),false);
  for(const patch of [{origin:'https://public.example'},{origin:undefined},{host:'evil.example:5175'},{remoteAddress:'192.168.1.9'},{origin:'http://localhost:9999'}])
    assert.equal(allowedActivityRequest({...local,...patch}),false);
});
test('stalled or failed app sampling cannot keep an old app label alive',()=>{
  const s=createActivityState();s.sample('notion',100);
  assert.equal(s.get(100).app,'Notion');assert.equal(s.get(6700).connected,false);
  assert.equal(s.get(6700).app,'');s.sample('',6800);assert.equal(s.get(6800).connected,false);
});
