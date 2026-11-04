/* Diagnostic Terrain Paint costs: controlled Node benchmark, not Windows GPU FPS. */
'use strict';
const {performance}=require('node:perf_hooks');
const Core=require('../src/terrain_core.js'),S=require('../src/terrain_sculpt.js'),P=require('../src/terrain_paint.js');
const T={BufferGeometry:class{constructor(){this.a={}}setAttribute(k,v){this.a[k]=v}getAttribute(k){return this.a[k]}setIndex(v){this.index=v}computeBoundingBox(){}computeBoundingSphere(){}},Float32BufferAttribute:class{constructor(a,n){this.array=Float32Array.from(a);this.itemSize=n}},Mesh:class{constructor(g,m){this.geometry=g;this.material=m}},MeshStandardMaterial:class{},FrontSide:0};
function sample(xs,p){xs.sort((a,b)=>a-b);return +xs[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)].toFixed(3);}
for(const [cols,rows,segs] of [[2,2,16],[4,4,32]]){
 const terrain=S.createFlat(cols,rows,segs,1),meshes=Core.createMeshes(T,terrain);
 const stroke=P.begin(terrain,{material:'dirt',radius:4,strength:7,hardness:.35},0,0),dabs=[],buffers=[],changed=new Set();
 for(let i=0;i<55;i++){
  const x=-cols*segs*.37+(i%18)*1.8,z=-rows*segs*.3+Math.floor(i/18)*3;
  const now=performance.now(),r=P.dab(stroke,x,z,.025);dabs.push(performance.now()-now);
  const then=performance.now();P.refreshMeshes(terrain,meshes,r.chunks);buffers.push(performance.now()-then);
  r.chunks.forEach(v=>changed.add(v));
 }
 const change=P.commit(stroke);Core.validate(terrain);
 const paintBytes=Buffer.byteLength(JSON.stringify(terrain),'utf8'),historyBytes=Buffer.byteLength(JSON.stringify(change),'utf8');
 console.log(JSON.stringify({map:cols+'x'+rows+' chunks × '+segs+' segments',vertices:cols*rows*(segs+1)**2,dabP50Ms:sample(dabs,.5),dabP95Ms:sample(dabs,.95),uploadCPUOnlyP95Ms:sample(buffers,.95),touchedChunks:changed.size,paintedProjectBytes:paintBytes,undoBytes:historyBytes}));
}
