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
console.log('Quest collect/interact separation and restore passed');
