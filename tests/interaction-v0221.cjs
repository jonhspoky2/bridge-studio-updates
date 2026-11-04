/* v0.22.1 regression: Pickup must be manual unless explicitly marked touch. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../src/gameplay_core.js');
function make(activation){
 const c={type:'pickup',enabled:true,amount:3};
 if(activation)c.activation=activation;
 const doc={objects:[{id:'coin',name:'Coin',components:[c]}],graphs:[],settings:{}};
 let coins=0,hide=0,events=0;
 const game=core.create(doc,{addCoins:n=>{coins+=n;},setVisible:(id,v)=>{if(id==='coin'&&!v)hide++;},onEvent:event=>{if(event==='collect')events++;}});
 return {game,get:()=>({coins,hide,events}),doc};
}
{
 const x=make();
 assert.deepEqual(core.validate(x.doc).errors,[]);
 x.game.updateContacts(['coin'],1000);
 x.game.updateContacts(['coin'],1016);
 assert.deepEqual(x.get(),{coins:0,hide:0,events:0},'legacy pickup must not auto-collect on touch');
 x.game.interact('coin',1100);
 assert.deepEqual(x.get(),{coins:3,hide:1,events:1},'E collects exactly once');
 x.game.interact('coin',1200);
 assert.deepEqual(x.get(),{coins:3,hide:1,events:1},'repeat E must not duplicate pickup');
}
{
 const x=make('touch');
 x.game.updateContacts(['coin'],1000);
 assert.deepEqual(x.get(),{coins:3,hide:1,events:1},'explicit touch auto-pickup remains supported');
 x.game.interact('coin',1100);
 assert.equal(x.get().coins,3);
}
{
 const x=make('interact');
 x.game.updateContacts(['coin'],1000);
 assert.equal(x.get().coins,0);
 x.game.interact('coin',1100);
 assert.equal(x.get().coins,3);
}
console.log('v0.22.1 manual/explicit-touch component pickup tests passed');
