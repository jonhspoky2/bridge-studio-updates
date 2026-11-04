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
  if(c.weights!==undefined){
   if(!Array.isArray(c.weights)||c.weights.length!==c.heights.length*4)throw Error('Terrain: invalid paint weights '+n);
   for(var w=0;w<c.weights.length;w+=4){
    var sum=0;
    for(var k=0;k<4;k++){var v=c.weights[w+k];if(!Number.isInteger(v)||v<0||v>255)throw Error('Terrain: invalid paint channel '+n);sum+=v;}
    if(sum!==255)throw Error('Terrain: paint weights must sum to 255');
   }
  }
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
   for(var k=0;k<side;k++){
    var ai=k*side+(dx>0?side-1:0),bi=k*side+(dx>0?0:side-1);
    if(!near(a.heights[ai],b.heights[bi]))throw Error('Terrain: X seam mismatch');
    for(var v=0;v<4;v++)if(weightAt(a,ai,v)!==weightAt(b,bi,v))throw Error('Terrain: X paint seam mismatch');
   }
  if(near(Math.abs(dz),span)&&near(dx,0))
   for(var p=0;p<side;p++){
    var ai=(dz>0?side-1:0)*side+p,bi=(dz>0?0:side-1)*side+p;
    if(!near(a.heights[ai],b.heights[bi]))throw Error('Terrain: Z seam mismatch');
    for(var v=0;v<4;v++)if(weightAt(a,ai,v)!==weightAt(b,bi,v))throw Error('Terrain: Z paint seam mismatch');
   }
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

