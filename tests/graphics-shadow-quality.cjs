/* Graphics Foundation: shared shadow quality settings unit/regression. */
'use strict';
const assert=require('node:assert/strict');
const quality=require('../src/graphics_quality.js');
const expected={quality:'balanced',size:1024,distance:30,bias:-0.0005,normalBias:0.02,enabled:true};
assert.deepEqual(quality.config(),expected,'legacy scenes use stable balanced defaults');
assert.deepEqual(quality.config({shadows:false}),{...expected,enabled:false},'shadows off respected');
assert.deepEqual(quality.config({shadowQuality:'high',shadowDistance:42,shadowBias:-0.001,shadowNormalBias:0.055}),{
 ...expected,quality:'high',size:2048,distance:42,bias:-0.001,normalBias:0.055
},'high quality values are deterministic');
assert.deepEqual(quality.config({shadowQuality:'unknown',shadowDistance:NaN,shadowBias:Infinity,shadowNormalBias:-Infinity}),expected,'invalid settings not propagated to WebGL');
assert.deepEqual(quality.config({shadowDistance:'  ',shadowBias:true,shadowNormalBias:{value:0.1}}),expected,'blank, boolean and object settings use defaults instead of coercion');
assert.equal(quality.config({shadowDistance:'42'}).distance,42,'numeric strings from inspector remain supported');
const limits=quality.config({shadowQuality:'low',shadowDistance:-100,shadowBias:100,shadowNormalBias:-20});
assert.equal(limits.size,512);
assert.equal(limits.distance,12);
assert.equal(limits.bias,.005);
assert.equal(limits.normalBias,0);
let disposed=0,projections=0;
const shadow={
 mapSize:{x:1024,y:1024,set(x,y){this.x=x;this.y=y;}},
 map:{dispose(){disposed++;}},
 camera:{left:-30,right:30,top:30,bottom:-30,updateProjectionMatrix(){projections++;}},
 bias:0,normalBias:0
};
const sun={castShadow:true,shadow};
const renderer={shadowMap:{enabled:true,type:0}};
const T={PCFSoftShadowMap:17};
const actual=quality.apply(T,sun,renderer,{shadowQuality:'high',shadowDistance:44,shadowBias:-.001,shadowNormalBias:.05});
assert.equal(actual.size,2048);
assert.equal(disposed,1,'changing map resolution frees previous GPU allocation');
assert.equal(shadow.map,null);
assert.equal(shadow.mapSize.x,2048);
assert.deepEqual([shadow.camera.left,shadow.camera.right,shadow.camera.top,shadow.camera.bottom],[-44,44,44,-44]);
assert.equal(projections,1);
assert.equal(shadow.bias,-.001);
assert.equal(shadow.normalBias,.05);
assert.equal(renderer.shadowMap.type,T.PCFSoftShadowMap);
quality.apply(T,sun,renderer,{shadowQuality:'high',shadowDistance:22,shadows:false});
assert.equal(disposed,1,'same resolution should not reallocate');
assert.equal(sun.castShadow,false);
assert.equal(renderer.shadowMap.enabled,false);
assert.equal(shadow.camera.right,22);
console.log('Graphics shadow quality: defaults, invalid input, GPU map lifecycle, shadow parity PASS');
