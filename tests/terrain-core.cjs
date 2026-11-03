/* Terrain Core regression tests. No external dependencies. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../src/terrain_core.js');
const t=core.demoSlope();
assert.equal(core.validate(t),t);
assert.equal(t.chunks.length,2);
assert.equal(core.sampleHeight(t,100,100),null);
assert.equal(core.sampleHeight(undefined,0,0),null);
assert.equal(core.sampleHeight(t,-16,-8),t.chunks[0].heights[0]);
function h(x,z){return core.sampleHeight(t,x,z);}
for(let z=-8;z<=8;z+=.5){
 const left=core.sampleHeight({chunks:[t.chunks[0]]},0,z);
 const right=core.sampleHeight({chunks:[t.chunks[1]]},0,z);
 assert.ok(Math.abs(left-right)<1e-6,'shared X edge @ '+z);
}
const a=t.chunks[0].heights[0],b=t.chunks[0].heights[1],c=t.chunks[0].heights[17],d=t.chunks[0].heights[18];
assert.ok(Math.abs(h(-15.75,-7.5)-(a*.25+b*.25+c*.5))<1e-8,'first triangle');
assert.ok(Math.abs(h(-15.25,-7.25)-(b*.25+c*.25+d*.5))<1e-8,'second triangle');
const copy=()=>JSON.parse(JSON.stringify(t));
function rejected(mutator,match){const bad=copy();mutator(bad);assert.throws(()=>core.validate(bad),match);}
rejected(x=>x.chunks[1].heights[0]+=1,/seam/i);
rejected(x=>x.chunks[1].x=-8,/overlapping/i);
rejected(x=>x.chunks[0].heights[0]=Infinity,/invalid heights/i);
rejected(x=>x.chunks[0].heights.pop(),/invalid heights/i);
rejected(x=>x.chunks[1].step=2,/mixed resolutions/i);
rejected(x=>x.version=2,/schema version/i);
const T={
 BufferGeometry:class{setAttribute(n,v){this[n]=v;}setIndex(v){this.indices=v;}},
 Float32BufferAttribute:class{constructor(a,n){this.array=a;this.itemSize=n;}},
 Mesh:class{constructor(geometry,material){this.geometry=geometry;this.material=material;}},
 MeshStandardMaterial:class{constructor(options){this.options=options;}},
 FrontSide:0
};
const meshes=core.createMeshes(T,t);
assert.equal(meshes.length,2);
assert.equal(meshes[0].geometry.indices.length,16*16*6);
for(let chunk=0;chunk<2;chunk++){
 const vertices=meshes[chunk].geometry.position.array;
 for(let i=0;i<vertices.length;i+=3){
  assert.ok(Math.abs(vertices[i+1]-h(vertices[i],vertices[i+2]))<1e-5,'render equals collision');
 }
 const normals=meshes[chunk].geometry.normal.array;
 for(let i=0;i<normals.length;i+=3){
  assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<1e-6,'unit normals');
 }
}
console.log('Terrain Core: schema, two triangles, borders, normals and mesh/collision parity passed.');
