/* Bridge Terrain Paint: four normalized material weights, seam-safe strokes and delta Undo. */
(function(root){
'use strict';
var CORE=root.BridgeTerrainCore,S=root.BridgeTerrainSculpt;
if(typeof module!=='undefined'&&module.exports){CORE=CORE||require('./terrain_core.js');S=S||require('./terrain_sculpt.js');}
var NAMES=['grass','sand','dirt','rock'];
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function settings(o){
 if(!o||NAMES.indexOf(o.material)<0)throw Error('Paint: unknown material');
 var radius=Number(o.radius),strength=Number(o.strength),hardness=Number(o.hardness);
 if(!finite(radius)||radius<.5||radius>16||!finite(strength)||strength<.1||strength>12||!finite(hardness)||hardness<0||hardness>1)throw Error('Paint: invalid brush parameters');
 return {material:o.material,index:NAMES.indexOf(o.material),radius:radius,strength:strength,hardness:hardness};
}
function ensure(c){
 if(!c.weights){
  c.weights=[];
  for(var i=0;i<c.heights.length;i++)c.weights.push(255,0,0,0);
 }
 return c.weights;
}
function get(c,vertex){return [0,1,2,3].map(function(i){return CORE.weightAt(c,vertex,i);});}
function mix(current,target,alpha){
 if(alpha<=0)return current.slice();
 var next=current.slice(),k=target,old=current[k],selected=clamp(Math.round(old+alpha*(255-old)),0,255);
 next[k]=selected;var rest=255-selected,others=255-old;
 // Integer weights always sum exactly to 255, also at zero/base-color edges.
 if(others<=0){
  for(var a=0;a<4;a++)if(a!==k)next[a]=0;
  return next;
 }
 var fractions=[],used=0;
 for(var j=0;j<4;j++){if(j===k)continue;var exact=current[j]*rest/others,base=Math.floor(exact);next[j]=base;used+=base;fractions.push({i:j,rem:exact-base});}
 fractions.sort(function(a,b){return b.rem-a.rem||a.i-b.i;});
 for(var n=0;n<rest-used;n++)next[fractions[n].i]++;
 return next;
}
function begin(terrain,options,x,z){
 if(!finite(x)||!finite(z))throw Error('Paint: invalid origin');
 CORE.validate(terrain);
 return {terrain:terrain,options:settings(options),nodes:S.indexNodes(terrain),before:new Map(),created:new Set(),active:true,vertices:0};
}
function dab(stroke,x,z,dt){
 if(!stroke||!stroke.active)throw Error('Paint: stroke closed');
 if(!finite(x)||!finite(z)||!finite(dt)||dt<0)throw Error('Paint: invalid dab');
 if(dt===0)return {vertices:0,chunks:[]};
 var o=stroke.options,alphaBase=clamp(o.strength*Math.min(dt,.12),0,1);
 var dirty=new Set(),count=0;
 stroke.nodes.forEach(function(node){
  var d=Math.hypot(node.x-x,node.z-z),w=S.radiusWeight(d,o.radius,o.hardness);
  if(w<=0)return;
  var ref=node.refs[0],c=stroke.terrain.chunks[ref.chunk],before=get(c,ref.index),after=mix(before,o.index,alphaBase*w);
  if(before.every(function(v,i){return v===after[i];}))return;
  node.refs.forEach(function(q){
   var chunk=stroke.terrain.chunks[q.chunk],id=q.chunk+':'+q.index;
   if(!chunk.weights)stroke.created.add(q.chunk);
   var a=ensure(chunk);
   if(!stroke.before.has(id))stroke.before.set(id,{chunk:q.chunk,index:q.index,before:before.slice()});
   for(var k=0;k<4;k++)a[q.index*4+k]=after[k];
   dirty.add(q.chunk);
  });
  count++;
 });
 stroke.vertices+=count;
 return {vertices:count,chunks:Array.from(dirty)};
}
function applyPath(stroke,x0,z0,x1,z1,dt){
 if(!finite(x0)||!finite(z0)||!finite(x1)||!finite(z1))throw Error('Paint: invalid path');
 var span=stroke.terrain.chunks[0].step,dist=Math.hypot(x1-x0,z1-z0);
 var steps=Math.max(1,Math.min(256,Math.ceil(dist/Math.max(.15,Math.min(span*.5,stroke.options.radius/3)))));
 var dirty=new Set(),count=0;
 for(var i=1;i<=steps;i++){
  var t=i/steps,change=dab(stroke,x0+(x1-x0)*t,z0+(z1-z0)*t,dt/steps);
  change.chunks.forEach(function(k){dirty.add(k);});count+=change.vertices;
 }
 return {vertices:count,chunks:Array.from(dirty)};
}
function cancel(stroke){
 if(!stroke||!stroke.active)return [];
 stroke.active=false;
 var dirty=new Set();
 stroke.before.forEach(function(c){
  var weights=stroke.terrain.chunks[c.chunk].weights;
  if(weights)for(var k=0;k<4;k++)weights[c.index*4+k]=c.before[k];
  dirty.add(c.chunk);
 });
 stroke.created.forEach(function(i){delete stroke.terrain.chunks[i].weights;dirty.add(i);});
 CORE.validate(stroke.terrain);
 return Array.from(dirty);
}
function commit(stroke){
 if(!stroke||!stroke.active)throw Error('Paint: stroke closed');
 var changes=[];
 stroke.before.forEach(function(c){
  var chunk=stroke.terrain.chunks[c.chunk],after=get(chunk,c.index);
  if(after.some(function(v,i){return v!==c.before[i]}))changes.push({chunk:c.chunk,index:c.index,before:c.before,after:after});
 });
 stroke.active=false;
 if(!changes.length){stroke.created.forEach(function(i){delete stroke.terrain.chunks[i].weights;});return null;}
 CORE.validate(stroke.terrain);
 return {kind:'terrain-paint',changes:changes,created:Array.from(stroke.created)};
}
function applyCommand(terrain,command,direction){
 if(!terrain||!command||command.kind!=='terrain-paint'||!Array.isArray(command.changes)||!Array.isArray(command.created)||!['before','after'].includes(direction))throw Error('Paint: invalid history');
 var dirty=new Set();
 if(direction==='after')command.created.forEach(function(i){if(!terrain.chunks[i])throw Error('Paint: missing chunk');ensure(terrain.chunks[i]);});
 command.changes.forEach(function(change){
  var c=terrain.chunks[change.chunk],w=change[direction];
  if(!c||!Number.isInteger(change.index)||change.index<0||change.index>=c.heights.length||!Array.isArray(w)||w.length!==4||w.some(function(v){return !Number.isInteger(v)||v<0||v>255;})||w.reduce(function(a,b){return a+b;},0)!==255)throw Error('Paint: corrupt history');
  var weights=ensure(c);for(var k=0;k<4;k++)weights[change.index*4+k]=w[k];dirty.add(change.chunk);
 });
 if(direction==='before')command.created.forEach(function(i){if(!terrain.chunks[i])throw Error('Paint: missing chunk');delete terrain.chunks[i].weights;dirty.add(i);});
 CORE.validate(terrain);return Array.from(dirty);
}
function refreshMeshes(terrain,meshes,dirty){
 if(!terrain||!meshes||!dirty)return;
 dirty.forEach(function(ci){
  var c=terrain.chunks[ci],m=meshes[ci];if(!c||!m)return;
  var attr=m.geometry.getAttribute('terrainWeights');if(!attr)throw Error('Paint: missing GPU weight attribute');
  for(var i=0;i<c.heights.length;i++)for(var k=0;k<4;k++)attr.array[i*4+k]=CORE.weightAt(c,i,k)/255;
  attr.needsUpdate=true;
 });
}
var api={names:NAMES,settings:settings,ensure:ensure,mix:mix,begin:begin,dab:dab,applyPath:applyPath,cancel:cancel,commit:commit,applyCommand:applyCommand,refreshMeshes:refreshMeshes};
root.BridgeTerrainPaint=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
