/* Bridge Studio Economy Core 0.18: deterministic, DOM-independent inventory/shop. */
(function(root,factory){'use strict';var api=factory();if(root)root.BridgeEconomy=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:null),function(){
 'use strict';
 function integer(value,fallback,max){var n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):fallback;}
 function cleanItem(raw){if(!raw||typeof raw.id!=='string'||(!/^[a-zA-Z0-9_-]{1,64}$/.test(raw.id)||['__proto__','constructor','prototype'].includes(raw.id)))return null;return {id:raw.id,name:String(raw.name||raw.id).slice(0,80),description:String(raw.description||'').slice(0,240),price:integer(raw.price,0,1000000),maxStack:Math.max(1,integer(raw.maxStack,99,9999)),icon:String(raw.icon||'✦').slice(0,5)};}
 function validate(doc){var errors=[],seen=new Set();if(doc.items!==undefined&&!Array.isArray(doc.items))errors.push('items должен быть массивом');(Array.isArray(doc.items)?doc.items:[]).forEach(function(raw){var item=cleanItem(raw);if(!item)errors.push('Предмет с неверным ID');else if(seen.has(item.id))errors.push('Повторный ID предмета '+item.id);else seen.add(item.id);});(doc.ui||[]).forEach(function(u){if(['buy','giveItem'].includes(u.action)&&u.itemId&&!seen.has(u.itemId))errors.push('UI '+u.name+': нет предмета '+u.itemId);});return {errors:errors,warnings:[]};}
 function create(doc,hooks){hooks=hooks||{};var catalog=(doc.items||[]).map(cleanItem).filter(Boolean),inventory=Object.create(null),purchases=Object.create(null),seq=0;
  function get(id){return catalog.find(function(v){return v.id===id;})||null;}
  function count(id){return inventory[id]||0;}
  function change(){seq++;if(typeof hooks.onChange==='function')hooks.onChange(snapshot());}
  function grant(id,amount){var item=get(id);if(!item)return {ok:false,error:'Предмет не найден'};var n=Math.max(1,integer(amount,1,9999));if(count(id)+n>item.maxStack)return {ok:false,error:'Инвентарь переполнен'};inventory[id]=count(id)+n;change();return {ok:true,item:item,count:inventory[id]};}
  function buy(id,quantity){var item=get(id);if(!item)return {ok:false,error:'Предмет не найден'};var n=Math.max(1,integer(quantity,1,9999)),price=item.price*n;if(count(id)+n>item.maxStack)return {ok:false,error:'Недостаточно места'};if(Number(hooks.getCoins&&hooks.getCoins()||0)<price)return {ok:false,error:'Не хватает монет'};if(typeof hooks.setCoins!=='function')return {ok:false,error:'Оплата недоступна'};var balance=Number(hooks.getCoins()||0);hooks.setCoins(balance-price);inventory[id]=count(id)+n;purchases[id]=(purchases[id]||0)+n;change();if(typeof hooks.onPurchase==='function')hooks.onPurchase(id,n);return {ok:true,item:item,count:inventory[id],spent:price};}
  function restore(raw){
   inventory=Object.create(null);purchases=Object.create(null);
   if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    var bag=raw.inventory&&typeof raw.inventory==='object'?raw.inventory:{},orders=raw.purchases&&typeof raw.purchases==='object'?raw.purchases:{};
    catalog.forEach(function(item){
     var n=integer(Object.prototype.hasOwnProperty.call(bag,item.id)?bag[item.id]:0,0,item.maxStack);
     if(n)inventory[item.id]=n;
     var b=integer(Object.prototype.hasOwnProperty.call(orders,item.id)?orders[item.id]:0,0,999999);
     if(b)purchases[item.id]=b;
    });
   }
   change();
  }
  function reset(){inventory=Object.create(null);purchases=Object.create(null);change();}
  function snapshot(){return {inventory:Object.assign({},inventory),purchases:Object.assign({},purchases),items:catalog.map(function(v){return Object.assign({},v);}),revision:seq};}
  return {get:get,count:count,grant:grant,buy:buy,restore:restore,reset:reset,snapshot:snapshot,list:function(){return catalog.slice();}};
 }
 return {create:create,validate:validate,cleanItem:cleanItem};
});
