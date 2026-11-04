/* Bridge Studio Gameplay Core 0.17. Data-only, deterministic graph execution.
 * This module has no Three.js or DOM dependency, and may be tested with Node.js.
 * A graph consists of start -> action/condition nodes connected by explicit links.
 * Graphs are bounded to protect games from cycles and pathological user content.
 */
(function(root,factory){
 'use strict';
 var mod=factory();
 if(root)root.BridgeGameplayCore=mod;
 if(typeof module==='object'&&module.exports)module.exports=mod;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
 'use strict';
 var COMPONENTS=['pickup','damage','heal','checkpoint','teleporter','door','npc','movingPlatform','trigger'];
 var EVENTS=['start','touch','leave','interact','collect','checkpoint','health','death','win','ui','timer','signal'];
 var NODES=['message','coins','heal','damage','teleport','door','visibility','checkpoint','flag','win','reset','ifCoins','ifHealth','ifFlag','counter','ifCounter','emitSignal'];
 function num(v,def,min,max){v=Number(v);if(!Number.isFinite(v))return def;return Math.max(min,Math.min(max,v));}
 function str(v,def){return typeof v==='string'?v:def;}
 function counterName(value){return typeof value==='string'&&/^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_-]{0,39}$/.test(value);}
 function timerInterval(g){return num(g.interval,2,.1,3600);}
 function compareCounter(actual,required,op){return op==='eq'?actual===required:op==='lte'?actual<=required:actual>=required;}
 function signalName(s){return counterName(s);}
 function allComponents(def){return Array.isArray(def&&def.components)?def.components.filter(function(c){return c&&c.enabled!==false&&COMPONENTS.indexOf(c.type)!==-1;}):[];}
 function validate(doc){var errors=[],warnings=[],objects=(doc&&doc.objects)||[],graphs=(doc&&doc.graphs)||[];
  if(!Array.isArray(objects)||!Array.isArray(graphs))return {errors:['objects/graphs должны быть массивами'],warnings:[]};
  var ids=new Set(objects.map(function(o){return o.id;}));
  if(graphs.length>100)errors.push('Не более 100 графов логики');
  objects.forEach(function(obj){if(obj.components!==undefined&&!Array.isArray(obj.components))errors.push('Компоненты у '+obj.name+' должны быть массивом');
   allComponents(obj).forEach(function(c){if((c.type==='teleporter'||c.type==='door')&&c.target&&!ids.has(c.target))warnings.push('Не найден объект '+c.target+' у '+obj.name);
    if(c.type==='movingPlatform'&&(!Array.isArray(c.offset)||c.offset.length!==3))errors.push('Moving Platform '+obj.name+': требуется offset [x,y,z]');
    if(c.activation!==undefined&&['touch','interact','graph'].indexOf(c.activation)<0)errors.push('Неизвестная активация компонента '+obj.name);});});
  var graphIds=new Set();graphs.forEach(function(g,i){if(!g||!g.id||graphIds.has(g.id)){errors.push('Повторяющийся или пустой ID графа #'+i);return;}graphIds.add(g.id);
   if(EVENTS.indexOf(g.event)<0)errors.push('Неизвестное событие графа '+g.id);
   if(g.event==='timer'&&(!Number.isFinite(g.interval)||g.interval<.1||g.interval>3600))errors.push('Таймер графа '+g.id+': интервал 0.1–3600 секунд');
   if(g.event==='signal'&&!signalName(g.signal))errors.push('Неверное имя сигнала у графа '+g.id);
   if(g.source&&g.source!=='*'&&!ids.has(g.source)&&!(g.event==='ui'&&(doc.ui||[]).some(function(x){return x.id===g.source;})))warnings.push('Источник '+g.source+' отсутствует у графа '+g.id);
   if(!Array.isArray(g.nodes)||!Array.isArray(g.links)||g.nodes.length>80||g.links.length>160){errors.push('Недопустимое количество узлов/связей у '+g.id);return;}
   var nodeIds=new Set(['start']);g.nodes.forEach(function(n){if(!n||!n.id||nodeIds.has(n.id))errors.push('Повторяющийся ID узла у '+g.id);else nodeIds.add(n.id);if(n&&NODES.indexOf(n.type)<0)errors.push('Неизвестный тип узла '+n.type);
    if(n&&(n.type==='counter'||n.type==='ifCounter')&&!counterName(n.key))errors.push('Недопустимое имя счётчика у '+g.id);
    if(n&&n.type==='counter'&&n.mode!==undefined&&n.mode!=='add'&&n.mode!=='set')errors.push('Недопустимая операция счётчика у '+g.id);
    if(n&&n.type==='ifCounter'&&n.compare!==undefined&&['gte','eq','lte'].indexOf(n.compare)<0)errors.push('Неизвестный оператор счётчика у '+g.id);
    if(n&&n.type==='emitSignal'&&!signalName(n.signal))errors.push('Неверное имя сигнала в блоке у '+g.id);});
   g.links.forEach(function(l){if(!l||!nodeIds.has(l.from)||!nodeIds.has(l.to))errors.push('Связь ведёт к отсутствующему узлу у '+g.id);else if(['next','yes','no'].indexOf(l.port||'next')<0)errors.push('Неизвестный порт узла у '+g.id);});
  });return {errors:errors,warnings:warnings};}
 function create(doc,hooks){
  doc=doc||{};hooks=hooks||{};
  var map={};(doc.objects||[]).forEach(function(o){map[o.id]=o;});
  var maxHealth=num(doc.settings&&doc.settings.maxHealth,100,1,1000);
  var state={health:maxHealth,maxHealth:maxHealth,checkpointId:null,flags:{},counters:Object.create(null),picked:{},doors:{},deaths:0,lastGraph:null,events:0};
  var contacts=new Set(),cooldowns={},timers=Object.create(null),executing=0,graphHits=[];
  function call(name){var args=Array.prototype.slice.call(arguments,1);if(typeof hooks[name]==='function')return hooks[name].apply(null,args);}
  function coins(){return Number(call('getCoins')||0);}
  function health(delta){var old=state.health;state.health=num(old+Number(delta||0),old,0,state.maxHealth);call('healthChange',state.health,state.maxHealth);
   if(state.health!==old){emit('health','',{health:state.health,delta:state.health-old});if(state.health<=0){state.deaths++;emit('death','',{deaths:state.deaths});call('dead');}}
   return state.health;}
  function checkpoint(id){if(!map[id])return false;state.checkpointId=id;call('setCheckpoint',id);emit('checkpoint',id,{});return true;}
  function runGraph(g,context){
   var byId={},steps=0,trace=[];g.nodes.forEach(function(n){byId[n.id]=n;});var todo=[{id:'start',port:'next'}];
   while(todo.length&&steps<96){var v=todo.shift(),node=byId[v.id],branch='next';steps++;if(node){trace.push(node.type+':'+node.id);try{
    switch(node.type){
     case 'message':call('message',str(node.text,'Событие'));break;
     case 'coins':call('addCoins',num(node.amount,1,-100000,100000));break;
     case 'heal':health(num(node.amount,25,0,1000));break;
     case 'damage':health(-num(node.amount,20,0,1000));break;
     case 'teleport':if(node.target)call('teleportTo',node.target);break;
     case 'door':if(node.target)call('toggleDoor',node.target,node.mode||'toggle');break;
     case 'visibility':if(node.target)call('setVisible',node.target,node.mode!=='hide');break;
     case 'checkpoint':checkpoint(node.target||context.source);break;
     case 'flag':state.flags[str(node.flag,'ready')]=node.value!==false;break;
     case 'emitSignal':
      if(signalName(node.signal))emit('signal',node.signal,{origin:context.source,graph:g.id});
      else call('warn','Неверное имя сигнала');
      break;
     case 'counter':
      if(!counterName(node.key)){call('warn','Недопустимое имя счётчика');break;}
      var amount=num(node.amount,1,-1000000,1000000),previous=num(state.counters[node.key],0,-1000000,1000000);
      state.counters[node.key]=num(node.mode==='set'?amount:previous+amount,0,-1000000,1000000);
      break;
     case 'win':call('win');break;
     case 'reset':call('restart');break;
     case 'ifCoins':branch=coins()>=num(node.amount,1,0,100000)?'yes':'no';break;
     case 'ifHealth':branch=state.health>=num(node.amount,1,0,1000)?'yes':'no';break;
     case 'ifFlag':branch=!!state.flags[str(node.flag,'ready')]===(node.value!==false)?'yes':'no';break;
     case 'ifCounter':
      var actual=counterName(node.key)?num(state.counters[node.key],0,-1000000,1000000):0;
      branch=counterName(node.key)&&compareCounter(actual,num(node.amount,1,-1000000,1000000),node.compare||'gte')?'yes':'no';
      break;
    }
   }catch(e){call('warn','Узел '+node.id+': '+(e.stack||e.message));}}
   var links=g.links.filter(function(l){return l.from===v.id&&(l.port||'next')===branch;});
   // For deterministic execution, links are ordered as they appear in the graph document.
   links.forEach(function(l){if(l.to!=='start'&&byId[l.to])todo.push({id:l.to});});
   }
   if(steps>=96){call('warn','Граф '+g.name+' остановлен: более 96 шагов (возможный цикл).');}
   state.lastGraph=g.id;graphHits.push({graph:g.id,steps:steps,trace:trace,event:context.event});if(graphHits.length>30)graphHits.shift();
  }
  function emit(event,source,extra){if(EVENTS.indexOf(event)<0)return 0;if(executing>8){call('warn','Слишком глубокая цепочка событий '+event);return 0;}
   state.events++;var fired=0;executing++;try{(doc.graphs||[]).forEach(function(g){if(g&&g.enabled!==false&&g.event===event&&(event==='signal'?g.signal===source:(!g.source||g.source==='*'||g.source===source))){fired++;runGraph(g,{event:event,source:source,data:extra||{}});}});}finally{executing--;}return fired;}
  /* Fixed-step compatible graph timers, maximum four firings per update. */
  function tick(dt){
   dt=num(dt,0,0,.25);if(!dt)return 0;
   var fired=0;
   (doc.graphs||[]).forEach(function(g){
    if(!g||g.event!=='timer')return;
    if(g.enabled===false){timers[g.id]=0;return;}
    var interval=timerInterval(g),remaining=(timers[g.id]||0)+dt,count=0;
    while(remaining+1e-9>=interval&&count<4){
     remaining-=interval;count++;fired++;state.events++;
     runGraph(g,{event:'timer',source:'*',data:{interval:interval,count:count}});
    }
    if(count===4&&remaining>=interval)remaining=remaining%interval;
    timers[g.id]=Math.max(0,remaining);
   });
   return fired;
  }
  function activate(id,mode,time,repeated){var def=map[id];if(!def)return;time=Number(time)||0;
   allComponents(def).forEach(function(c,i){var key=id+':'+i,delay=num(c.cooldown,900,0,60000),next=cooldowns[key]||-1;
    var activation=c.activation||(c.type==='door'||c.type==='npc'||c.type==='teleporter'?'interact':'touch');if(activation!==mode)return;
    if(next>time)return;
    if(repeated&&!['damage','heal'].includes(c.type))return;
    if(c.type==='pickup'){
     if(state.picked[id])return;state.picked[id]=true;call('setVisible',id,false);call('addCoins',num(c.amount,1,0,100000));call('message',str(c.message,'Предмет получен'));emit('collect',id,{value:c.amount||1});
    }else if(c.type==='damage'){health(-num(c.amount,20,1,1000));
    }else if(c.type==='heal'){health(num(c.amount,25,1,1000));
    }else if(c.type==='checkpoint'){checkpoint(id);call('message','Контрольная точка сохранена');
    }else if(c.type==='teleporter'){call('teleportTo',c.target);call('message',str(c.message,'Телепортация'));
    }else if(c.type==='door'){call('toggleDoor',c.target||id,'toggle');
    }else if(c.type==='npc'){call('message',str(c.message,'Привет, путешественник!'));
    }
    cooldowns[key]=time+delay;
   });
  }
  function updateContacts(ids,time){var now=new Set(ids.filter(function(i){return !!map[i];}));now.forEach(function(id){if(!contacts.has(id)){activate(id,'touch',time,false);emit('touch',id,{});}else activate(id,'touch',time,true);});contacts.forEach(function(id){if(!now.has(id))emit('leave',id,{});});contacts=now;}
  function interact(id,time){activate(id,'interact',time,false);emit('interact',id,{});}
  function respawn(){state.health=state.maxHealth;call('healthChange',state.health,state.maxHealth);contacts.clear();}
  function reset(){contacts.clear();cooldowns={};timers=Object.create(null);state.health=state.maxHealth;state.checkpointId=null;state.flags={};state.counters=Object.create(null);state.picked={};state.doors={};state.deaths=0;state.lastGraph=null;call('healthChange',state.health,state.maxHealth);}
  return {state:state,emit:emit,tick:tick,activate:activate,updateContacts:updateContacts,interact:interact,damage:function(n){return health(-n);},heal:function(n){return health(n);},respawn:respawn,reset:reset,checkpoint:checkpoint,trace:function(){return graphHits.slice();},validate:function(){return validate(doc);}};
 }
 return {create:create,validate:validate,COMPONENTS:COMPONENTS,EVENTS:EVENTS,NODES:NODES};
});