/* Exact triangle gradients: no averaging that could hide an impassable cliff. */
function sampleSurface(t,x,z){
 if(!t||!Array.isArray(t.chunks)||!finite(x)||!finite(z))return null;
 for(var n=0;n<t.chunks.length;n++){
  var c=t.chunks[n],rx=(x-c.x)/c.step,rz=(z-c.z)/c.step;
  if(rx<-EPS||rz<-EPS||rx>c.segments+EPS||rz>c.segments+EPS)continue;
  rx=Math.max(0,Math.min(c.segments,rx));rz=Math.max(0,Math.min(c.segments,rz));
  var ix=Math.min(c.segments-1,Math.floor(rx)),iz=Math.min(c.segments-1,Math.floor(rz));
  var u=rx-ix,v=rz-iz,side=c.segments+1,k=iz*side+ix;
  var a=c.heights[k],b=c.heights[k+1],cc=c.heights[k+side],d=c.heights[k+side+1];
  var height,gx,gz;
  if(u+v<=1){height=a*(1-u-v)+b*u+cc*v;gx=(b-a)/c.step;gz=(cc-a)/c.step;}
  else{height=b*(1-v)+cc*(1-u)+d*(u+v-1);gx=(d-cc)/c.step;gz=(d-b)/c.step;}
  var magnitude=Math.hypot(gx,gz),scale=1/Math.hypot(gx,1,gz);
  return {height:height,gradientX:gx,gradientZ:gz,
   normal:[-gx*scale,scale,-gz*scale],slopeDeg:Math.atan(magnitude)*180/Math.PI};
 }
 return null;
}
function slopeLimit(value){return finite(value)?Math.max(0,Math.min(89,value)):45;}
/* Horizontal sweep with slope limit, stable contacts and axis sliding. */
function walkHeightfield(t,x,z,y,dx,dz,followingTerrain,blocked,maxSlopeDeg){
 if(!finite(x)||!finite(z)||!finite(y)||!finite(dx)||!finite(dz))throw Error('Terrain: invalid walking coordinates');
 function obstructed(px,pz,py){return typeof blocked==='function'&&blocked(px,pz,py);}
 if(!t||!Array.isArray(t.chunks)||!t.chunks.length){
  if(!obstructed(x+dx,z,y))x+=dx;
  if(!obstructed(x,z+dz,y))z+=dz;
  return {x:x,z:z,y:y};
 }
 var height=sampleSurface(t,x,z),limit=slopeLimit(maxSlopeDeg),radians=limit*Math.PI/180;
 var attached=!!followingTerrain&&height!==null&&height.slopeDeg<=limit+1e-4&&Math.abs(y-height.height)<=.35;
 var segment=Math.max(.05,Math.min(.35,t.chunks[0].step*.35));
 var count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/segment));
 var sx=dx/count,sz=dz/count,climb=.45;
 function canMove(px,pz){
  var surface=sampleSurface(t,px,pz),rise=surface?surface.height-y:0;
  if(surface&&rise>(attached?climb:EPS))return false;
  if(attached&&surface&&rise>EPS){
   if(surface.slopeDeg>limit+1e-4)return false;
   var horizontal=Math.hypot(px-x,pz-z);
   if(rise>horizontal*Math.tan(radians)+EPS)return false;
  }
  if(obstructed(px,pz,y))return false;
  if(attached&&surface&&Math.abs(rise)<=climb){
   y=surface.height;
   if(surface.slopeDeg>limit+1e-4)attached=false;
  }else if(!surface)attached=false;
  return true;
 }
 for(var i=0;i<count;i++){
  if(canMove(x+sx,z))x+=sx;
  if(canMove(x,z+sz))z+=sz;
 }
 return {x:x,z:z,y:y};
}
/* Gravity-driven downhill slide. Never grants uphill movement or cliff teleport. */
function slideHeightfield(t,x,z,y,speed,dt,blocked,maxSlopeDeg){
 if(!finite(speed)||!finite(dt)||speed<0||dt<0)throw Error('Terrain: invalid sliding speed');
 var surface=sampleSurface(t,x,z),limit=slopeLimit(maxSlopeDeg);
 if(!surface||surface.slopeDeg<=limit+1e-4||Math.abs(y-surface.height)>.2)return {x:x,z:z,y:y,sliding:false};
 var gradient=Math.hypot(surface.gradientX,surface.gradientZ);
 if(gradient<EPS)return {x:x,z:z,y:y,sliding:false};
 var dx=-surface.gradientX/gradient*speed*dt,dz=-surface.gradientZ/gradient*speed*dt;
 var moved=walkHeightfield(t,x,z,y,dx,dz,false,blocked,limit);
 var next=sampleSurface(t,moved.x,moved.z);
 if(next&&next.height<=y+EPS&&y-next.height<=.45)moved.y=next.height;
 moved.sliding=true;
 return moved;
}

