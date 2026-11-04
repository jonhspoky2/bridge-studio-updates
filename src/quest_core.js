/* Bridge Studio Quest Core v0.22 — deterministic, DOM-independent quest progress.
   Quest definitions live in .rwscene; player progress does not. */
(function(root,factory){'use strict';var api=factory();if(root)root.BridgeQuests=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
 'use strict';
 var EVENTS=['collect','interact','buy'];
 var VALID_ID=/^[A-Za-z0-9_-]{1,64}$/;
 function count(value,fallback,max){var n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):fallback;}
 function cleanQuest(q){
  if(!q||typeof q.id!=='string'||(!VALID_ID.test(q.id)||['__proto__','constructor','prototype'].includes(q.id)))return null;
  return {id:q.id,title:String(q.title||q.id).slice(0,90),
   description:String(q.description||'').slice(0,220),event:q.event,
   requiresQuestId:typeof q.requiresQuestId==='string'?q.requiresQuestId.slice(0,64):'',
   source:typeof q.source==='string'?q.source:'*',required:Math.max(1,count(q.required,1,1000)),
   rewardCoins:count(q.rewardCoins,0,100000),rewardItemId:String(q.rewardItemId||'').slice(0,64),
   rewardItemCount:Math.max(1,count(q.rewardItemCount,1,9999))};
 }
 function validate(doc){
  doc=doc||{};var errors=[],quests=doc.quests||[],items=(doc.items||[]).map(function(i){return i.id;}),
   objects=(doc.objects||[]).map(function(o){return o.id;}),ids=new Set(),dependencies=Object.create(null);
  if(!Array.isArray(quests))return {errors:['quests должен быть массивом'],warnings:[]};
  if(quests.length>100)errors.push('Не более 100 заданий');
  quests.forEach(function(raw){
   var q=cleanQuest(raw);if(!q){errors.push('Неверный ID задания');return;}
   if(ids.has(q.id))errors.push('Повторяющийся ID задания '+q.id);ids.add(q.id);dependencies[q.id]=q.requiresQuestId;
   if(EVENTS.indexOf(q.event)<0)errors.push('Недопустимое событие задания '+q.id);
   if(!Number.isInteger(raw.required)||raw.required<1||raw.required>1000)errors.push('Некорректная цель задания '+q.id);
   if(raw.rewardCoins!==undefined&&(!Number.isInteger(raw.rewardCoins)||raw.rewardCoins<0||raw.rewardCoins>100000))errors.push('Некорректная награда задания '+q.id);
   if(q.source!=='*'&&!(q.event==='buy'?items:objects).includes(q.source))errors.push('Отсутствует источник задания '+q.id);
   if(q.rewardItemId&&!items.includes(q.rewardItemId))errors.push('Неизвестный предмет награды '+q.id);
  });
  Object.keys(dependencies).forEach(function(id){var requirement=dependencies[id];
   if(requirement&&requirement===id)errors.push('Задание '+id+' не может зависеть от самого себя');
   else if(requirement&&!ids.has(requirement))errors.push('Не найдено предыдущее задание '+requirement+' для '+id);
  });
  var marks=Object.create(null),cycleReported=false;
  function visit(id){
   if(marks[id]===2)return;
   if(marks[id]===1){if(!cycleReported)errors.push('Циклическая зависимость заданий');cycleReported=true;return;}
   marks[id]=1;var previous=dependencies[id];
   if(previous&&Object.prototype.hasOwnProperty.call(dependencies,previous))visit(previous);
   marks[id]=2;
  }
  Object.keys(dependencies).forEach(visit);
  return {errors:errors,warnings:[]};
 }
 function create(doc,hooks){
  hooks=hooks||{};var catalog=(Array.isArray(doc&&doc.quests)?doc.quests:[]).map(cleanQuest).filter(function(q){return q&&EVENTS.includes(q.event);});
  var progress=Object.create(null),claimed=Object.create(null),revision=0;
  function notify(){revision++;if(typeof hooks.onChange==='function')hooks.onChange(snapshot());}
  function record(event,source,quantity){
   if(EVENTS.indexOf(event)<0)return [];
   // Omitted quantity is one event; explicit invalid or non-positive values
   // must not manufacture quest progress from malformed graph events.
   if(quantity!==undefined&&(!Number.isFinite(Number(quantity))||Number(quantity)<1))return [];
   var n=Math.max(1,count(quantity,1,9999)),changed=[];
   catalog.forEach(function(q){
    if(q.event!==event||(q.source!=='*'&&q.source!==source)||claimed[q.id]||(q.requiresQuestId&&!claimed[q.requiresQuestId]))return;
    var old=progress[q.id]||0,next=Math.min(q.required,old+n);
    if(next!==old){progress[q.id]=next;changed.push(q.id);}
   });
   if(changed.length)notify();
   return changed;
  }
  function claim(id){
   var q=catalog.find(function(v){return v.id===id;});
   if(!q)return {ok:false,error:'Задание не найдено'};
   if(claimed[id])return {ok:false,error:'Награда уже получена'};
   if(q.requiresQuestId&&!claimed[q.requiresQuestId])return {ok:false,error:'Сначала заверши предыдущее задание'};
   if((progress[id]||0)<q.required)return {ok:false,error:'Задание ещё не выполнено'};
   if(q.rewardItemId){
    if(typeof hooks.grantItem!=='function')return {ok:false,error:'Невозможно выдать предмет'};
    var result=hooks.grantItem(q.rewardItemId,q.rewardItemCount);
    if(!result||result.ok!==true)return {ok:false,error:result&&result.error||'Не удалось выдать предмет'};
   }
   // Mark claimed before broadcasting any external coin updates, preventing reentry.
   claimed[id]=true;
   if(q.rewardCoins&&typeof hooks.addCoins==='function')hooks.addCoins(q.rewardCoins);
   notify();return {ok:true,quest:q,coins:q.rewardCoins};
  }
  function snapshot(){return {progress:Object.assign({},progress),claimed:Object.assign({},claimed),
    quests:catalog.map(function(q){return Object.assign({},q,{progress:progress[q.id]||0,claimed:!!claimed[q.id],locked:!!(q.requiresQuestId&&!claimed[q.requiresQuestId])});}),revision:revision};}
  function restore(data){
   progress=Object.create(null);claimed=Object.create(null);
   if(data&&typeof data==='object'&&!Array.isArray(data)){
    var inp=data.progress&&typeof data.progress==='object'?data.progress:{},
     done=data.claimed&&typeof data.claimed==='object'?data.claimed:{};
    catalog.forEach(function(q){
     var value=count(Object.prototype.hasOwnProperty.call(inp,q.id)?inp[q.id]:0,0,q.required);
     if(value)progress[q.id]=value;
     if(done[q.id]===true&&value===q.required)claimed[q.id]=true;
    });
    // A loaded save must not unlock successors if its prerequisite is unclaimed
    // (including saves authored before quest chains existed).
    for(var pass=0;pass<catalog.length;pass++)catalog.forEach(function(q){
     if(q.requiresQuestId&&!claimed[q.requiresQuestId]){delete progress[q.id];delete claimed[q.id];}
    });
   }
   notify();
  }
  function reset(){progress=Object.create(null);claimed=Object.create(null);notify();}
  return {record:record,claim:claim,restore:restore,reset:reset,snapshot:snapshot,list:function(){return snapshot().quests;},validate:function(){return validate(doc);}};
 }
 return {create:create,validate:validate,cleanQuest:cleanQuest,EVENTS:EVENTS};
});
