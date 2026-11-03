/* Bridge Terrain Core v1: shared mesh + triangle-exact surface sampling. */
(function(root){
'use strict';
var EPS=1e-6;
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function near(a,b){return Math.abs(a-b)<=EPS;}
function validate(t){
 if(!t||typeof t!=='object'||t.version!==1||!Array.isArray(t.chunks))throw Error('Terrain: unsupported schema version');
 if(t.chunks.length>64)throw Error('Terrain: too many chunks');
 var count=0,first=null;
 t.chunks.forEach(function(c,n){
  if(!c||!finite(c.x)||!finite(c.z)||!Number.isInteger(c.segments)||c.segments<2||c.segments>64||!finite(c.step)||c.step<=0||c.step>16)throw Error('Terrain: invalid chunk '+n);
  if(!Array.isArray(c.heights)||c.heights.length!==(c.segments+1)*(c.segments+1)||c.heights.some(function(h){return !finite(h)||Math.abs(h)>1000;}))throw Error('Terrain: invalid heights '+n);
  count+=c.heights.length;if(count>100000)throw Error('Terrain: vertex budget exceeded');
  if(first&&(!near(first.step,c.step)||first.segments!==c.segments))throw Error('Terrain: mixed resolutions unsupported in v1');
  first=first||c;
 });
 if(!first)return t;
 var span=first.segments*first.step,side=first.segments+1;
 for(var i=0;i<t.chunks.length;i++)for(var j=i+1;j<t.chunks.length;j++){
  var a=t.chunks[i],b=t.chunks[j],dx=b.x-a.x,dz=b.z-a.z;
  if(Math.abs(dx)<span-EPS&&Math.abs(dz)<span-EPS)throw Error('Terrain: overlapping chunks');
  if(near(Math.abs(dx),span)&&near(dz,0))
   for(var k=0;k<side;k++)if(!near(a.heights[k*side+(dx>0?side-1:0)],b.heights[k*side+(dx>0?0:side-1)]))throw Error('Terrain: X seam mismatch');
  if(near(Math.abs(dz),span)&&near(dx,0))
   for(var p=0;p<side;p++)if(!near(a.heights[(dz>0?side-1:0)*side+p],b.heights[(dz>0?0:side-1)*side+p]))throw Error('Terrain: Z seam mismatch');
 }
 return t;
}
function sampleHeight(t,x,z){
 if(!t||!Array.isArray(t.chunks)||!finite(x)||!finite(z))return null;
 for(var n=0;n<t.chunks.length;n++){
  var c=t.chunks[n],rx=(x-c.x)/c.step,rz=(z-c.z)/c.step;
  if(rx<-EPS||rz<-EPS||rx>c.segments+EPS||rz>c.segments+EPS)continue;
  rx=Math.max(0,Math.min(c.segments,rx));rz=Math.max(0,Math.min(c.segments,rz));
  var ix=Math.min(c.segments-1,Math.floor(rx)),iz=Math.min(c.segments-1,Math.floor(rz)),u=rx-ix,v=rz-iz,side=c.segments+1,k=iz*side+ix;
  var a=c.heights[k],b=c.heights[k+1],cc=c.heights[k+side],d=c.heights[k+side+1];
  return u+v<=1?a*(1-u-v)+b*u+cc*v:b*(1-v)+cc*(1-u)+d*(u+v-1);
 }
 return null;
}
function createMeshes(T,t){
 if(!t)return [];
 validate(t);
 return t.chunks.map(function(c,n){
  var side=c.segments+1,positions=[],normals=[],indices=[],eps=c.step;
  for(var j=0;j<side;j++)for(var i=0;i<side;i++){
   var x=c.x+i*c.step,z=c.z+j*c.step,h=c.heights[j*side+i];
   positions.push(x,h,z);
   var l=sampleHeight(t,x-eps,z),r=sampleHeight(t,x+eps,z),b=sampleHeight(t,x,z-eps),f=sampleHeight(t,x,z+eps);
   var ddx=((r===null?h:r)-(l===null?h:l))/((r!==null&&l!==null?2:1)*eps);
   var ddz=((f===null?h:f)-(b===null?h:b))/((f!==null&&b!==null?2:1)*eps);
   var mag=Math.hypot(ddx,1,ddz)||1;normals.push(-ddx/mag,1/mag,-ddz/mag);
  }
  for(var z=0;z<c.segments;z++)for(var x=0;x<c.segments;x++){
   var a=z*side+x,cc=a+side;indices.push(a,cc,a+1,a+1,cc,cc+1);
  }
  var g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setIndex(indices);
  var mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:0x426b4f,roughness:.96,metalness:0,side:T.FrontSide}));
  mesh.name='Terrain '+(n+1);mesh.receiveShadow=true;mesh.castShadow=false;return mesh;
 });
}
function demoSlope(){
 var t={version:1,chunks:[]};
 [-16,0].forEach(function(x){
  var hs=[];
  for(var j=0;j<=16;j++)for(var i=0;i<=16;i++){
   var wx=x+i,wz=-8+j;
   hs.push(Math.round(Math.max(0,2.2+wx*.13+.25*Math.sin(wz*.25))*1000)/1000);
  }
  t.chunks.push({x:x,z:-8,step:1,segments:16,heights:hs});
 });
 return validate(t);
}
var api={validate:validate,sampleHeight:sampleHeight,createMeshes:createMeshes,demoSlope:demoSlope};
root.BridgeTerrainCore=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