function weightAt(chunk,index,channel){return chunk.weights?chunk.weights[index*4+channel]:(channel===0?255:0);}
function atlasTexture(T){
 if(typeof document==='undefined'||!T.CanvasTexture)return null;
 var canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
 var ctx=canvas.getContext('2d');if(!ctx)return null;
 var img=ctx.createImageData(256,64);
 var palette=[[49,105,46],[178,141,83],[102,68,46],[95,108,116]];
 // Smooth periodic lattice noise: opposite tile edges always match.
 function hash(x,y,seed){var p=Math.sin(x*127.1+y*311.7+seed*19.19)*43758.5453;return p-Math.floor(p);}
 function tileNoise(x,y,period,seed){
  var fx=x/64*period,fy=y/64*period,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;
  u=u*u*(3-2*u);v=v*v*(3-2*v);
  function value(dx,dy){return hash((ix+dx)%period,(iy+dy)%period,seed);}
  var a=value(0,0)*(1-u)+value(1,0)*u,b=value(0,1)*(1-u)+value(1,1)*u;
  return a*(1-v)+b*v;
 }
 for(var type=0;type<4;type++)for(var y=0;y<64;y++)for(var x=0;x<64;x++){
  var i=((y*256)+(type*64+x))*4;
  var coarse=tileNoise(x,y,5,type)-.5;
  var fine=tileNoise(x,y,29,type+7)-.5;
  var vein=type===3?Math.sin((x*3+y)*Math.PI*2/64)*5:0;
  var grain=type===1?Math.sin((x*6+y*3)*Math.PI*2/64)*3:0;
  var amount=coarse*25+fine*20+vein+grain;
  var c=palette[type];
  img.data[i]=Math.max(0,Math.min(255,c[0]+amount));
  img.data[i+1]=Math.max(0,Math.min(255,c[1]+amount*(type===0?.86:1)));
  img.data[i+2]=Math.max(0,Math.min(255,c[2]+amount*(type===0?.68:1.15)));
  img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);
 var texture=new T.CanvasTexture(canvas);
 texture.encoding=T.sRGBEncoding;
 texture.wrapS=T.ClampToEdgeWrapping;texture.wrapT=T.ClampToEdgeWrapping;
 texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
 return texture;
}
function createTerrainMaterial(T,texture){
 var mat=new T.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:0,side:T.FrontSide});
 if(!texture)return mat;
 mat.onBeforeCompile=function(shader){
  shader.uniforms.terrainAtlas={value:texture};
  shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 terrainWeights;\nvarying vec4 vTerrainWeights;\nvarying vec2 vTerrainXZ;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainWeights=terrainWeights;\nvTerrainXZ=position.xz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D terrainAtlas;\nvarying vec4 vTerrainWeights;\nvarying vec2 vTerrainXZ;')
   .replace('#include <map_fragment>',[
   'vec2 tileUV=fract(vTerrainXZ*0.21);',
   'tileUV=clamp(tileUV,vec2(0.047),vec2(0.953));',
   'vec3 a=texture2D(terrainAtlas,vec2((tileUV.x+0.0)/4.0,tileUV.y)).rgb;',
   'vec3 b=texture2D(terrainAtlas,vec2((tileUV.x+1.0)/4.0,tileUV.y)).rgb;',
   'vec3 c=texture2D(terrainAtlas,vec2((tileUV.x+2.0)/4.0,tileUV.y)).rgb;',
   'vec3 d=texture2D(terrainAtlas,vec2((tileUV.x+3.0)/4.0,tileUV.y)).rgb;',
   'vec4 w=max(vec4(0.0),vTerrainWeights);w/=max(dot(w,vec4(1.0)),0.0001);',
   'vec3 terrainColor=a*w.r+b*w.g+c*w.b+d*w.a;',
   'diffuseColor.rgb*=pow(terrainColor,vec3(2.2));'
   ].join('\n'));
 };
 mat.customProgramCacheKey=function(){return 'bridge-terrain-4layers-v1';};
 return mat;
}
function createMeshes(T,t){
 if(!t)return [];
 validate(t);
 var atlas=atlasTexture(T),remaining=t.chunks.length;
 return t.chunks.map(function(c,n){
  var side=c.segments+1,positions=[],normals=[],indices=[],weights=[],eps=c.step;
  for(var j=0;j<side;j++)for(var i=0;i<side;i++){
   var x=c.x+i*c.step,z=c.z+j*c.step,h=c.heights[j*side+i];
   positions.push(x,h,z);
   for(var k=0;k<4;k++)weights.push(weightAt(c,j*side+i,k)/255);
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
  g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  g.setAttribute('terrainWeights',new T.Float32BufferAttribute(weights,4));g.setIndex(indices);
  var material=createTerrainMaterial(T,atlas);
  if(atlas)material.addEventListener('dispose',function(){remaining--;if(!remaining)atlas.dispose();});
  var mesh=new T.Mesh(g,material);
  mesh.name='Terrain '+(n+1);mesh.receiveShadow=true;mesh.castShadow=true;return mesh;
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
var api={validate:validate,sampleHeight:sampleHeight,weightAt:weightAt,walkHeightfield:walkHeightfield,sampleSurface:sampleSurface,slideHeightfield:slideHeightfield,createMeshes:createMeshes,demoSlope:demoSlope};
root.BridgeTerrainCore=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
