/* v0.19.3 slope physics regression. */
'use strict';
const assert=require('node:assert/strict');
const core=require('../src/terrain_core.js');
const almost=(a,b,msg,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,msg+': '+a+' vs '+b);
function plane(deg){
 const gradient=Math.tan(deg*Math.PI/180),c={x:-8,z:-8,segments:16,step:1,heights:[]};
 for(let z=0;z<=16;z++)for(let x=0;x<=16;x++)c.heights.push((x-8)*gradient);
 return core.validate({version:1,chunks:[c]});
}
for(const angle of [0,15,30,44,45,46,60,80,89]){
 const t=plane(angle),x=-3,z=0,s=core.sampleSurface(t,x,z);
 almost(s.height,core.sampleHeight(t,x,z),'surface matches collision '+angle);
 almost(s.slopeDeg,angle,'triangle slope '+angle,1e-8);
 almost(Math.hypot(...s.normal),1,'unit normal '+angle);
 const r=core.walkHeightfield(t,x,z,s.height,2,0,true,null,45);
 if(angle<=45){
  almost(r.x,-1,'walkable slope '+angle);
  almost(r.y,core.sampleHeight(t,r.x,z),'ground contact '+angle);
 }else{
  almost(r.x,x,'steep ascent rejected '+angle);
  almost(r.y,s.height,'no snap upwards '+angle);
  const side=core.walkHeightfield(t,x,z,s.height,0,2,true,null,45);
  almost(side.z,2,'tangential walking '+angle);
  const down=core.walkHeightfield(t,x,z,s.height,-1,0,true,null,45);
  assert.ok(down.x<x,'downhill movement possible '+angle);
  const slide=core.slideHeightfield(t,x,z,s.height,3,.016,null,45);
  assert.equal(slide.sliding,true,'slide starts '+angle);
  assert.ok(slide.x<x,'slide direction downhill '+angle);
  assert.ok(slide.y<=s.height+1e-6,'no sliding uphill '+angle);
 }
}
for(const dt of [1/20,1/30,1/60,1/144]){
 const t=plane(60),y=core.sampleHeight(t,-3,0);
 let p={x:-3,z:0,y};
 for(let i=0;i<Math.round(1/dt);i++)p=core.walkHeightfield(t,p.x,p.z,p.y,5*dt,0,true,null,45);
 almost(p.x,-3,'speed-independent steep collision '+dt);
}
{
 const t=plane(45),y=core.sampleHeight(t,-3,0);
 almost(core.walkHeightfield(t,-3,0,y,2,0,true,null,30).x,-3,'configurable angle 30');
 assert.equal(core.slideHeightfield(t,-3,0,y,3,.016,null,45).sliding,false,'no sliding on walkable slope');
}
{
 const t=plane(60),y=core.sampleHeight(t,-3,0);
 almost(core.slideHeightfield(t,-3,0,y,3,.016,()=>true,45).x,-3,'object collider blocks slide');
 assert.equal(core.sampleSurface(t,100,100),null,'outside map');
}
{
 const c1={x:-16,z:-8,step:1,segments:16,heights:[]},c2={x:0,z:-8,step:1,segments:16,heights:[]};
 for(const c of [c1,c2])for(let j=0;j<=16;j++)for(let i=0;i<=16;i++)c.heights.push((c.x+i)*Math.tan(30*Math.PI/180));
 const t=core.validate({version:1,chunks:[c1,c2]});
 almost(core.sampleSurface(t,0,0).slopeDeg,30,'seam slope');
 const p=core.walkHeightfield(t,-1,0,core.sampleHeight(t,-1,0),2,0,true,null,45);
 almost(p.x,1,'walk across seam');
}
console.log('v0.19.3 slope: triangle angles, 45-degree limit, sliding, FPS, blockers, custom limit, seams passed');
