/* Bridge Studio Graphics Foundation: shared shadow settings for Build, Play and HTML. */
(function(root){
'use strict';
var RESOLUTIONS={low:512,balanced:1024,high:2048};
function finiteRange(v,fallback,low,high){
 if(v===undefined||v===null||v==='')return fallback;
 if(typeof v!=='number'&&!(typeof v==='string'&&v.trim()!==''))return fallback;
 v=Number(v);return Number.isFinite(v)?Math.max(low,Math.min(high,v)):fallback;
}
function config(lighting){
 var l=lighting&&typeof lighting==='object'?lighting:{};
 var quality=Object.prototype.hasOwnProperty.call(RESOLUTIONS,l.shadowQuality)?l.shadowQuality:'balanced';
 return {
  quality:quality,
  size:RESOLUTIONS[quality],
  distance:finiteRange(l.shadowDistance,30,12,100),
  bias:finiteRange(l.shadowBias,-0.0005,-0.005,0.005),
  normalBias:finiteRange(l.shadowNormalBias,0.02,0,0.12),
  enabled:l.shadows!==false
 };
}
function apply(T,sun,renderer,lighting){
 var cfg=config(lighting);
 if(renderer&&renderer.shadowMap){renderer.shadowMap.enabled=cfg.enabled;renderer.shadowMap.type=T.PCFSoftShadowMap;}
 if(sun&&sun.shadow){
  sun.castShadow=cfg.enabled;
  var sh=sun.shadow;
  if(sh.mapSize.x!==cfg.size||sh.mapSize.y!==cfg.size){
   if(sh.map&&typeof sh.map.dispose==='function')sh.map.dispose();
   sh.map=null;
   sh.mapSize.set(cfg.size,cfg.size);
  }
  sh.bias=cfg.bias;
  sh.normalBias=cfg.normalBias;
  sh.camera.left=-cfg.distance;
  sh.camera.right=cfg.distance;
  sh.camera.top=cfg.distance;
  sh.camera.bottom=-cfg.distance;
  sh.camera.updateProjectionMatrix();
 }
 return cfg;
}
var api={config:config,apply:apply};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.BridgeGraphicsQuality=api;
})(typeof window!=='undefined'?window:globalThis);
