/* Quest Chains v0.26: dependency validation, unlock events and secure restoration. */
'use strict';
const assert=require('node:assert/strict'),Quest=require('../src/quest_core.js');
const doc={objects:[{id:'coin'},{id:'button'}],items:[],quests:[
{id:'one',title:'Collect coin',event:'collect',source:'coin',required:1,rewardCoins:5},
{id:'two',title:'Press button',event:'interact',source:'button',required:2,rewardCoins:10,requiresQuestId:'one'}
]};
assert.deepEqual(Quest.validate(doc).errors,[]);
let cash=0;const quests=Quest.create(doc,{addCoins:n=>{cash+=n;}});
const task=id=>quests.list().find(q=>q.id===id);
assert.equal(task('two').locked,true);
assert.deepEqual(quests.record('interact','button',1),[],'locked quest ignores events');
assert.equal(quests.claim('two').ok,false,'cannot claim locked quest');
quests.record('collect','coin',1);
assert.equal(task('one').progress,1);
assert.equal(task('two').locked,true,'completion without claim does not unlock successor');
quests.record('interact','button',1);assert.equal(task('two').progress,0);
assert.equal(quests.claim('one').ok,true);assert.equal(cash,5);
assert.equal(task('two').locked,false,'claim unlocks successor');
quests.record('interact','button',1);quests.record('interact','button',1);
assert.equal(task('two').progress,2);
assert.equal(quests.claim('two').ok,true);assert.equal(cash,15);
assert.equal(quests.claim('one').ok,false,'one-time claim');
const snapshot=quests.snapshot();
const restored=Quest.create(doc,{});restored.restore(snapshot);
assert.equal(restored.list().find(q=>q.id==='one').claimed,true);
assert.equal(restored.list().find(q=>q.id==='two').claimed,true);
const tampered=Quest.create(doc,{});tampered.restore({progress:{one:0,two:2},claimed:{two:true}});
assert.equal(tampered.list().find(q=>q.id==='two').locked,true);
assert.equal(tampered.list().find(q=>q.id==='two').progress,0,'locked quest restored with zero progress');
assert.equal(tampered.list().find(q=>q.id==='two').claimed,false,'tampered claimed state cannot skip prerequisite');
const missing=JSON.parse(JSON.stringify(doc));missing.quests[1].requiresQuestId='ghost';
assert.match(Quest.validate(missing).errors.join(' | '),/Не найдено предыдущее/);
const self=JSON.parse(JSON.stringify(doc));self.quests[1].requiresQuestId='two';
assert.match(Quest.validate(self).errors.join(' | '),/не может зависеть/);
const cycle=JSON.parse(JSON.stringify(doc));cycle.quests[0].requiresQuestId='two';
assert.match(Quest.validate(cycle).errors.join(' | '),/Циклическая зависимость/);
const legacy={objects:[{id:'coin'}],quests:[{id:'legacy',event:'collect',source:'coin',required:1}]};
assert.deepEqual(Quest.validate(legacy).errors,[]);
assert.equal(Quest.create(legacy).list()[0].locked,false);
console.log('Quest Chains: locked events, claim unlock, cycles, persistence and legacy compatibility PASS');