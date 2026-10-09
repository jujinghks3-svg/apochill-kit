import test from 'node:test';
import assert from 'node:assert/strict';
import {activityPhrase} from './activity-phrases.js';
test('each mood retains the detected app name and uses readable particles',()=>{
  assert.deepEqual([0,1,2,3].map(i=>activityPhrase('CapCut',i)),[
    'CapCut으로 작업하는 중','CapCut으로 구상하는 중','CapCut으로 달리는 중','CapCut으로 작업하는 중']);
  assert.equal(activityPhrase('ChatGPT',0),'ChatGPT로 작업하는 중');
  assert.equal(activityPhrase('Chrome',1),'Chrome으로 구상하는 중');
  assert.equal(activityPhrase('',2),'옥상에서 잠시 쉬는 중');
});
