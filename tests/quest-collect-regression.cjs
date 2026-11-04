'use strict';
const assert=require('node:assert/strict');
const Quest=require('../src/quest_core.js');
const Gameplay=require('../src/gameplay_core.js');
const doc={objects:[{id:'coin_a'},{id:'coin_b'},{id:'button'}],graphs:[],items:[],quests:[
{id:'coins',event:'collect',source:'*',required:2,rewardCoins:5},
{id:'press',event:'interact',source:'button',required:3,rewardCoins:7},
{id:'specific',event:'collect',source:'coin_a',required:1,rewardCoins:0}
]};
assert.deepEqual(Quest.validate(doc).errors,[]);
let cash=0;
const quests=Quest.create(doc,{addCoins:n=>cash+=n});
const gameplay=Gameplay.create(doc,{onEvent:(event,source)=>{if(event==='collect')quests.record('collect',source,1);}});
const progress=id=>quests.list().find(q=>q.id===id).progress;
gameplay.emit('interact','button');
assert.equal(progress('coins'),0);
quests.record('interact','button');
assert.equal(progress('press'),1);
gameplay.emit('collect','coin_a');
assert.equal(progress('coins'),1);
assert.equal(progress('specific'),1);
assert.equal(progress('press'),1);
gameplay.emit('collect','coin_b');
assert.equal(progress('coins'),2);
assert.equal(progress('specific'),1);
assert.equal(quests.claim('coins').ok,true);
assert.equal(cash,5);
assert.equal(quests.claim('coins').ok,false);
const restored=Quest.create(doc,{});
restored.restore(quests.snapshot());
assert.equal(restored.list().find(q=>q.id==='coins').claimed,true);
assert.equal(restored.list().find(q=>q.id==='press').progress,1);
{
 let granted=0,collects=0,interactions=0;
 const legacy={objects:[{id:'legacy',action:'collect',components:[{type:'pickup',enabled:true,amount:10,activation:'interact'}]}],graphs:[]};
 const g=Gameplay.create(legacy,{addCoins:n=>{granted+=n;},onEvent:event=>{if(event==='collect')collects++;if(event==='interact')interactions++;}});
 g.interact('legacy',1200);
 assert.equal(granted,0,'action=collect owns coin award; redundant Pickup component cannot pay twice');
 assert.equal(collects,0,'action=collect owns collect event; redundant Pickup component cannot emit twice');
 assert.equal(interactions,1,'existing interact graphs remain compatible');
}
{
 const q=Quest.create({quests:[{id:'quantity_guard',event:'collect',source:'*',required:5}],objects:[],items:[]});
 const before=q.snapshot().revision;
 for(const amount of [0,-1,-99,NaN,Infinity,-Infinity,'invalid',null,0.5]){
  assert.deepEqual(q.record('collect','coin',amount),[],'invalid quantity ignored: '+String(amount));
 }
 assert.equal(q.list()[0].progress,0,'invalid events cannot advance quests');
 assert.equal(q.snapshot().revision,before,'invalid events cannot broadcast progress');
 assert.deepEqual(q.record('collect','coin'),['quantity_guard'],'legacy omitted quantity is one');
 assert.equal(q.list()[0].progress,1);
 assert.deepEqual(q.record('collect','coin',2),['quantity_guard'],'positive quantities still count');
 assert.equal(q.list()[0].progress,3);
 assert.deepEqual(q.record('interact','coin',2),[],'event isolation maintained');
 assert.equal(q.list()[0].progress,3);
}
console.log('Quest collect/interact separation and restore passed');
