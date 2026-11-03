'use strict';
const assert=require('node:assert/strict');
const core=require('../src/terrain_core.js');
const brush=require('../src/terrain_sculpt.js');
function near(a,b,epsilon=1e-5){assert.ok(Math.abs(a-b)<epsilon,a+' vs '+b);}
function cfg(mode,radius=2,strength=8,hardness=.4){return {mode,radius,strength,hardness};}
const t=brush.createFlat(2,2,16,1);
assert.equal(t.chunks.length,4);
assert.equal(t.version,1);
const s=brush.begin(t,cfg('raise',1.2,8,0),0,0);
assert.ok(brush.dab(s,0,0,.1).vertices>0);
const raised=core.sampleHeight(t,0,0);
assert.ok(raised>0);
assert.equal(core.sampleHeight(t,4,4),0);
core.validate(t); // 4-way seam and all edges must be identical
const command=brush.commit(s);
assert.equal(command.kind,'terrain-stroke');
assert.ok(command.changes.length>0);
assert.ok(JSON.stringify(command).length<JSON.stringify(t).length);
brush.applyCommand(t,command,'before');
near(core.sampleHeight(t,0,0),0);
brush.applyCommand(t,command,'after');
near(core.sampleHeight(t,0,0),raised);
const smooth=brush.begin(t,cfg('smooth',2,12,1),0,0);
brush.dab(smooth,0,0,.1);
assert.ok(core.sampleHeight(t,0,0)<raised,'Smooth reduces isolated peak');
brush.commit(smooth);
const beforeLower=core.sampleHeight(t,0,0);
const lower=brush.begin(t,cfg('lower',2,8,1),0,0);
brush.dab(lower,0,0,.08);
assert.ok(core.sampleHeight(t,0,0)<beforeLower,'Lower moves down');
brush.cancel(lower);
near(core.sampleHeight(t,0,0),beforeLower);
const flatten=brush.begin(t,{...cfg('flatten',2,12,1),target:2},0,0);
brush.dab(flatten,0,0,.1);
near(core.sampleHeight(t,0,0),2);
const flattenRecord=brush.commit(flatten);
assert.ok(flattenRecord.changes.length>0);
core.validate(t);
const empty=brush.begin(t,cfg('raise'),100,100);
assert.equal(brush.dab(empty,100,100,.05).vertices,0);
assert.equal(brush.commit(empty),null);
const pathWorld=brush.createFlat(1,1,16,1);
const path=brush.begin(pathWorld,cfg('raise',1.6,8,0),-4,0);
brush.applyPath(path,-4,0,4,0,.5);
assert.ok(core.sampleHeight(pathWorld,0,0)>0,'dragged path must not leave holes');
core.validate(pathWorld);
assert.ok(brush.commit(path).changes.length>0);
assert.throws(()=>brush.createFlat(9,9,16,1),/invalid flat/);
assert.throws(()=>brush.begin(t,{mode:'raise',radius:0,strength:1,hardness:0},0,0),/invalid brush/);
assert.throws(()=>brush.begin(t,{mode:'boom',radius:2,strength:1,hardness:0},0,0),/unsupported sculpt/);
const T={
 BufferGeometry:class {
  constructor(){this.attributes={};this.updated=0;}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k];}
  setIndex(i){this.index=i;}
  computeBoundingSphere(){this.updated++;}
  computeBoundingBox(){this.updated++;}
 },
 Float32BufferAttribute:class{constructor(array,itemSize){this.array=Float32Array.from(array);this.itemSize=itemSize;this.needsUpdate=false;}},
 Mesh:class{constructor(g,m){this.geometry=g;this.material=m;}},
 MeshStandardMaterial:class{constructor(o){this.options=o;}},
 FrontSide:0
};
const geo=t;
const meshes=core.createMeshes(T,geo);
const newRaise=brush.begin(geo,cfg('raise',1,8,1),-4,-4);
const modified=brush.dab(newRaise,-4,-4,.1).chunks;
const updated=brush.refreshMeshes(T,geo,meshes,modified);
assert.ok(updated.length>=modified.length);
for(const ci of updated){
 const c=geo.chunks[ci],pos=meshes[ci].geometry.getAttribute('position').array;
 const count=c.segments+1;
 for(let j=0;j<count;j++)for(let i=0;i<count;i++){
  const k=j*count+i;
  near(pos[3*k+1],c.heights[k]);
 }
 assert.equal(meshes[ci].geometry.getAttribute('position').needsUpdate,true);
}
brush.commit(newRaise);
core.validate(geo);
console.log('Terrain Sculpt: all four brushes, 4-way seams, stroke delta history, cancellation, drag paths, incremental buffers PASS');
