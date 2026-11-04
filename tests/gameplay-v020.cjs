/* Gameplay v0.20 regression: graph timers and typed numeric counters. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../src/gameplay_core.js');
function make(){
 const graph={id:'timer-main',name:'Every third tick',event:'timer',source:'*',enabled:true,interval:.5,
  nodes:[
   {id:'incr',type:'counter',key:'ticks',mode:'add',amount:1},
   {id:'check',type:'ifCounter',key:'ticks',amount:3},
   {id:'reward',type:'coins',amount:5},
   {id:'message',type:'message',text:'Reward awarded'},
   {id:'clear',type:'counter',key:'ticks',mode:'set',amount:0}
  ],
  links:[
   {from:'start',to:'incr',port:'next'},
   {from:'incr',to:'check',port:'next'},
   {from:'check',to:'reward',port:'yes'},
   {from:'reward',to:'message',port:'next'},
   {from:'message',to:'clear',port:'next'}
  ]};
 return {objects:[],graphs:[graph],settings:{maxHealth:100}};
}
const doc=make();
assert.deepEqual(core.validate(doc).errors,[],'valid timer graph');
let coins=0,messages=[];
const engine=core.create(doc,{getCoins:()=>coins,addCoins:n=>{coins+=n;},message:s=>messages.push(s)});
assert.equal(engine.tick(0),0);
assert.equal(engine.tick(.25),0);
assert.equal(engine.tick(.25),1);
assert.equal(engine.state.counters.ticks,1);
assert.equal(coins,0);
for(let i=0;i<4;i++)engine.tick(.25);
assert.equal(engine.state.counters.ticks,0,'counter resets after third timer');
assert.equal(coins,5,'reward granted through counter branch');
assert.deepEqual(messages,['Reward awarded']);
assert.equal(engine.trace().at(-1).event,'timer','trace includes timer source');
assert.equal(engine.state.events,3);
engine.tick(.25);assert.equal(engine.state.counters.ticks,0);
engine.tick(.25);assert.equal(engine.state.counters.ticks,1);
engine.reset();assert.equal(engine.state.counters.ticks,undefined,'restart clears counters');
engine.tick(.25);engine.tick(.25);
assert.equal(engine.state.counters.ticks,1,'restart resets timer phase');
doc.graphs[0].enabled=false;
for(let i=0;i<10;i++)engine.tick(.25);
assert.equal(engine.state.counters.ticks,1,'disabled graph does not fire');
doc.graphs[0].enabled=true;
engine.tick(1000000);
assert.ok(engine.state.events<=7,'huge dt cannot run unbounded graph callbacks');
{
 const invalid=make();invalid.graphs[0].interval=0;
 assert.match(core.validate(invalid).errors.join(' '),/интервал/);
 invalid.graphs[0].interval=2;
 invalid.graphs[0].nodes[0].key='__proto__'; // valid as a string, but prototype-free storage is mandatory
 const safe=core.create(invalid,{});safe.tick(.25);safe.tick(.25);
 assert.equal(Object.getPrototypeOf(safe.state.counters),null,'counter data has no mutable prototype');
 invalid.graphs[0].nodes[0].key='x'.repeat(41);
 assert.match(core.validate(invalid).errors.join(' '),/имя счётчика/);
}
{
 const other={objects:[],graphs:[{id:'interact',event:'interact',source:'*',nodes:[
  {id:'set',type:'counter',key:'счет',mode:'set',amount:7},
  {id:'test',type:'ifCounter',key:'счет',amount:7},
  {id:'reward',type:'coins',amount:12}],links:[
  {from:'start',to:'set',port:'next'},{from:'set',to:'test',port:'next'},
  {from:'test',to:'reward',port:'yes'}]}],settings:{}};
 assert.deepEqual(core.validate(other).errors,[],'Russian counter names supported');
 const e=core.create(other,{addCoins:n=>{coins+=n}});
 e.emit('interact','xyz',{});
 assert.equal(e.state.counters['счет'],7);
 assert.equal(coins,17);
}
{
 const old={objects:[],graphs:[{id:'legacy',event:'start',nodes:[{id:'hello',type:'message',text:'Old project'}],links:[{from:'start',to:'hello',port:'next'}]}]};
 assert.deepEqual(core.validate(old).errors,[],'old graph valid unchanged');
 const log=[];core.create(old,{message:t=>log.push(t)}).emit('start','',{});
 assert.deepEqual(log,['Old project']);
}
console.log('Gameplay v0.20: timer, counters, branching, reset, validation, safety, compatibility passed.');
