/* Terrain walking regression: sculped slopes, seams, steep ridges and high-speed sweeps. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../src/terrain_core.js');
const sculpt=require('../src/terrain_sculpt.js');
const eps=1e-6;
function near(a,b,label){assert.ok(Math.abs(a-b)<eps,label+': '+a+' versus '+b);}
function flat(){return sculpt.createFlat(2,2,16,1);}
function heightsBy(t,fun){
 for(const c of t.chunks){
  for(let z=0;z<=c.segments;z++)for(let x=0;x<=c.segments;x++)
   c.heights[z*(c.segments+1)+x]=fun(c.x+x*c.step,c.z+z*c.step);
 }
 core.validate(t);return t;
}
{
 const t=heightsBy(flat(),(x,z)=>4+x*.2);
 const x=-6,z=0,y=core.sampleHeight(t,x,z);
 const r=core.walkHeightfield(t,x,z,y,8,0,true);
 near(r.x,2,'walk X crosses chunk seam');
 near(r.z,0,'walk Z');
 near(r.y,core.sampleHeight(t,2,0),'walk follows smooth sculpted slope upward');
 core.validate(t);
}
{
 const t=heightsBy(flat(),(x,z)=>x>=0?8:0);
 let r=core.walkHeightfield(t,-3,-3,0,7,0,true);
 assert.ok(r.x<0,'steep cliff stops grounded walker before front face');
 near(r.y,0,'blocked cliff does not teleport player upward');
 r=core.walkHeightfield(t,-3,-3,1,7,0,false);
 assert.ok(r.x<0,'airborne player cannot pass through hillside');
 r=core.walkHeightfield(t,-3,-3,8.5,7,0,false);
 near(r.x,4,'airborne player above hill can pass over');
}
{
 const t=heightsBy(flat(),(x,z)=>x===0&&Math.abs(z)<=1?15:0);
 const r=core.walkHeightfield(t,-4,0,0,9,0,true);
 assert.ok(r.x<0,'high speed cannot tunnel through narrow ridge');
 assert.ok(r.x>-4,'walker approaches ridge rather than being frozen');
}
{
 const t=flat();
 const stroke=sculpt.begin(t,{mode:'raise',radius:4,strength:12,hardness:.45},0,0);
 for(let i=0;i<25;i++)sculpt.dab(stroke,0,0,.08);
 const cmd=sculpt.commit(stroke);
 assert.ok(cmd?.changes.length>0,'created real sculpted terrain by brush');
 core.validate(t);
 const start=-6,z=0,y=core.sampleHeight(t,start,z);
 const r=core.walkHeightfield(t,start,z,y,12,0,true);
 assert.ok(r.x<6,'steep sculpted hill blocks side penetration');
 const endH=core.sampleHeight(t,r.x,r.z);
 assert.ok(r.y+eps>=endH,'walker feet never sink below edited mesh');
 // Heightfield and collision use the same triangle interpolation, including shared borders.
 for(let zz=-8;zz<=8;zz+=.5){
  const a=core.sampleHeight({chunks:[t.chunks[0]]},0,zz);
  const b=core.sampleHeight({chunks:[t.chunks[1]]},0,zz);
  near(a,b,'X seam height at '+zz);
 }
}
{
 const t=flat();
 const r=core.walkHeightfield(t,15.5,0,0,2,0,true);
 near(r.x,17.5,'can leave map and fall naturally');
 near(r.y,0,'leaving map does not snap to invisible terrain');
}
{
 const r=core.walkHeightfield(null,0,0,0,2,3,false,(x,z)=>x>0);
 near(r.x,0,'old block collision preserved without terrain');
 near(r.z,3,'unblocked axis continues without terrain');
}
assert.throws(()=>core.walkHeightfield(flat(),NaN,0,0,1,1,true),/invalid walking/);
console.log('Terrain walk: slopes, cliff faces, narrow ridge, sculpted hill, seams, map boundaries and non-Terrain collisions passed.');
