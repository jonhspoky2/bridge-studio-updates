/* Bridge Studio v0.21 regression: signals, comparators and graph-only doors. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../src/gameplay_core.js');
function graph(id,event,nodes,links,fields){
 return Object.assign({id,name:id,event,enabled:true,source:'*',nodes,links},fields||{});
}
function example(){
 const objects=[
  {id:'switch',name:'Button',components:[{type:'trigger',activation:'interact',enabled:true}]},
  {id:'gate',name:'Gate',components:[{type:'door',activation:'graph',enabled:true}]}
 ];
 const unlock=graph('unlock','interact',[
  {id:'press',type:'counter',key:'presses',amount:1,mode:'add'},
  {id:'three',type:'ifCounter',key:'presses',amount:3,compare:'eq'},
  {id:'door',type:'door',target:'gate',mode:'open'},
  {id:'signal',type:'emitSignal',signal:'gate_unlocked'}],[
  {from:'start',to:'press',port:'next'},{from:'press',to:'three',port:'next'},
  {from:'three',to:'door',port:'yes'},{from:'door',to:'signal',port:'next'}],
  {source:'switch'});
 const reward=graph('reward','signal',[
  {id:'coins',type:'coins',amount:10},
  {id:'text',type:'message',text:'Gate unlocked'}
 ],[{from:'start',to:'coins',port:'next'},{from:'coins',to:'text',port:'next'}],{signal:'gate_unlocked'});
 return {objects,graphs:[unlock,reward],settings:{maxHealth:100}};
}
const doc=example();assert.deepEqual(core.validate(doc).errors,[],'graph-only activation, signal and eq operator are valid');
let coins=0,opens=[],messages=[],warnings=[];
const hooks={getCoins:()=>coins,addCoins:n=>{coins+=n;},toggleDoor:(id,mode)=>{opens.push({id,mode});},message:m=>messages.push(m),warn:m=>warnings.push(m)};
const e=core.create(doc,hooks);
e.interact('gate',1);assert.equal(opens.length,0,'graph-only door must not open on E by itself');
for(let i=1;i<=4;i++){
 e.interact('switch',1000*i);
 if(i<3){assert.equal(coins,0,'reward locked until three presses');assert.equal(opens.length,0);}
 if(i===3){assert.equal(coins,10);assert.deepEqual(opens,[{id:'gate',mode:'open'}]);}
}
assert.equal(coins,10,'fourth press does not reward again');
assert.equal(e.state.counters.presses,4);
assert.deepEqual(messages,['Gate unlocked']);
assert.ok(e.trace().some(r=>r.event==='signal'&&r.graph==='reward'),'named signal reached another graph');
e.emit('signal','different_signal',{});
assert.equal(coins,10,'other signals do not invoke reward graph');
e.reset();assert.equal(e.state.counters.presses,undefined,'reset clears progress');
for(let i=0;i<3;i++)e.interact('switch',5000+i*1000);
assert.equal(coins,20,'gate can be unlocked again after restart');
{
 const conditional=graph('comparisons','start',[
  {id:'zero',type:'ifCounter',key:'points',compare:'lte',amount:0},
  {id:'msg',type:'message',text:'Zero or below'}],[
  {from:'start',to:'zero',port:'next'},{from:'zero',to:'msg',port:'yes'}]);
 const d={objects:[],graphs:[conditional]};
 const output=[];const instance=core.create(d,{message:m=>output.push(m)});
 instance.emit('start','');assert.deepEqual(output,['Zero or below'],'lte compares missing counter as zero');
 conditional.nodes[0].compare='gte';output.length=0;
 instance.emit('start','');assert.deepEqual(output,['Zero or below'],'gte includes equality');
 conditional.nodes[0].compare='eq';output.length=0;
 instance.emit('start','');assert.deepEqual(output,['Zero or below'],'eq supported');
}
{
 const invalid=example();invalid.graphs[0].nodes[1].compare='malicious';
 assert.match(core.validate(invalid).errors.join(' '),/оператор/);
 invalid.graphs[0].nodes[1].compare='eq';
 invalid.graphs[1].signal='bad signal';
 assert.match(core.validate(invalid).errors.join(' '),/имя сигнала/);
 invalid.graphs[1].signal='gate_unlocked';
 invalid.graphs[0].nodes[3].signal='\u0000';
 assert.match(core.validate(invalid).errors.join(' '),/имя сигнала/);
 invalid.graphs[0].nodes[3].signal='gate_unlocked';
 invalid.objects[1].components[0].activation='invalid';
 assert.match(core.validate(invalid).errors.join(' '),/активация/);
}
{
 const loop=graph('recursive','signal',[{id:'send',type:'emitSignal',signal:'loop'}],[{from:'start',to:'send',port:'next'}],{signal:'loop'});
 const errors=[];const e=core.create({objects:[],graphs:[loop]},{warn:s=>errors.push(s)});
 e.emit('signal','loop',{});
 assert.ok(errors.some(x=>x.includes('Слишком глубокая цепочка')),'bounded recursive signaling');
 assert.ok(e.state.events<=12,'signal recursion is capped');
}
{
 const legacy={objects:[],graphs:[graph('old','start',[{id:'text',type:'message',text:'legacy'}],[{from:'start',to:'text',port:'next'}])]};
 const got=[];const l=core.create(legacy,{message:m=>got.push(m)});
 assert.deepEqual(core.validate(legacy).errors,[]);
 l.emit('start','');assert.deepEqual(got,['legacy'],'old graphs remain compatible');
}
console.log('v0.21 signals, doors, count=3, named routing, comparisons, recursion bounds and legacy: OK');
