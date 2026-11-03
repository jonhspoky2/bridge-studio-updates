/* Relative Terrain Sculpt performance measurement; non-fatal diagnostic, not invented FPS. */
'use strict';
const {performance}=require('node:perf_hooks');
const core=require('../src/terrain_core.js');
const s=require('../src/terrain_sculpt.js');
const T={
 BufferGeometry:class{
  constructor(){this.attrs={};this.index=null;}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
  setIndex(v){this.index=v;}computeBoundingBox(){}computeBoundingSphere(){}
 },
 Float32BufferAttribute:class{constructor(a,itemSize){this.array=Float32Array.from(a);this.itemSize=itemSize;this.needsUpdate=false;}},
 Mesh:class{constructor(g,m){this.geometry=g;this.material=m;}},
 MeshStandardMaterial:class{},
 FrontSide:0
};
const sample=(arr,p)=>arr[Math.min(arr.length-1,Math.floor(arr.length*p))];
for(const [cols,rows,segments] of [[2,2,16],[4,4,32]]){
 const t=s.createFlat(cols,rows,segments,1),start=performance.now(),meshes=core.createMeshes(T,t),buildMs=performance.now()-start;
 const coreTimes=[],gpuTimes=[];
 const stroke=s.begin(t,{mode:'raise',radius:4,strength:5,hardness:.35},0,0);
 for(let i=0;i<30;i++){
  const x=-segments*.45+Math.floor(i/3)*2.25,z=-segments*.35+Math.sin(i*.7)*3;
  const begin=performance.now(),r=s.dab(stroke,x,z,.022);coreTimes.push(performance.now()-begin);
  const render=performance.now();s.refreshMeshes(T,t,meshes,r.chunks,stroke.nodes,true);gpuTimes.push(performance.now()-render);
 }
 core.validate(t);const cmd=s.commit(stroke),bytes=JSON.stringify(cmd).length;
 function summary(arr){arr.sort((a,b)=>a-b);return {p50_ms:+sample(arr,.5).toFixed(3),p95_ms:+sample(arr,.95).toFixed(3),max_ms:+arr.at(-1).toFixed(3)};}
 console.log(JSON.stringify({map:cols+'x'+rows+' chunks of '+segments+'x'+segments,vertices:cols*rows*(segments+1)**2,buildMs:+buildMs.toFixed(3),dab:summary(coreTimes),incremental:summary(gpuTimes),strokeDeltaBytes:bytes,terrainJSONBytes:JSON.stringify(t).length}));
}
