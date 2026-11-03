'use strict';
const assert=require('node:assert/strict');
const Core=require('../src/terrain_core.js');
const Sculpt=require('../src/terrain_sculpt.js');
const Paint=require('../src/terrain_paint.js');
const mk=()=>Sculpt.createFlat(2,2,16,1);
function clone(x){return JSON.parse(JSON.stringify(x));}
const terrain=mk(),original=clone(terrain);
Core.validate(terrain);
assert.ok(terrain.chunks.every(c=>c.weights===undefined),'legacy terrain has no paint data');
const xIndex=terrain.chunks[0].segments;
function getAt(x,z) {
 const result=[];
 terrain.chunks.forEach((c,chunk)=>{
  const vx=Math.round((x-c.x)/c.step),vz=Math.round((z-c.z)/c.step);
  if(vx>=0&&vx<=c.segments&&vz>=0&&vz<=c.segments)result.push({chunk,weights:[0,1,2,3].map(k=>Core.weightAt(c,vz*(c.segments+1)+vx,k))});
 });
 return result;
}
const s=Paint.begin(terrain,{material:'sand',radius:6,strength:10,hardness:.35},0,0);
for(let i=0;i<9;i++)Paint.dab(s,0,0,.09);
assert.equal(getAt(0,0).length,4,'shared corner has 4 references');
const center=getAt(0,0).map(x=>x.weights);
assert.ok(center[0][1]>190,'center has sand');
center.forEach(x=>assert.deepEqual(x,center[0],'corner weights identical'));
assert.deepEqual(getAt(-8,0)[0].weights,[255,0,0,0],'brush does not change distant vertices');
const payload=Paint.commit(s);
assert.ok(payload&&payload.kind==='terrain-paint'&&payload.changes.length>0,'single paint action');
Core.validate(terrain);
assert.ok(terrain.chunks.some(c=>c.weights),'paint data persisted');
const painted=clone(terrain);
assert.ok(JSON.stringify(painted).length>JSON.stringify(original).length);
Paint.applyCommand(terrain,payload,'before');
assert.deepEqual(terrain,original,'one Undo returns original legacy schema');
Paint.applyCommand(terrain,payload,'after');
assert.deepEqual(terrain,painted,'one Redo restores exactly painted weights');
const erase=Paint.begin(terrain,{material:'grass',radius:6,strength:12,hardness:.55},0,0);
Paint.applyPath(erase,-2,0,2,0,.5);
const erased=Paint.commit(erase);
assert.ok(erased&&Core.weightAt(terrain.chunks[0],16*17+16,0)>0,'painting grass erases sand');
Core.validate(terrain);
Paint.applyCommand(terrain,erased,'before');
assert.deepEqual(terrain,painted,'grass erasing undone as one action');
const cancel=Paint.begin(terrain,{material:'rock',radius:5,strength:9,hardness:.5},0,0);
Paint.dab(cancel,0,0,.1);
Paint.cancel(cancel);
assert.deepEqual(terrain,painted,'cancel restores exact project');
assert.equal(Paint.mix([255,0,0,0],2,.05).reduce((a,b)=>a+b),255,'weights normalized');
assert.deepEqual(Paint.mix([0,255,0,0],1,1),[0,255,0,0],'repainting same channel no-op');
const noOp=Paint.begin(terrain,{material:'sand',radius:.5,strength:1,hardness:0},999,999);
assert.equal(Paint.dab(noOp,999,999,.09).vertices,0);
assert.equal(Paint.commit(noOp),null,'empty stroke makes no history');
for(const bad of [{...clone(terrain),chunks:[{...terrain.chunks[0],weights:[255]}]},{...clone(terrain),chunks:terrain.chunks.map(c=>({...c,weights:Array(c.heights.length*4).fill(0)}))}]){
 assert.throws(()=>Core.validate(bad),/paint/i,'invalid paint arrays rejected');
}
const seam=clone(painted);
seam.chunks[0].weights[16*4+1]+=1;seam.chunks[0].weights[16*4]-=1;
assert.throws(()=>Core.validate(seam),/paint seam/i,'paint seam mismatch rejected');
const mock={
 BufferGeometry:class{constructor(){this.attrs={};}setAttribute(n,v){this.attrs[n]=v;}getAttribute(n){return this.attrs[n];}setIndex(i){this.index=i;}computeBoundingBox(){}computeBoundingSphere(){}},
 Float32BufferAttribute:class{constructor(data,n){this.array=Float32Array.from(data);this.itemSize=n;}},MeshStandardMaterial:class{},Mesh:class{constructor(g,m){this.geometry=g;this.material=m;}},FrontSide:0
};
const meshes=Core.createMeshes(mock,painted);
assert.equal(meshes.length,4);
assert.equal(meshes[0].geometry.getAttribute('terrainWeights').itemSize,4);
const third=clone(painted);
const ink=Paint.begin(third,{material:'rock',radius:2,strength:12,hardness:1},-8,-8);
const res=Paint.dab(ink,-8,-8,.1);
assert.ok(res.chunks.length<4,'incremental paint dirty chunks');
Paint.refreshMeshes(third,meshes,res.chunks);
res.chunks.forEach(i=>assert.equal(meshes[i].geometry.getAttribute('terrainWeights').needsUpdate,true));
Paint.commit(ink);
const shaped=clone(painted);
const sculpture=Sculpt.begin(shaped,{mode:'raise',radius:3,strength:8,hardness:.5},2,2);
Sculpt.dab(sculpture,2,2,.06);Sculpt.commit(sculpture);
Core.validate(shaped);assert.ok(shaped.chunks.some(c=>c.heights.some(h=>h!==0)),'sculpt and paint coexist');
assert.deepEqual(shaped.chunks.map(c=>c.weights),painted.chunks.map(c=>c.weights),'sculpt retains paint layers');
console.log('Terrain Paint: four weights, grass erase, 4-way seams, legacy Undo, cancel, mixed sculpt, GPU dirty chunks PASS');
