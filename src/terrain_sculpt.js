/* Terrain Sculpt Engine v1: editor-side, deterministic, seam-safe, delta history. */
(function(root){
'use strict';
var CORE=root.BridgeTerrainCore;
if(!CORE&&typeof module!=='undefined'&&module.exports)CORE=require('./terrain_core.js');
function num(v){return typeof v==='number'&&Number.isFinite(v);}
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function key(x,z){return x.toFixed(6)+'|'+z.toFixed(6);}
function cloneChunkCount(t){return t.chunks.length;}
function createFlat(cols,rows,segments,step){
 cols=Number(cols);rows=Number(rows);segments=Number(segments);step=Number(step);
 if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols*rows>64||!Number.isInteger(segments)||segments<2||segments>64||!num(step)||step<=0||step>16||cols*rows*(segments+1)*(segments+1)>100000)
  throw Error('Terrain: invalid flat grid dimensions');
 var t={version:1,chunks:[]},span=segments*step;
 for(var z=0;z<rows;z++)for(var x=0;x<cols;x++){
  t.chunks.push({x:(x-cols/2)*span,z:(z-rows/2)*span,step:step,segments:segments,heights:Array((segments+1)*(segments+1)).fill(0)});
 }
 return CORE.validate(t);
}
function indexNodes(terrain){
 CORE.validate(terrain);
 var nodes=new Map();
 terrain.chunks.forEach(function(c,chunk){
  var w=c.segments+1;
  for(var z=0;z<w;z++)for(var x=0;x<w;x++){
   var worldX=c.x+x*c.step,worldZ=c.z+z*c.step,k=key(worldX,worldZ),node=nodes.get(k);
   if(!node){node={x:worldX,z:worldZ,refs:[]};nodes.set(k,node);}
   node.refs.push({chunk:chunk,index:z*w+x});
  }
 });
 return nodes;
}
function config(o){
 if(!o||['raise','lower','smooth','flatten'].indexOf(o.mode)<0)throw Error('Terrain: unsupported sculpt mode');
 var radius=Number(o.radius),strength=Number(o.strength),hardness=Number(o.hardness);
 if(!num(radius)||radius<.5||radius>16||!num(strength)||strength<=0||strength>12||!num(hardness)||hardness<0||hardness>1)throw Error('Terrain: invalid brush configuration');
 return {mode:o.mode,radius:radius,strength:strength,hardness:hardness};
}
function begin(terrain,options,x,z){
 if(!num(x)||!num(z))throw Error('Terrain: invalid stroke origin');
 var brush=config(options),nodeIndex=indexNodes(terrain);
 return {terrain:terrain,nodes:nodeIndex,options:brush,before:new Map(),dirty:new Set(),active:true,
   target:brush.mode==='flatten'?(num(options.target)?clamp(options.target,-1000,1000):CORE.sampleHeight(terrain,x,z)):null,
   samples:0,points:0};
}
function radiusWeight(dist,radius,hardness){
 if(dist>=radius)return 0;
 if(dist<=radius*hardness)return 1;
 var span=radius*(1-hardness);
 if(span<=1e-9)return 1;
 var u=clamp((radius-dist)/span,0,1);
 return u*u*(3-2*u);
}
function dab(stroke,x,z,dt){
 if(!stroke||!stroke.active)throw Error('Terrain: stroke is closed');
 if(!num(x)||!num(z)||!num(dt)||dt<0)throw Error('Terrain: invalid dab');
 if(dt===0)return {vertices:0,chunks:[]};
 var terrain=stroke.terrain,options=stroke.options,r=options.radius,strength=options.strength,step=terrain.chunks[0]&&terrain.chunks[0].step||1;
 // One dab is time-limited to prevent huge jumps after tab suspension.
 var influence=clamp(strength*Math.min(.12,dt),0,12);
 var targets=[],visited=new Set();
 for(var ci=0;ci<terrain.chunks.length;ci++){
  var c=terrain.chunks[ci],extent=c.step*c.segments;
  if(c.x> x+r||c.x+extent<x-r||c.z>z+r||c.z+extent<z-r)continue;
  var minX=clamp(Math.ceil((x-r-c.x)/c.step),0,c.segments),maxX=clamp(Math.floor((x+r-c.x)/c.step),0,c.segments);
  var minZ=clamp(Math.ceil((z-r-c.z)/c.step),0,c.segments),maxZ=clamp(Math.floor((z+r-c.z)/c.step),0,c.segments);
  for(var j=minZ;j<=maxZ;j++)for(var i=minX;i<=maxX;i++){
   var px=c.x+i*c.step,pz=c.z+j*c.step,k=key(px,pz);
   if(visited.has(k))continue;visited.add(k);
   var dist=Math.hypot(px-x,pz-z),weight=radiusWeight(dist,r,options.hardness);
   if(weight<=0)continue;
   var node=stroke.nodes.get(k);if(!node)continue;
   var current=terrain.chunks[node.refs[0].chunk].heights[node.refs[0].index],next=current;
   var alpha=clamp(influence*weight,0,1);
   if(options.mode==='raise')next=current+influence*weight;
   else if(options.mode==='lower')next=current-influence*weight;
   else if(options.mode==='flatten'){
    if(stroke.target===null)continue;
    next=current+(stroke.target-current)*alpha;
   }else{
    // Read source heights before writing any vertex of this dab.
    var total=current,count=1;
    for(var dz=-1;dz<=1;dz++)for(var dx=-1;dx<=1;dx++){
     if(dx===0&&dz===0)continue;
     var n=stroke.nodes.get(key(px+dx*step,pz+dz*step));
     if(n){total+=terrain.chunks[n.refs[0].chunk].heights[n.refs[0].index];count++;}
    }
    next=current+(total/count-current)*alpha;
   }
   next=Math.round(clamp(next,-1000,1000)*100000)/100000;
   if(next!==current)targets.push({node:node,value:next});
  }
 }
 var dirty=new Set();
 targets.forEach(function(change){
  change.node.refs.forEach(function(ref){
   var c=terrain.chunks[ref.chunk],old=c.heights[ref.index],id=ref.chunk+':'+ref.index;
   if(!stroke.before.has(id))stroke.before.set(id,{chunk:ref.chunk,index:ref.index,before:old});
   c.heights[ref.index]=change.value;dirty.add(ref.chunk);stroke.dirty.add(ref.chunk);
  });
 });
 stroke.samples++;stroke.points+=targets.length;
 return {vertices:targets.length,chunks:Array.from(dirty)};
}
function applyPath(stroke,x0,z0,x1,z1,dt){
 if(!num(x0)||!num(z0)||!num(x1)||!num(z1))throw Error('Terrain: invalid brush path');
 var distance=Math.hypot(x1-x0,z1-z0),step=stroke.terrain.chunks[0]?.step||1;
 var increments=Math.max(1,Math.min(256,Math.ceil(distance/Math.max(.15,Math.min(step*.5,stroke.options.radius/3)))));
 var dirty=new Set(),count=0;
 for(var k=1;k<=increments;k++){
  var u=k/increments,result=dab(stroke,x0+(x1-x0)*u,z0+(z1-z0)*u,dt/increments);
  result.chunks.forEach(function(n){dirty.add(n);});count+=result.vertices;
 }
 return {vertices:count,chunks:Array.from(dirty)};
}
function commit(stroke){
 if(!stroke.active)throw Error('Terrain: stroke is closed');
 stroke.active=false;var changed=[];
 stroke.before.forEach(function(r){
  var after=stroke.terrain.chunks[r.chunk].heights[r.index];
  if(after!==r.before)changed.push({chunk:r.chunk,index:r.index,before:r.before,after:after});
 });
 if(!changed.length)return null;
 CORE.validate(stroke.terrain);
 return {kind:'terrain-stroke',changes:changed};
}
function applyCommand(terrain,command,direction){
 if(!command||command.kind!=='terrain-stroke'||!Array.isArray(command.changes)||!['before','after'].includes(direction))throw Error('Terrain: invalid stroke history');
 var dirty=new Set();
 command.changes.forEach(function(change){
  if(!terrain.chunks[change.chunk]||!num(change[direction])||change.index<0||change.index>=terrain.chunks[change.chunk].heights.length)throw Error('Terrain: corrupted history change');
  terrain.chunks[change.chunk].heights[change.index]=change[direction];dirty.add(change.chunk);
 });
 CORE.validate(terrain);
 return Array.from(dirty);
}
function cancel(stroke){
 if(!stroke.active)return [];
 stroke.active=false;
 var dirty=new Set();
 stroke.before.forEach(function(r){stroke.terrain.chunks[r.chunk].heights[r.index]=r.before;dirty.add(r.chunk);});
 return Array.from(dirty);
}
function dirtyWithNeighbors(terrain,indices){
 var dirty=new Set(indices),chunks=terrain.chunks;
 indices.forEach(function(i){
  var a=chunks[i];if(!a)return;
  var span=a.segments*a.step;
  chunks.forEach(function(b,j){
   if(Math.abs(a.x-b.x)<=span+1e-6&&Math.abs(a.z-b.z)<=span+1e-6)dirty.add(j);
  });
 });
 return Array.from(dirty);
}
function refreshMeshes(T,terrain,meshes,changed,topology){
 if(!changed||!changed.length)return [];
 var affected=dirtyWithNeighbors(terrain,changed),step=terrain.chunks[0].step;
 var nodes=topology||indexNodes(terrain);
 function at(x,z){var n=nodes.get(key(x,z));return n?terrain.chunks[n.refs[0].chunk].heights[n.refs[0].index]:null;}
 affected.forEach(function(ci){
  var c=terrain.chunks[ci],mesh=meshes[ci];
  if(!mesh||!mesh.geometry)return;
  var geometry=mesh.geometry,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  if(!positions||!normals)throw Error('Terrain: missing geometry attributes');
  var count=c.segments+1,epsilon=step;
  for(var z=0;z<count;z++)for(var x=0;x<count;x++){
   var i=z*count+x,wx=c.x+x*c.step,wz=c.z+z*c.step,h=c.heights[i];
   positions.array[i*3+1]=h;
   var left=at(wx-epsilon,wz),right=at(wx+epsilon,wz);
   var back=at(wx,wz-epsilon),front=at(wx,wz+epsilon);
   var dx=((right===null?h:right)-(left===null?h:left))/((right!==null&&left!==null?2:1)*epsilon);
   var dz=((front===null?h:front)-(back===null?h:back))/((front!==null&&back!==null?2:1)*epsilon);
   var length=Math.hypot(dx,1,dz)||1;
   normals.array[i*3]=-dx/length;normals.array[i*3+1]=1/length;normals.array[i*3+2]=-dz/length;
  }
  positions.needsUpdate=true;normals.needsUpdate=true;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
 });
 return affected;
}
var api={createFlat:createFlat,indexNodes:indexNodes,begin:begin,dab:dab,applyPath:applyPath,commit:commit,cancel:cancel,applyCommand:applyCommand,refreshMeshes:refreshMeshes,dirtyWithNeighbors:dirtyWithNeighbors,radiusWeight:radiusWeight,config:config};
root.BridgeTerrainSculpt=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
