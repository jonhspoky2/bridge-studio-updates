/* Bridge Studio v0.22: quests, inventory restoration and claims. */
'use strict';
const assert=require('node:assert/strict');
const quests=require('../src/quest_core.js');
const economyCore=require('../src/economy_core.js');
const item={id:'gem',name:'Crystal',maxStack:4,price:7};
const doc={items:[item],objects:[{id:'btn'},{id:'coin'}],quests:[
 {id:'press',title:'Press switch',event:'interact',source:'btn',required:3,rewardCoins:20,rewardItemId:'gem',rewardItemCount:2},
 {id:'buy',title:'Buy',event:'buy',source:'gem',required:2,rewardCoins:7},
 {id:'collect',title:'Collect',event:'collect',source:'coin',required:2,rewardCoins:4}
]};
assert.deepEqual(quests.validate(doc).errors,[]);
assert.deepEqual(economyCore.validate(doc).errors,[]);
let cash=50,notifies=0;
const inventory=economyCore.create(doc,{getCoins:()=>cash,setCoins:n=>{cash=n;},onPurchase:(id,n)=>q.record('buy',id,n)});
const q=quests.create(doc,{addCoins:n=>{cash+=n;},grantItem:(id,n)=>inventory.grant(id,n),onChange:()=>notifies++});
assert.equal(q.record('invalid','btn').length,0);
assert.equal(q.record('interact','other').length,0);
q.record('interact','btn');q.record('interact','btn');
assert.equal(q.list()[0].progress,2);
assert.equal(q.claim('press').ok,false,'cannot claim incomplete quest');
q.record('interact','btn');q.record('interact','btn');
assert.equal(q.list()[0].progress,3,'progress clamps');
const before=cash,good=q.claim('press');assert.equal(good.ok,true);
assert.equal(cash,before+20);
assert.equal(inventory.count('gem'),2);
assert.equal(q.claim('press').ok,false,'claim only once');
const shop=inventory.buy('gem',2);assert.equal(shop.ok,true);
assert.equal(q.list().find(x=>x.id==='buy').progress,2,'purchase adds quest progress');
assert.equal(q.claim('buy').ok,true);assert.equal(cash,63,'currency accounting: 50 +20 -14 +7');
assert.equal(q.claim('buy').ok,false);
q.record('collect','coin');q.record('collect','coin');
assert.equal(q.claim('collect').ok,true);
const bag=inventory.snapshot(),saved=q.snapshot();
const q2=quests.create(doc,{grantItem:(id,n)=>inventory.grant(id,n)});
q2.restore(saved);
assert.equal(q2.list().find(x=>x.id==='press').claimed,true);
assert.equal(q2.claim('press').ok,false,'claimed state survives restore');
const inv2=economyCore.create(doc,{});
inv2.restore(bag);assert.equal(inv2.count('gem'),4);
assert.equal(inv2.snapshot().purchases.gem,2);
inv2.restore({inventory:{gem:999,unknown:99,__proto__:123},purchases:{gem:9999999}});
assert.equal(inv2.count('gem'),4,'inventory restored within stack limit');
assert.equal(inv2.snapshot().purchases.gem,999999,'purchases bounded');
const bad=JSON.parse(JSON.stringify(doc));bad.quests[0].required=0;
assert.match(quests.validate(bad).errors.join(' '),/цель/);
bad.quests[0].required=3;bad.quests[0].rewardItemId='does-not-exist';
assert.match(quests.validate(bad).errors.join(' '),/предмет/);
bad.quests[0].rewardItemId='gem';bad.quests[0].source='ghost';
assert.match(quests.validate(bad).errors.join(' '),/источник/);
bad.quests[0].source='btn';bad.quests[1].id='press';
assert.match(quests.validate(bad).errors.join(' '),/Повторяющийся/);
q.reset();assert.equal(q.list().find(x=>x.id==='press').progress,0);
assert.ok(notifies>=3);
{
 const blocked=quests.create({quests:[{id:'q',event:'collect',source:'*',required:1,rewardCoins:100,rewardItemId:'gem',rewardItemCount:2}]},
  {grantItem:()=>({ok:false,error:'full'}),addCoins:()=>{throw Error('must not grant coins');}});
 blocked.record('collect','coin');
 assert.equal(blocked.claim('q').ok,false);
 assert.equal(blocked.list()[0].claimed,false,'cannot claim without space for item');
}
{
 const legacy=economyCore.create({items:[item]},{});
 assert.equal(legacy.buy('gem',1).ok,false,'no buy hooks fails as before');
 assert.equal(quests.validate({objects:[],items:[]}).errors.length,0,'old scene no quests is compatible');
}
console.log('v0.22 Quest/Economy: progress, claim, reward, shopping, restore and legacy tests passed');
