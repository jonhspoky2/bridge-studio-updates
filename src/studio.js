/* @bridge:gameplay_core.js */

/* Bridge Studio v0.17.1 · editor. Data-first scene/game/UI/script editing. */
(function(){'use strict';
var $=function(id){return document.getElementById(id);};
var T=window.THREE, runtime={files:[],fileUrls:[]};function warn(s){console.warn('glTF',s);}
// Shared loader inserted here by the release build.
/* @bridge:gltf_loader.js */
/* @bridge:terrain_core.js */
/* @bridge:terrain_sculpt.js */
/* @bridge:terrain_paint.js */

/* @bridge:economy_core.js */

var editorSun=null,editorAmbient=null,textureCache={},assetPreview=null,assetThumbCache={};
var editorKeys={},editorCamActive=false,editorCamSpeed=6,editorCamRightMouse=false,editorCameraTick=0;
var gridHelper=null,terrainMeshes=[],terrainStroke=null,terrainCursor=null,terrainBrush='raise',terrainWorkMode='sculpt',terrainMaterial='grass',readyFrames=0,playWatchdog=null,sceneFrames=0,lastSceneError=null;var project=null,selectedId=null,selectedIds=[],selectionOutlines=[],selectedKind='world',activeTab='world',editorScene=null,editorCamera=null,renderer=null,orbit={yaw:.64,pitch:.95,distance:17,target:null},mouse=null,meshes={},outline=null,currentPlayUrl=null,playing=false,gizmo=null,gizmoHits=[],toolMode="move",axisDrag=null,undoStack=[],redoStack=[];
function id(){return 'obj_'+Math.random().toString(36).slice(2,10);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function status(s,isError){$('status').textContent=s;$('status').style.borderColor=isError?'#955050':'#34526a';}
var draftKey='bridge-studio:v12:last-project',draftLast='',lastBackupAt=0,lastExplicitSave='',dirty=false,nativeHandle=null;
var recoveryStore=(function(){
 var dbPromise=null,STORE='snapshots',DB='BridgeStudioRecoveryV1';
 function database(){if(dbPromise)return dbPromise;dbPromise=new Promise(function(resolve){
  if(!window.indexedDB){resolve(null);return;}var req;try{req=indexedDB.open(DB,1);}catch(e){resolve(null);return;}
  req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onsuccess=function(){resolve(req.result);};req.onerror=function(){resolve(null);};req.onblocked=function(){resolve(null);};
 });return dbPromise;}
 async function entries(){var db=await database();if(!db)return [];return new Promise(function(resolve){try{
  var q=db.transaction(STORE,'readonly').objectStore(STORE).getAll();q.onsuccess=function(){resolve(q.result||[]);};q.onerror=function(){resolve([]);};
 }catch(e){resolve([]);}});}
 async function put(snapshot){var db=await database();if(!db)throw Error('IndexedDB недоступен');await new Promise(function(resolve,reject){try{
  var t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(snapshot);t.oncomplete=resolve;t.onabort=t.onerror=function(){reject(t.error||Error('Запись не удалась'));};
 }catch(e){reject(e);}});
 var list=(await entries()).sort(function(a,b){return b.id-a.id;});if(list.length>12){await new Promise(function(resolve){try{var t=db.transaction(STORE,'readwrite');list.slice(12).forEach(function(v){t.objectStore(STORE).delete(v.id);});t.oncomplete=resolve;t.onerror=resolve;}catch(e){resolve();}});}
 }
 return {entries:entries,put:put,available:database};
})();
function setDirty(value){dirty=!!value;var e=$('dirtyMark');if(e){e.textContent=dirty?'● Изменено':'✓ Сохранено';e.classList.toggle('unsaved',dirty);}}
function recoveryDate(time){return new Date(time).toLocaleString('ru-RU');}
function recordSnapshot(force){try{
 if(!project||playing)return Promise.resolve(false);
 var serialized=JSON.stringify(cleanDoc());if(serialized===draftLast&&!force)return Promise.resolve(false);
 if(serialized.length>30000000){status('Автокопия слишком велика для браузерного хранилища; сохрани .rwscene на диск.',true);return Promise.resolve(false);}
 if(!force&&Date.now()-lastBackupAt<55000)return Promise.resolve(false);
 draftLast=serialized;lastBackupAt=Date.now();
 // Small local backup also supports migration/recovery on browsers without IndexedDB.
 var localWritten=false;if(serialized.length<2300000){try{localStorage.setItem(draftKey,serialized);localWritten=true;}catch(e){}}
 return recoveryStore.put({id:Date.now(),time:Date.now(),name:project.name,bytes:serialized.length,body:serialized}).then(function(){var el=$('backupState');if(el)el.textContent='Автокопия: '+recoveryDate(Date.now());return true;}).catch(function(e){var el=$('backupState');if(el)el.textContent='Автокопия: хранилище недоступно ('+e.message+')';if(localWritten){if(el)el.textContent='Локальная автокопия сохранена (без истории IndexedDB).';return true;}draftLast='';lastBackupAt=0;return false;});
 }catch(e){console.warn('Backup error',e);return Promise.resolve(false);}}
function writeDraft(){recordSnapshot(false);}
async function loadDraft(){var panel=$('recoveryPanel');panel.hidden=false;panel.innerHTML='<strong>Резервные копии проекта</strong><p class="hint">Здесь хранятся последние 12 снимков в этом браузере. Для переноса на другой ПК используй .rwscene.</p>';
 var list=(await recoveryStore.entries()).sort(function(a,b){return b.id-a.id;});
 [{key:'bridge-studio:v10:last-project',name:'Автокопия из v0.10'}, {key:draftKey,name:'Последняя локальная копия'}].forEach(function(legacy){try{var raw=localStorage.getItem(legacy.key);if(raw&&!list.some(function(x){return x.body===raw;}))list.push({id:0,time:0,name:legacy.name,bytes:raw.length,body:raw});}catch(e){}});
 if(!list.length){panel.innerHTML+='<p class="hint">Копий пока нет. Нажми «Создать копию» или начни редактировать сцену.</p>';return;}
 list.slice(0,14).forEach(function(snapshot){var btn=document.createElement('button');btn.className='recovery-entry';btn.textContent=(snapshot.time?recoveryDate(snapshot.time):'Ранее')+' · '+snapshot.name+' · '+(snapshot.bytes/1048576).toFixed(2)+' МБ';btn.onclick=function(){if(!confirm('Восстановить «'+snapshot.name+'»? Текущая сцена будет заменена.'))return;try{var doc=JSON.parse(snapshot.body);loadDoc(doc);panel.hidden=true;status('Восстановлена копия: '+snapshot.name);setDirty(true);}catch(e){status('Копия повреждена: '+e.message,true);}};panel.appendChild(btn);});
 var close=document.createElement('button');close.textContent='Закрыть';close.onclick=function(){panel.hidden=true;};panel.appendChild(close);
}
function clone(a){return JSON.parse(JSON.stringify(a));}
function dl(text,name,mime){var blob=new Blob([text],{type:mime||'text/plain;charset=utf-8'});var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},35000);return blob.size;}
function round(v){return Math.round(v*100)/100;}
function lightingDefaults(){return {ambientColor:'#eaf6ff',ambientIntensity:1.5,sunColor:'#ffeed9',sunIntensity:1.6,shadows:true,fog:false,fogColor:'#96bfd8',fogNear:20,fogFar:95};}
function normalizeDoc(doc){
 if(!doc.settings)doc.settings={sky:'#80bbeb',moveSpeed:5,jumpPower:7.6};
 var slope=Number(doc.settings.maxWalkableSlopeDeg);doc.settings.maxWalkableSlopeDeg=doc.settings.maxWalkableSlopeDeg!=null&&Number.isFinite(slope)?Math.max(0,Math.min(89,slope)):45;
 doc.settings.lighting=Object.assign(lightingDefaults(),doc.settings.lighting||{});
 if(!Array.isArray(doc.assets))doc.assets=[];
 if(!Array.isArray(doc.textures))doc.textures=[];
 if(!Array.isArray(doc.items))doc.items=[];if(!Array.isArray(doc.prefabs))doc.prefabs=[];if(!Array.isArray(doc.graphs))doc.graphs=[];if(!doc.settings.maxHealth)doc.settings.maxHealth=100;
 var legacy=new Map();doc.assets.forEach(function(a){if(a.data)legacy.set(a.data,a.id);});
 function migrate(o){if(o&&o.type==='glb'&&o.asset){if(!o.assetId){var known=legacy.get(o.asset);if(!known){known='asset_'+id();doc.assets.push({id:known,name:(o.name||'Модель')+'.glb',type:'glb',data:o.asset,bytes:Math.floor(o.asset.length*.75)});legacy.set(o.asset,known);}o.assetId=known;}delete o.asset;}}
 (doc.objects||[]).forEach(migrate);doc.prefabs.forEach(function(pref){(pref.objects||[]).forEach(migrate);});
 return doc;
}
function getAsset(d,doc){doc=doc||project;return d.asset||((doc.assets||[]).find(function(a){return a.id===d.assetId;})||{}).data||'';}
function materialConfig(d){var custom=d.material||{};return {roughness:custom.roughness==null?(d.type==='coin'?.3:.75):Number(custom.roughness),metalness:custom.metalness==null?(d.type==='coin'?.65:.08):Number(custom.metalness),opacity:custom.opacity==null?1:Number(custom.opacity),emissive:custom.emissive||'#000000',emissiveIntensity:custom.emissiveIntensity==null?0:Number(custom.emissiveIntensity),textureId:custom.textureId||'',overrideGLB:!!custom.overrideGLB};}
function textureFor(doc,textureId){if(!textureId)return null;var entry=(doc.textures||[]).find(function(x){return x.id===textureId;});if(!entry||!entry.data)return null;if(textureCache[entry.id]&&textureCache[entry.id].data===entry.data)return textureCache[entry.id].texture;if(typeof T.TextureLoader!=='function')return null;var t=new T.TextureLoader().load(entry.data,undefined,undefined,function(err){console.warn('Не удалось загрузить текстуру',entry.name,err);});t.encoding=T.sRGBEncoding;textureCache[entry.id]={data:entry.data,texture:t};return t;}
function makeObjectMaterial(d,doc){var m=materialConfig(d);var opts={color:d.color||'#5d9eb4',roughness:m.roughness,metalness:m.metalness,transparent:m.opacity<1,opacity:m.opacity,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity,side:T.FrontSide};var map=textureFor(doc||project,m.textureId);if(map)opts.map=map;return new T.MeshStandardMaterial(opts);}
function decorateGlb(root,d,doc){var m=materialConfig(d);root.traverse(function(node){if(!node.material)return;node.castShadow=true;node.receiveShadow=true;if(m.overrideGLB){node.material=Array.isArray(node.material)?node.material.map(function(){return makeObjectMaterial(d,doc);}):makeObjectMaterial(d,doc);}});}
function applyLighting(){if(!editorScene||!project)return;var l=Object.assign(lightingDefaults(),project.settings.lighting||{});editorScene.background=new T.Color(project.settings.sky||'#80bbeb');editorScene.fog=l.fog?new T.Fog(l.fogColor,Number(l.fogNear)||20,Math.max(Number(l.fogNear)+1,Number(l.fogFar)||95)):null;if(editorAmbient){editorAmbient.color.set(l.ambientColor);editorAmbient.intensity=Number(l.ambientIntensity);}if(editorSun){editorSun.color.set(l.sunColor);editorSun.intensity=Number(l.sunIntensity);editorSun.castShadow=!!l.shadows;}if(renderer)renderer.shadowMap.enabled=!!l.shadows;}
function resetTextureCache(){Object.keys(textureCache).forEach(function(k){var t=textureCache[k].texture;if(t&&t.dispose)t.dispose();});textureCache={};}

function sample(){return {format:'rwbridge.game',version:2,name:'Coin Rush',settings:{sky:'#80bbeb',moveSpeed:5,jumpPower:7.6},objects:[
{id:'floor',name:'Главная платформа',type:'ground',position:[0,-.4,0],rotation:[0,0,0],scale:[16,.8,20],color:'#547b71',solid:true,action:'none',value:0,message:'',target:''},
{id:'spawn',name:'Старт игрока',type:'spawn',position:[0,0,7],rotation:[0,0,0],scale:[1,1,1],color:'#6bdfb7',solid:false,action:'none',value:0},
{id:'coin1',name:'Монета 1',type:'coin',position:[-2,1,3],rotation:[0,0,0],scale:[1,1,1],color:'#ffe183',solid:false,action:'collect',value:1},
{id:'coin2',name:'Монета 2',type:'coin',position:[2,1,0],rotation:[0,0,0],scale:[1,1,1],color:'#ffe183',solid:false,action:'collect',value:1},
{id:'coin3',name:'Монета 3',type:'coin',position:[0,1,-3],rotation:[0,0,0],scale:[1,1,1],color:'#ffe183',solid:false,action:'collect',value:1},
{id:'wall1',name:'Левый барьер',type:'block',position:[-5,1,-2],rotation:[0,0,0],scale:[1,2,7],color:'#3a708f',solid:true,action:'none',value:0},
{id:'wall2',name:'Правый барьер',type:'block',position:[5,1,-2],rotation:[0,0,0],scale:[1,2,7],color:'#3a708f',solid:true,action:'none',value:0},
{id:'finish',name:'Портал финиша',type:'goal',position:[0,1,-7],rotation:[0,0,0],scale:[1.2,1.4,1],color:'#76e6fa',solid:false,action:'win',value:0},
],ui:[{id:'ui_coin',name:'Счётчик',type:'label',text:'Монеты',bind:'coins',x:3,y:5,width:175,fontSize:20,color:'#ffffff',action:'none',value:1},{id:'ui_reset',name:'Перезапуск',type:'button',text:'↻ Сначала',bind:'none',x:80,y:5,width:132,fontSize:15,color:'#ffffff',action:'reset',value:0}],scripts:[{id:'s_welcome',name:'Приветствие',event:'start',enabled:true,code:'api.message("Собери три монеты и дойди до портала!");'},{id:'s_win',name:'Победа',event:'win',enabled:true,code:'if (ctx.coins >= 3) {\n  api.message("Все монеты собраны! Отлично!");\n} else {\n  api.message("Финиш достигнут! Монет: " + ctx.coins);\n}'}]};}
function demoAsset(){return ($('embedded-demo-data').textContent||'').trim();}
function addMiniRover(){var b64=demoAsset();if(!b64||b64==='{}'){status('Демо-GLB не встроен.',true);return;}
 var d={id:id(),name:'Mini Rover · GLB',type:'glb',position:[-3,0,-2.7],rotation:[0,0,0],scale:[1,1,1],color:'#ffffff',solid:false,action:'message',message:'Mini Rover — настоящая модель GLB',value:0,asset:b64};var existing=project.assets.find(function(x){return x.data===b64;});if(!existing){remember();existing={id:id(),name:'Mini Rover.glb',type:'glb',data:b64,bytes:Math.floor(b64.length*.75)};project.assets.push(existing);}refreshAssetBrowser();addAssetInstance(existing.id,[-3,0,-2.7]);status('Mini Rover добавлен в библиотеку и на сцену.');}
function syncGameSettings(){if(!project||!project.settings)return;var v=$('gameSpeed'),j=$('gameJump');if(v)v.value=project.settings.moveSpeed||5;if(j)j.value=project.settings.jumpPower||7.6;var slope=$('gameSlope');if(slope)slope.value=project.settings.maxWalkableSlopeDeg==null?45:project.settings.maxWalkableSlopeDeg;var hp=$('gameHealth');if(hp)hp.value=project.settings.maxHealth||100;var volume=$('gameVolume');if(volume)volume.value=project.settings.audioVolume==null?.35:project.settings.audioVolume;}
function initialProject(){var d=sample(),b64=demoAsset();if(b64&&b64!=='{}')d.objects.push({id:'demo_rover',name:'Mini Rover · GLB',type:'glb',position:[-3,0,-2.7],rotation:[0,0,0],scale:[1,1,1],color:'#ffffff',solid:false,action:'message',message:'Настоящая GLB-модель Mini Rover',value:0,asset:b64});return normalizeDoc(d);}
function remember(){if(!project)return;setDirty(true);undoStack.push(JSON.stringify(project));if(undoStack.length>60)undoStack.shift();redoStack.length=0;}
function historyBack(){if(terrainStroke||!undoStack.length)return;var change=undoStack.pop();setDirty(true);
 if(typeof change==='string'){redoStack.push(JSON.stringify(project));restoreHistory(JSON.parse(change));}
 else if(change&&change.kind==='terrain-stroke'){redoStack.push(change);var chunks=window.BridgeTerrainSculpt.applyCommand(project.terrain,change,'before');refreshTerrainChunks(chunks);status('Отменён мазок Terrain.');}
 else if(change&&change.kind==='terrain-paint'){redoStack.push(change);refreshPaintChunks(window.BridgeTerrainPaint.applyCommand(project.terrain,change,'before'));status('Отменена покраска.');}}
function historyForward(){if(terrainStroke||!redoStack.length)return;var change=redoStack.pop();setDirty(true);
 if(typeof change==='string'){undoStack.push(JSON.stringify(project));restoreHistory(JSON.parse(change));}
 else if(change&&change.kind==='terrain-stroke'){undoStack.push(change);var chunks=window.BridgeTerrainSculpt.applyCommand(project.terrain,change,'after');refreshTerrainChunks(chunks);status('Повторён мазок Terrain.');}
 else if(change&&change.kind==='terrain-paint'){undoStack.push(change);refreshPaintChunks(window.BridgeTerrainPaint.applyCommand(project.terrain,change,'after'));status('Повторена покраска.');}}
function restoreHistory(d){var kind=selectedKind,old=selectedId,previous=selectedIds.slice();project=normalizeDoc(d);resetTextureCache();refreshAssetBrowser();refreshLightingControls();$('projectName').value=d.name;syncGameSettings();refreshScene();var entries=kind==='world'?d.objects:kind==='ui'?d.ui:d.scripts;select(kind,entries.some(function(x){return x.id===old;})?old:entries[0]&&entries[0].id);if(kind==='world'&&previous.length>1)setSelectedIds(previous.filter(function(x){return d.objects.some(function(o){return o.id===x;});}),old);status('История изменений восстановлена.');}
function blank(){return normalizeDoc({format:'rwbridge.game',version:2,name:'Новая игра',settings:{sky:'#88c5f1',moveSpeed:5,jumpPower:7.6},objects:[{id:id(),name:'Земля',type:'ground',position:[0,-.5,0],rotation:[0,0,0],scale:[16,1,16],color:'#57827d',solid:true,action:'none',value:0},{id:id(),name:'Spawn',type:'spawn',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],color:'#66e8ca',solid:false,action:'none',value:0}],ui:[],scripts:[]});}
function pick(){return (selectedKind==='world'?project.objects:selectedKind==='ui'?project.ui:project.scripts).find(function(o){return o.id===selectedId;});}
function disposeVisual(root){if(!root)return;root.traverse(function(obj){if(obj.geometry&&obj.geometry.dispose)obj.geometry.dispose();if(obj.material){var materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(function(mat){if(mat&&mat.dispose)mat.dispose();});}});}
function createVisual(d){var g=new T.Group();g.name=d.name;g.userData.id=d.id;g.position.fromArray(d.position);g.rotation.set.apply(g.rotation,d.rotation);g.scale.fromArray(d.scale);var mat=makeObjectMaterial(d,project);var mesh;
if(d.type==='coin'){mesh=new T.Mesh(new T.TorusGeometry(.42,.135,10,24),mat);mesh.rotation.x=Math.PI/2;}
else if(d.type==='goal'){mesh=new T.Mesh(new T.TorusGeometry(.78,.11,12,30),mat);}
else if(d.type==='spawn'){mesh=new T.Mesh(new T.CylinderGeometry(.45,.45,.14,24),mat);mesh.position.y=.08;}
else if(d.type==='npc'){mesh=new T.Group();var torso=new T.Mesh(new T.BoxGeometry(.67,1.03,.42),mat);torso.position.y=1.05;mesh.add(torso);var head=new T.Mesh(new T.SphereGeometry(.28,12,10),new T.MeshStandardMaterial({color:0xf1c6a3}));head.position.y=1.81;mesh.add(head);for(var sign of [-1,1]){var leg=new T.Mesh(new T.BoxGeometry(.22,.57,.28),new T.MeshStandardMaterial({color:0x2a354c}));leg.position.set(sign*.18,.31,0);mesh.add(leg);}}
else if(d.type==='glb'){mesh=new T.Mesh(new T.BoxGeometry(.6,.6,.6),new T.MeshStandardMaterial({color:0x466c7e,wireframe:true}));mesh.visible=false;}
else{mesh=new T.Mesh(new T.BoxGeometry(1,1,1),mat);}
mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);editorScene.add(g);meshes[d.id]=g;
if(d.type==='glb'&&getAsset(d)){try{var bytes=bytesFromB64(getAsset(d)),decoded=decodeGlb(bytes);parseData(decoded.json,decoded.bin).then(function(r){if(meshes[d.id]!==g){disposeVisual(r.object);return;}decorateGlb(r.object,d,project);g.add(r.object);mesh.visible=false;refreshSelection();}).catch(function(e){status('Модель '+d.name+': '+e.message,true);});}catch(e){status(e.message,true);}}
return g;}
function refreshTerrain(){hideTerrainCursor();terrainMeshes.forEach(function(mesh){editorScene.remove(mesh);disposeVisual(mesh);});terrainMeshes=[];if(project.terrain){try{window.BridgeTerrainCore.validate(project.terrain);terrainMeshes=window.BridgeTerrainCore.createMeshes(T,project.terrain);terrainMeshes.forEach(function(mesh){editorScene.add(mesh);});}catch(e){status('Terrain: '+e.message,true);}}}
function addDemoTerrain(){if(project.terrain&&project.terrain.chunks&&project.terrain.chunks.length){status('Terrain уже создан; сохрани проект перед заменой рельефа.',true);return;}remember();project.terrain=window.BridgeTerrainCore.demoSlope();removeStarterGroundForTerrain();var s=project.objects.find(function(o){return o.type==='spawn';});if(s){var y=window.BridgeTerrainCore.sampleHeight(project.terrain,-8,5);s.position=[-8,y+.25,5];}refreshScene();refreshLists();fitScene();setTool('terrain');refreshInspector();setDirty(true);status('Создан тестовый склон из 2 участков. Проверяй Play, сохранение и экспорт.');}

function removeStarterGroundForTerrain(){
 var starter=project.objects.find(function(o){
  if(o.type!=='ground'||!Array.isArray(o.position)||!Array.isArray(o.scale)||o.action!=='none')return false;
  var coinRush=o.id==='floor'&&o.name==='Главная платформа'&&Math.abs(o.position[1]+.4)<1e-7&&o.scale[0]===16&&o.scale[1]===.8&&o.scale[2]===20;
  var blankScene=project.name==='Новая игра'&&o.name==='Земля'&&Math.abs(o.position[1]+.5)<1e-7&&o.scale[0]===16&&o.scale[1]===1&&o.scale[2]===16;
  return coinRush||blankScene;
 });
 if(!starter)return false;
 project.objects=project.objects.filter(function(o){return o!==starter;});
 if(selectedId===starter.id){selectedId=null;selectedIds=[];}
 return true;
}
function terrainOptions(){return {mode:terrainBrush,radius:Number($('terrainRadius').value),strength:Number($('terrainStrength').value),hardness:Number($('terrainHardness').value)};}
function refreshTerrainChunks(chunks,precise){
 if(!project.terrain||!chunks||!chunks.length)return;
 window.BridgeTerrainSculpt.refreshMeshes(T,project.terrain,terrainMeshes,chunks,terrainStroke&&terrainStroke.stroke.nodes,!!precise);
}
function refreshPaintChunks(chunks){if(project.terrain&&chunks&&chunks.length)window.BridgeTerrainPaint.refreshMeshes(project.terrain,terrainMeshes,chunks);}
function addFlatTerrain(){
 if(project.terrain&&project.terrain.chunks&&project.terrain.chunks.length){status('Terrain уже существует. Сохрани проект и создай новый для другой сетки.',true);return;}
 try{
  var cols=Number($('terrainCols').value),rows=Number($('terrainRows').value);
  var fresh=window.BridgeTerrainSculpt.createFlat(cols,rows,16,1);
  remember();project.terrain=fresh;
  removeStarterGroundForTerrain();
  refreshScene();refreshLists();fitScene();setTool('terrain');refreshInspector();
  status('Создан Terrain '+cols+'×'+rows+' участков. Рисуй кистью в 3D-окне.');
 }catch(e){status(e.message,true);}
}
function ensureTerrainCursor(){
 if(!editorScene||!T||terrainCursor)return;
 var geometry=new T.BufferGeometry(),positions=new Float32Array(64*3);
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));
 var material=new T.LineBasicMaterial({color:0x62f4f1,transparent:true,opacity:.95,depthTest:false,depthWrite:false});
 terrainCursor=new T.LineLoop(geometry,material);terrainCursor.renderOrder=999;terrainCursor.visible=false;editorScene.add(terrainCursor);
}
function hideTerrainCursor(){if(terrainCursor)terrainCursor.visible=false;}
function showTerrainCursor(x,z){
 ensureTerrainCursor();if(!terrainCursor||!project.terrain||toolMode!=='terrain'||playing){hideTerrainCursor();return;}
 var p=terrainCursor.geometry.getAttribute('position'),radius=terrainOptions().radius;
 for(var i=0;i<64;i++){
  var a=Math.PI*2*i/64,px=x+radius*Math.cos(a),pz=z+radius*Math.sin(a);
  var py=window.BridgeTerrainCore.sampleHeight(project.terrain,px,pz);
  if(py===null)py=window.BridgeTerrainCore.sampleHeight(project.terrain,x,z)||0;
  p.array[3*i]=px;p.array[3*i+1]=py+.065;p.array[3*i+2]=pz;
 }
 p.needsUpdate=true;terrainCursor.geometry.computeBoundingSphere();terrainCursor.visible=true;
}
function terrainIntersection(e){
 if(!terrainMeshes.length)return null;
 var hits=getRay(e).intersectObjects(terrainMeshes,false);
 return hits.length?hits[0].point:null;
}
function updateTerrainUI(){
 document.querySelectorAll('[data-terrain-mode]').forEach(function(btn){btn.classList.toggle('selected',btn.dataset.terrainMode===terrainWorkMode);});
 document.querySelectorAll('[data-terrain-material]').forEach(function(btn){btn.classList.toggle('selected',btn.dataset.terrainMaterial===terrainMaterial);});
 $('terrainSculptControls').classList.toggle('hidden',terrainWorkMode==='paint');
 $('terrainPaintControls').classList.toggle('hidden',terrainWorkMode!=='paint');
 $('terrainBrushHint').textContent=terrainWorkMode==='paint'?'PAINT: выбери материал и рисуй мышью. Escape отменяет мазок.':'SCULPT: кисти рельефа. ЛКМ — мазок; ПКМ — камера. Escape — отмена.';
 document.querySelectorAll('[data-terrain-brush]').forEach(function(btn){btn.classList.toggle('selected',btn.dataset.terrainBrush===terrainBrush);});
 [['terrainRadius','terrainRadiusLabel',1],['terrainStrength','terrainStrengthLabel',1],['terrainHardness','terrainHardnessLabel',2]].forEach(function(a){
  $(a[1]).textContent=Number($(a[0]).value).toFixed(a[2]);
 });
}
function startTerrainStroke(e,point){
 try{
  var painting=terrainWorkMode==='paint',options=terrainOptions();
  var stroke=painting?window.BridgeTerrainPaint.begin(project.terrain,{material:terrainMaterial,radius:options.radius,strength:options.strength,hardness:options.hardness},point.x,point.z):window.BridgeTerrainSculpt.begin(project.terrain,options,point.x,point.z);
  var result=painting?window.BridgeTerrainPaint.dab(stroke,point.x,point.z,.06):window.BridgeTerrainSculpt.dab(stroke,point.x,point.z,.033);
  terrainStroke={stroke:stroke,painting:painting,x:point.x,z:point.z,lastTime:e.timeStamp||performance.now(),pointerId:e.pointerId,dirtyBefore:dirty};
  if(painting)refreshPaintChunks(result.chunks);else refreshTerrainChunks(result.chunks,true);
  if(result.vertices)setDirty(true);
  showTerrainCursor(point.x,point.z);
 }catch(error){status('Кисть: '+error.message,true);}
}
function moveTerrainStroke(e,point){
 if(!terrainStroke||!point)return;
 try{
  var t=e.timeStamp||performance.now(),dt=Math.max(0,Math.min(.08,(t-terrainStroke.lastTime)/1000||0));
  var result=terrainStroke.painting?window.BridgeTerrainPaint.applyPath(terrainStroke.stroke,terrainStroke.x,terrainStroke.z,point.x,point.z,dt):window.BridgeTerrainSculpt.applyPath(terrainStroke.stroke,terrainStroke.x,terrainStroke.z,point.x,point.z,dt);
  terrainStroke.x=point.x;terrainStroke.z=point.z;terrainStroke.lastTime=t;
  if(terrainStroke.painting)refreshPaintChunks(result.chunks);else refreshTerrainChunks(result.chunks,true);if(result.vertices)setDirty(true);
  showTerrainCursor(point.x,point.z);
 }catch(error){status('Кисть: '+error.message,true);endTerrainStroke(true);}
}
function endTerrainStroke(cancelled){
 if(!terrainStroke)return;
 var entry=terrainStroke,stroke=entry.stroke;terrainStroke=null;
 try{
  if(cancelled){var changed=entry.painting?window.BridgeTerrainPaint.cancel(stroke):window.BridgeTerrainSculpt.cancel(stroke);if(entry.painting)refreshPaintChunks(changed);else refreshTerrainChunks(changed);setDirty(entry.dirtyBefore);status('Мазок Terrain отменён.');}
  else{
   var cmd=entry.painting?window.BridgeTerrainPaint.commit(stroke):window.BridgeTerrainSculpt.commit(stroke);
   if(cmd){undoStack.push(cmd);if(undoStack.length>60)undoStack.shift();redoStack.length=0;setDirty(true);status((entry.painting?'Paint':'Terrain')+': мазок завершён · '+cmd.changes.length+' вершин · Ctrl+Z для отмены.');}
   else setDirty(entry.dirtyBefore);
  }
 }catch(e){status('Ошибка завершения мазка: '+e.message,true);}refreshInspector();
}

function refreshScene(){if(!T)return;Object.keys(meshes).forEach(function(key){editorScene.remove(meshes[key]);disposeVisual(meshes[key]);});meshes={};project.objects.forEach(createVisual);refreshTerrain();applyLighting();refreshSelection();}
function setSelectedIds(ids,primary){selectedKind='world';selectedIds=Array.from(new Set(ids.filter(function(v){return project.objects.some(function(o){return o.id===v;});})));
 selectedId=selectedIds.indexOf(primary)>=0?primary:(selectedIds[selectedIds.length-1]||null);refreshLists();refreshInspector();refreshSelection();}
function selectWorld(idValue,event){if(!idValue){setSelectedIds([],null);return;}if(event&&(event.ctrlKey||event.metaKey)){
 var ids=selectedIds.slice(),n=ids.indexOf(idValue);if(n>=0)ids.splice(n,1);else ids.push(idValue);setSelectedIds(ids,n>=0?ids[ids.length-1]:idValue);
 }else if(event&&event.shiftKey&&selectedKind==='world'&&selectedId){var visible=Array.from(document.querySelectorAll('#objectList .listbtn')).map(function(x){return x.dataset.id;}),a=visible.indexOf(selectedId),b=visible.indexOf(idValue);if(a<0||b<0){setSelectedIds([idValue],idValue);return;}var subset=visible.slice(Math.min(a,b),Math.max(a,b)+1);setSelectedIds(Array.from(new Set(selectedIds.concat(subset))),idValue);
 }else setSelectedIds([idValue],idValue);}
function select(kind,idValue){if(kind==='world'){setSelectedIds(idValue?[idValue]:[],idValue);return;}selectedKind=kind;selectedId=idValue;selectedIds=[];refreshLists();refreshInspector();refreshSelection();}
function selectedObjects(){return project.objects.filter(function(o){return selectedIds.indexOf(o.id)>=0;});}
function selectionCenter(){var targets=selectedObjects();if(!targets.length)return [0,0,0];var avg=[0,0,0];targets.forEach(function(o){for(var i=0;i<3;i++)avg[i]+=o.position[i];});return avg.map(function(a){return a/targets.length;});}
function updateSelectionActions(){var count=selectedIds.length;var hint=$('selectionCount');if(hint)hint.textContent=count?count+' выделено · Ctrl+клик: добавить · Shift: диапазон':'Ctrl+клик: выделить несколько';['alignX','alignY','alignZ','distributeX','distributeZ','groupSelection','ungroupSelection'].forEach(function(id){var el=$(id);if(el)el.disabled=(count<(id==='groupSelection'||id==='ungroupSelection'?1:2));});}
function refreshSelection(){if(!editorScene)return;var old=selectionOutlines.concat(outline?[outline]:[]);old.forEach(function(a){editorScene.remove(a);if(a.geometry)a.geometry.dispose();if(a.material)a.material.dispose();});outline=null;selectionOutlines=[];
 if(selectedKind==='world'){selectedIds.forEach(function(idValue){var obj=meshes[idValue];if(!obj)return;var line=new T.BoxHelper(obj,idValue===selectedId?0xffe09c:0x6dd9ff);editorScene.add(line);if(idValue===selectedId)outline=line;else selectionOutlines.push(line);});}
 if(gizmo)gizmo.visible=toolMode!=='terrain'&&selectedKind==='world'&&selectedIds.length>0;updateSelectionActions();}
function refreshLists(){var list=$('objectList');list.innerHTML='';var groups=new Map();project.objects.forEach(function(o){var group=String(o.group||'');if(!groups.has(group))groups.set(group,[]);groups.get(group).push(o);});
 groups.forEach(function(objects,groupName){if(groupName){var header=document.createElement('button');header.className='group-heading';header.textContent='▦ '+groupName+' ('+objects.length+')';header.title='Нажми для выбора всей группы';header.onclick=function(){setSelectedIds(objects.map(function(o){return o.id;}),objects[0].id);};list.appendChild(header);}
 objects.forEach(function(o){var b=document.createElement('button');b.className='listbtn'+(selectedKind==='world'&&selectedIds.indexOf(o.id)>=0?' active':'');b.dataset.id=o.id;b.innerHTML='<span>'+esc(o.name)+'</span><small>'+esc(o.type.toUpperCase())+'</small>';b.onclick=function(e){selectWorld(o.id,e);};list.appendChild(b);});});
 list=$('uiList');list.innerHTML='';project.ui.forEach(function(o){var b=document.createElement('button');b.className='listbtn'+(selectedKind==='ui'&&selectedId===o.id?' active':'');b.innerHTML='<span>'+esc(o.name)+'</span><small>'+esc(o.type.toUpperCase())+'</small>';b.onclick=function(){select('ui',o.id);};list.appendChild(b);});
 list=$('scriptList');list.innerHTML='';project.scripts.forEach(function(o){var b=document.createElement('button');b.className='listbtn'+(selectedKind==='script'&&selectedId===o.id?' active':'');b.innerHTML='<span>'+esc(o.name)+'</span><small>'+esc(o.event.toUpperCase())+'</small>';b.onclick=function(){select('script',o.id);};list.appendChild(b);});
 var assetBytes=(project.assets||[]).reduce(function(x,a){return x+(a.bytes||a.data.length*.75);},0);$('projectStats').textContent=project.objects.length+' объектов · '+project.ui.length+' UI · '+project.scripts.length+' скриптов · '+project.assets.length+' GLB · '+(assetBytes/1048576).toFixed(2)+' МБ ассетов';}
function field(label,key,value,type,options){type=type||'text';var inside=type==='select'?'<select data-prop="'+key+'">'+options.map(function(opt){var v=Array.isArray(opt)?opt[0]:opt,n=Array.isArray(opt)?opt[1]:opt;return '<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>':'<input data-prop="'+key+'" type="'+type+'" value="'+esc(value)+'"'+(type==='number'?' step="any"':'')+'>';return '<div class="fieldblock"><label>'+esc(label)+'</label>'+inside+'</div>';}
function vecField(label,key,values){return '<div class="fieldblock"><label>'+esc(label)+'</label><div class="three">'+values.map(function(v,i){return '<input data-vector="'+key+'" data-i="'+i+'" type="number" step="0.1" value="'+round(key==='rotation'?v*180/Math.PI:v)+'" title="'+['X','Y','Z'][i]+'">';}).join('')+'</div></div>';}
var actionOpts=[['none','Нет'],['collect','Собрать монеты'],['win','Победа'],['message','Показать сообщение'],['checkpoint','Контрольная точка'],['hazard','Опасность / Respawn'],['toggle','Скрыть/показать объект'],['teleport','Телепорт к объекту'],['script','Только JS событие']];
function refreshInspector(){
 var c=$('inspector');c.innerHTML='';
 if(activeTab==='terrain'){
  $('rightTitle').textContent='Terrain · Рельеф';
  if(!project.terrain){c.innerHTML='<div class="empty">Создай Terrain в левой панели, выбери кисть и рисуй в 3D-сцене.</div>';return;}
  var chunks=project.terrain.chunks,vertices=0,min=Infinity,max=-Infinity;
  chunks.forEach(function(ch){vertices+=ch.heights.length;ch.heights.forEach(function(h){min=Math.min(min,h);max=Math.max(max,h);});});
  var sample=chunks[0],span=sample.segments*sample.step;
  c.innerHTML='<div class="section"><h3>СЕТКА И ВЫСОТЫ</h3>'+
   '<p class="hint">Участков: <strong>'+chunks.length+'</strong></p>'+
   '<p class="hint">Вершин, включая края: <strong>'+vertices.toLocaleString('ru-RU')+'</strong></p>'+
   '<p class="hint">Сегментов: <strong>'+sample.segments+' × '+sample.segments+'</strong></p>'+
   '<p class="hint">Размер участка: <strong>'+span.toFixed(2)+' ед.</strong></p>'+
   '<p class="hint">Нижняя точка: <strong>'+min.toFixed(3)+'</strong></p>'+
   '<p class="hint">Верхняя точка: <strong>'+max.toFixed(3)+'</strong></p>'+
   '<h3>РЕДАКТИРОВАНИЕ</h3><p class="hint">'+(terrainWorkMode==='paint'?'Материал: '+esc(terrainMaterial):'Кисть: '+esc(terrainBrush))+' · Радиус '+terrainOptions().radius.toFixed(1)+'</p>'+
   '<p class="hint">Один мазок — один Ctrl+Z. Escape отменяет незавершённый мазок.</p></div>';
  return;
 }
 var e=pick();$('rightTitle').textContent=e?e.name:'Не выбрано';if(!e){c.innerHTML='<div class="empty">Выбери объект, UI-элемент или скрипт слева. Все изменения сразу сохраняются в текущем проекте.</div>';return;}
if(selectedKind==='world'&&selectedIds.length>1){c.innerHTML='<p class="multinote"><b>Выделено объектов: '+selectedIds.length+'</b><br>Используй инструменты выравнивания, группы и манипуляторы X/Y/Z. Параметры отдельного объекта открываются обычным кликом.</p>';return;}var html=field('Название','name',e.name);if(selectedKind==='world'){html+=field('Тип объекта','type',e.type,'select',[['ground','Ground / платформа'],['block','Block'],['coin','Монета'],['goal','Финиш'],['spawn','Spawn'],['hazard','Объект опасности'],['glb','GLB'],['npc','NPC'],['movingPlatform','Движущаяся платформа']]);html+=vecField('Позиция X / Y / Z','position',e.position)+vecField('Поворот (градусы) X / Y / Z','rotation',e.rotation)+vecField('Масштаб X / Y / Z','scale',e.scale);html+=field('Группа (имя)','group',e.group||'');html+=field('Цвет','color',e.color||'#ffffff','color');html+='<div class="inspector-divider">PBR МАТЕРИАЛ</div>';var mc=materialConfig(e);html+=field('Металличность 0–1','mat_metalness',mc.metalness,'number')+field('Шероховатость 0–1','mat_roughness',mc.roughness,'number')+field('Прозрачность 0–1','mat_opacity',mc.opacity,'number')+field('Свечение','mat_emissive',mc.emissive,'color')+field('Сила свечения','mat_emissiveIntensity',mc.emissiveIntensity,'number');html+='<div class="fieldblock"><label>Текстура</label><select data-prop="mat_textureId"><option value="">Без текстуры</option>'+project.textures.map(function(t){return '<option value="'+esc(t.id)+'"'+(t.id===mc.textureId?' selected':'')+'>'+esc(t.name)+'</option>';}).join('')+'</select></div>';if(e.type==='glb')html+='<label class="hint"><input type="checkbox" data-checkbox="overrideGLB"'+(mc.overrideGLB?' checked':'')+'> Заменить встроенные материалы GLB</label><p class="hint">Без галочки исходные материалы GLB сохраняются.</p>';html+=field('Действие при касании / взаимодействии','action',e.action||'none','select',actionOpts);html+=field('Награда (монеты)','value',e.value||0,'number')+field('Сообщение','message',e.message||'')+field('ID целевого объекта','target',e.target||'');html+='<div class="hint" style="margin-top:12px">Для клика или E игрок должен находиться рядом. Монеты, опасности и финиш активируются также при касании.</div>';html+=componentMarkup(e);
}else if(selectedKind==='ui'){html+=field('Тип','type',e.type,'select',[['label','Текст'],['button','Кнопка'],['panel','Панель'],['progress','Полоска']])+field('Текст','text',e.text||'')+field('Привязка','bind',e.bind||'none','select',[['none','Нет'],['coins','Счётчик монет'],['health','Здоровье игрока'],['healthPercent','HP %'],['inventory','Предметов в инвентаре']]);html+=field('X (%)','x',e.x??0,'number')+field('Y (%)','y',e.y??0,'number')+field('Ширина (px)','width',e.width??150,'number')+field('Высота (px)','height',e.height??36,'number')+field('Размер шрифта','fontSize',e.fontSize??16,'number')+field('Цвет текста','color',e.color||'#ffffff','color')+field('Цвет фона','bgColor',e.bgColor||'#163851','color');html+=field('Действие кнопки','action',e.action||'none','select',[['none','Нет'],['coins','Добавить монеты'],['jump','Прыжок'],['win','Победа'],['message','Сообщение'],['reset','Рестарт'],['inventory','Открыть инвентарь'],['shop','Открыть магазин'],['buy','Купить предмет'],['giveItem','Выдать предмет'],['script','Только JS событие']]);html+=field('ID предмета','itemId',e.itemId||'')+field('Количество','value',e.value??1,'number')+field('Сообщение','message',e.message||'');
}else{html+=field('Событие','event',e.event||'start','select',[['start','При запуске'],['collect','Сбор монеты'],['interact','Взаимодействие'],['ui','Кнопка UI'],['win','Победа']]);html+='<label>JS-код</label><textarea id="scriptCode" class="code" spellcheck="false"></textarea><label style="margin-top:10px"><input data-checkbox="enabled" type="checkbox"'+(e.enabled?' checked':'')+'> Включён</label><p class="hint">api.addCoins(5);<br>api.message("Готово!");<br>ctx.id — ID объекта.<br>Ошибки скрипта показываются во время Play.</p>';}
html+='<div class="rowButtons"><button id="removeSelected">Удалить</button><button id="dupeSelected">Копировать</button></div>';c.innerHTML=html;if(selectedKind==='script')$('scriptCode').value=e.code||'';
c.querySelectorAll('[data-prop]').forEach(function(el){el.onchange=function(){remember();var key=this.dataset.prop,v=this.value;if(key.indexOf('mat_')===0){var mk=key.slice(4);if(!e.material)e.material={};e.material[mk]=['roughness','metalness','opacity','emissiveIntensity'].indexOf(mk)>=0?Math.max(0,Math.min(mk==='emissiveIntensity'?10:1,Number(v)||0)):v;}else{if(['x','y','value','width','height','fontSize'].includes(key))v=Number(v)||0;e[key]=v;}if(selectedKind==='world'){if(key==='type'&&e.type==='glb'&&!e.asset){e.type='block';status('Для GLB используй кнопку импорта.',true);}refreshScene();}refreshLists();if(selectedKind==='ui')refreshUiPreview();refreshInspector();};});
c.querySelectorAll('[data-vector]').forEach(function(el){el.onchange=function(){var v=+this.value;if(!isFinite(v))return;remember();var key=this.dataset.vector;e[key][+this.dataset.i]=key==='scale'?Math.max(.01,v):key==='rotation'?v*Math.PI/180:v;if(meshes[e.id]){meshes[e.id].position.fromArray(e.position);meshes[e.id].rotation.set.apply(meshes[e.id].rotation,e.rotation);meshes[e.id].scale.fromArray(e.scale);refreshSelection();}};});
var code=$('scriptCode');if(code){code.onfocus=function(){remember();};code.oninput=function(){e.code=this.value;};}c.querySelectorAll('[data-checkbox]').forEach(function(checkbox){checkbox.onchange=function(){remember();if(this.dataset.checkbox==='overrideGLB'){e.material=e.material||{};e.material.overrideGLB=this.checked;refreshScene();refreshInspector();}else e.enabled=this.checked;};});
$('removeSelected').onclick=deleteSelected;$('dupeSelected').onclick=duplicateSelected;if(selectedKind==='world')bindComponentInspector(c,e);}
function refreshUiPreview(){var p=$('uiPreview');p.innerHTML='';if(activeTab!=='ui'||playing)return;project.ui.forEach(function(u){var el=document.createElement('div');el.className='mock'+(u.type==='button'?' btn':'')+(u.type==='panel'?' panel':'')+(u.type==='progress'?' progress':'')+(selectedId===u.id&&selectedKind==='ui'?' selected':'');el.style.left=u.x+'%';el.style.top=u.y+'%';el.style.width=u.width+'px';el.style.height=(u.height||36)+'px';el.style.color=u.color||'#fff';el.style.backgroundColor=u.type==='progress'?'':(u.bgColor||'#163851');el.style.fontSize=(u.fontSize||16)+'px';el.textContent=u.text+(u.bind==='coins'?' : 0':u.bind==='health'?' : '+(project.settings.maxHealth||100):u.bind==='inventory'?' : 0':'');var dragStart=null;el.addEventListener('pointerdown',function(e){if(e.button!==0)return;e.stopPropagation();select('ui',u.id);var rect=p.getBoundingClientRect();dragStart={x:e.clientX,y:e.clientY,originX:+u.x||0,originY:+u.y||0,changed:false,width:rect.width||1,height:rect.height||1};el.setPointerCapture(e.pointerId);});el.addEventListener('pointermove',function(e){if(!dragStart)return;var nx=Math.max(0,Math.min(96,dragStart.originX+(e.clientX-dragStart.x)/dragStart.width*100)),ny=Math.max(0,Math.min(96,dragStart.originY+(e.clientY-dragStart.y)/dragStart.height*100));if(Math.abs(nx-u.x)+Math.abs(ny-u.y)<.15)return;if(!dragStart.changed){remember();dragStart.changed=true;}u.x=Math.round(nx*10)/10;u.y=Math.round(ny*10)/10;el.style.left=u.x+'%';el.style.top=u.y+'%';});el.addEventListener('pointerup',function(){var changed=dragStart&&dragStart.changed;dragStart=null;if(changed){refreshInspector();refreshUiPreview();}});p.appendChild(el);});}

function setTab(tab){var wasTerrain=activeTab==='terrain';activeTab=tab;if(tab==='terrain'&&toolMode!=='terrain')setTool('terrain');else if(wasTerrain&&tab!=='terrain'&&toolMode==='terrain')setTool('move');if(tab==='logic'){editorCamActive=false;editorKeys={};if(renderer)renderer.domElement.blur();}document.querySelectorAll('[data-tab]').forEach(function(el){el.classList.toggle('active',el.dataset.tab===tab);});$('worldTab').classList.toggle('hidden',tab!=='world');$('terrainTab').classList.toggle('hidden',tab!=='terrain');$('uiTab').classList.toggle('hidden',tab!=='ui');$('scriptsTab').classList.toggle('hidden',tab!=='scripts');$('logicTab').classList.toggle('hidden',tab!=='logic');$('logicCanvas').classList.toggle('hidden',tab!=='logic');if(tab==='logic')refreshLogicEditor();if(tab==='ui')renderShopCatalog();refreshInspector();refreshUiPreview();}
function addObject(type){remember();var d={id:id(),name:({ground:'Платформа',block:'Куб',coin:'Монета',goal:'Финиш',spawn:'Spawn',hazard:'Лава',npc:'NPC',movingPlatform:'Движущаяся платформа'})[type],type:type,position:[0,type==='coin'||type==='goal'?1:type==='block'?0.5:type==='npc'?0:type==='movingPlatform'?.5:type==='ground'?-0.5:0,0],rotation:[0,0,0],scale:type==='ground'?[5,1,5]:type==='movingPlatform'?[3,.5,3]:[1,1,1],color:({ground:'#547f75',block:'#589eb8',coin:'#ffe083',goal:'#62d9ec',spawn:'#68eabe',hazard:'#ff694c',npc:'#ba90da',movingPlatform:'#64bbd8'})[type],solid:!(type==='coin'||type==='goal'||type==='spawn'||type==='hazard'),action:({coin:'collect',goal:'win',hazard:'hazard'})[type]||'none',value:1};if(type==='npc')d.components=[gameplayComponentDefaults('npc')];if(type==='movingPlatform')d.components=[gameplayComponentDefaults('movingPlatform')];project.objects.push(d);createVisual(d);setTab('world');select('world',d.id);status('Добавлен объект '+d.name);}
function addUI(type){remember();var d={id:id(),name:type==='button'?'Кнопка':type==='panel'?'Панель':type==='progress'?'HP-полоска':'Надпись',type:type,text:type==='button'?'Нажми меня':type==='progress'?'HP':'Новый текст',bind:type==='progress'?'healthPercent':'none',x:5,y:type==='button'?15:8,width:type==='panel'?260:160,height:type==='panel'?85:type==='progress'?24:38,fontSize:17,color:'#ffffff',bgColor:'#163851',action:type==='button'?'message':'none',message:'Привет!',value:1,itemId:''};project.ui.push(d);setTab('ui');select('ui',d.id);refreshUiPreview();}
function renderShopCatalog(){var host=$('shopCatalogEditor');if(!host)return;host.innerHTML='';(project.items||[]).forEach(function(item){var row=document.createElement('div');row.className='shop-row';[['ID','id','text'],['Название','name','text'],['Цена','price','number'],['Лимит','maxStack','number']].forEach(function(spec){var label=document.createElement('label');label.textContent=spec[0];var input=document.createElement('input');input.type=spec[2];input.value=item[spec[1]]??'';input.onchange=function(){remember();item[spec[1]]=spec[2]==='number'?Math.max(0,Math.round(+this.value||0)):this.value.trim().slice(0,80);renderShopCatalog();};label.appendChild(input);row.appendChild(label);});var del=document.createElement('button');del.className='full';del.textContent='Удалить · '+item.name;del.onclick=function(){remember();project.items=project.items.filter(function(x){return x!==item;});renderShopCatalog();};row.appendChild(del);host.appendChild(row);});}
function addShopItem(){remember();var n=(project.items||[]).length+1;project.items.push({id:'item'+n,name:'Предмет '+n,description:'',price:5,maxStack:99,icon:'✦'});renderShopCatalog();status('Предмет добавлен в каталог.');}
function addUiDemo(){remember();project.items=project.items||[];if(!project.items.some(function(x){return x.id==='speedboost';}))project.items.push({id:'speedboost',name:'Усиление',description:'Коллекционный предмет',price:3,maxStack:9,icon:'✦'});[['btn_inv','Инвентарь','inventory',79,17],['btn_shop','Магазин','shop',79,25],['hud_bag','Рюкзак','none',3,12]].forEach(function(row){if(project.ui.some(function(x){return x.id===row[0];}))return;project.ui.push({id:row[0],name:row[1],type:row[2]==='none'?'label':'button',text:row[1],bind:row[2]==='none'?'inventory':'none',x:row[3],y:row[4],width:155,height:34,fontSize:15,color:'#ffffff',bgColor:'#244e64',action:row[2],value:1,itemId:''});});setTab('ui');refreshLists();refreshUiPreview();renderShopCatalog();status('HUD / магазин добавлены. Открой PLAY и нажми «Магазин».');}
function addScript(){remember();var d={id:id(),name:'Новый скрипт',event:'interact',enabled:true,code:'// Вызывается при взаимодействии с объектом\napi.message("Взаимодействие с " + ctx.name);'};project.scripts.push(d);setTab('scripts');select('script',d.id);}
function refreshAfterBatch(note){selectedObjects().forEach(function(o){var m=meshes[o.id];if(m){m.position.fromArray(o.position);m.rotation.set.apply(m.rotation,o.rotation);m.scale.fromArray(o.scale);}});refreshLists();refreshInspector();refreshSelection();updateGizmo();status(note);}
function alignSelection(axis){var objects=selectedObjects();if(objects.length<2)return;remember();var i='xyz'.indexOf(axis),avg=objects.reduce(function(a,o){return a+o.position[i];},0)/objects.length;objects.forEach(function(o){o.position[i]=avg;});refreshAfterBatch('Выравнивание по '+axis.toUpperCase()+' · '+objects.length+' объектов');}
function distributeSelection(axis){var objects=selectedObjects();if(objects.length<3){status('Для распределения нужно минимум 3 объекта.',true);return;}var i='xyz'.indexOf(axis);objects.sort(function(a,b){return a.position[i]-b.position[i];});var min=objects[0].position[i],max=objects[objects.length-1].position[i];remember();objects.forEach(function(o,n){o.position[i]=min+(max-min)*n/(objects.length-1);});refreshAfterBatch('Распределено '+objects.length+' объектов по '+axis.toUpperCase());}
function groupSelected(){var objs=selectedObjects();if(!objs.length)return;var name=prompt('Название группы (организация объектов, без изменения мировых координат):','Группа 1');if(name===null)return;name=name.trim().slice(0,70);if(!name){status('Нужно имя группы.',true);return;}remember();objs.forEach(function(o){o.group=name;});refreshAfterBatch('Группа «'+name+'»: '+objs.length+' объектов');}
function ungroupSelected(){var objs=selectedObjects();if(!objs.length)return;remember();objs.forEach(function(o){delete o.group;});refreshAfterBatch('Убрана группировка для '+objs.length+' объектов');}
function deleteSelected(){if(!selectedId)return;remember();if(selectedKind==='world'){
 var remove=new Set(selectedIds),index=project.objects.findIndex(function(o){return o.id===selectedId;});project.objects=project.objects.filter(function(o){return !remove.has(o.id);});refreshScene();var next=project.objects[Math.min(index,project.objects.length-1)];select('world',next&&next.id||null);status('Удалено '+remove.size+' объектов');
 }else{var arr=selectedKind==='ui'?project.ui:project.scripts,i=arr.findIndex(function(x){return x.id===selectedId;});if(i>=0)arr.splice(i,1);select(selectedKind,arr[i]&&arr[i].id||arr[i-1]&&arr[i-1].id||null);}refreshUiPreview();}
function duplicateSelected(){var e=pick();if(!e)return;remember();if(selectedKind==='world'){
 var copies=selectedObjects().map(function(o){var c=clone(o);c.id=id();c.name+=' копия';c.position[0]+=1.3;return c;});copies.forEach(function(c){project.objects.push(c);createVisual(c);});setSelectedIds(copies.map(function(o){return o.id;}),copies[copies.length-1].id);status('Создано копий: '+copies.length);
 }else{var c=clone(e);c.id=id();c.name+=' копия';if(selectedKind==='ui'){c.y+=7;project.ui.push(c);}else project.scripts.push(c);select(selectedKind,c.id);}refreshUiPreview();}
function cleanDoc(){project.name=$('projectName').value.trim().slice(0,80)||'Новая игра';return clone(project);}
function exportGameDoc(){var out=cleanDoc();var a=new Set(out.objects.map(function(o){return o.assetId;}).filter(Boolean));var t=new Set(out.objects.map(function(o){return o.material&&o.material.textureId;}).filter(Boolean));out.assets=out.assets.filter(function(asset){return a.has(asset.id);});out.textures=out.textures.filter(function(tex){return t.has(tex.id);});delete out.prefabs;return out;}
function gameHtml(preview,standalone){
var data=JSON.stringify(exportGameDoc()).replace(/</g,'\\u003c');
var loader=$('embedded-gltf-loader').textContent,engine=$('embedded-game-runtime').textContent,gameplaySource=$('embedded-gameplay-core').textContent,economySource=$('embedded-economy-core').textContent,terrainSource=$('embedded-terrain-core').textContent;
var open='<scr'+'ipt',end='</scr'+'ipt>',title=esc(project.name);
var css='*{box-sizing:border-box}html,body{height:100%;margin:0;overflow:hidden;background:#0b1830;font-family:Segoe UI,Arial,sans-serif}#game{position:absolute;inset:0}#game canvas{width:100%;height:100%;display:block;touch-action:none}#hud{position:absolute;inset:0;pointer-events:none}#hud .custom-ui{position:absolute;white-space:nowrap;pointer-events:auto;min-height:31px;padding:7px;border-radius:8px;text-shadow:0 1px 4px #172338;background:#08152dbb;font-weight:700}#hud .ui-button{border:1px solid #91e8f5;background:#218ba0;cursor:pointer}#notice{position:absolute;top:17%;left:50%;transform:translateX(-50%);background:#091b2fd9;border:1px solid #74b7d0;color:white;font-size:19px;padding:12px 22px;border-radius:10px;display:none;max-width:90%;text-align:center}#win{position:absolute;inset:0;background:#07111cbb;display:grid;place-content:center;text-align:center;gap:15px;color:#fff;font-size:36px;font-weight:900;z-index:10}#win[hidden]{display:none}#win button{padding:14px 25px;background:#4bdab0;color:#072a22;border:0;border-radius:10px;font-size:19px;cursor:pointer}#bootIndicator{position:absolute;inset:0;z-index:20;background:#071523;color:#e2f7ff;display:grid;place-items:center;text-align:center;padding:25px;font-size:16px;white-space:pre-wrap}#objective{position:absolute;right:16px;top:16px;color:#fff;font-weight:800;padding:9px 14px;border-radius:9px;background:#112d3fce;border:1px solid #5eb7c8}#health{position:absolute;top:59px;right:16px;background:#3c1524df;border:1px solid #c65b70;color:#ffdee2;border-radius:8px;padding:7px 11px;font-weight:800;pointer-events:none}#bridgeModal button:hover{filter:brightness(1.12)}#help{position:absolute;left:14px;bottom:15px;color:#f2f8ff;background:#071c30bb;border-radius:8px;padding:10px 14px;font-size:12px;pointer-events:none}';
// An inert script bundle lets the bootstrap check Three.js BEFORE evaluating the runtime.
var bootCode='(function(){'+
'var started=false;var urls='+JSON.stringify(preview?[]:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'])+';'+
'var failures=[],index=0;'+
'function send(kind,msg){try{if(window.parent!==window)window.parent.postMessage({bridgeGame:kind,detail:String(msg)},"*");}catch(e){}}'+
'function fail(s){var str=String(s||"Unknown error");var b=document.getElementById("bootIndicator");if(b){b.style.display="grid";b.textContent="Не удалось запустить игру.\\n\\n"+str;}send("error",str);console.error("Bridge Play:",str);}'+
'window.addEventListener("error",function(e){if(e.target&&e.target.tagName==="SCRIPT")return;var info=(e.message||"Script error.")+(e.filename?"\\n"+e.filename+":"+e.lineno+":"+e.colno:"")+(e.error&&e.error.stack?"\\n"+e.error.stack:"");if(info==="Script error.")info="Скрипт браузера завершился без подробностей (CORS). Источники: "+urls.join(", ");fail(info);},true);'+
'window.addEventListener("unhandledrejection",function(e){fail(e.reason&&e.reason.stack||e.reason&&e.reason.message||e.reason||"Promise rejected");});'+
'function start(){if(started)return;if(!window.THREE){tryNext();return;}started=true;try{(0,eval)(document.getElementById("bridge-runtime-bundle").textContent);}catch(e){fail("Ошибка запуска runtime: "+(e.stack||e.message||e));}}'+
'function tryNext(){if(window.THREE){start();return;}if(index>=urls.length){fail("Three.js недоступен. "+failures.join(" | "));return;}var url=urls[index++];if(!url){tryNext();return;}var sc=document.createElement("script");sc.src=url;sc.crossOrigin="anonymous";sc.onload=function(){if(window.THREE)start();else{failures.push(url+" loaded without THREE");tryNext();}};sc.onerror=function(){failures.push("Не загружен "+url);tryNext();};document.head.appendChild(sc);}'+
'start();setTimeout(function(){if(!started)fail("Таймаут запуска Three.js. "+failures.join(" | "));},12500);})();';
var html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+css+'</style></head><body><div id="game"></div><div id="bootIndicator">Загрузка Three.js и 3D-сцены…</div><div id="hud"></div><div id="objective"></div><div id="health">♥ 100 / 100</div><div id="notice"></div><div id="win" hidden><div>ПОБЕДА!</div><button id="retry">Ещё раз</button></div><div id="help">WASD — движение · SPACE — прыжок · E — действие · V — камера · I — инвентарь · B — магазин · мышь — осмотр</div>'+
open+'>var SND={init:function(){},play:function(){}};'+end+
((preview||standalone)?'':open+' src="../../Playding/js/auth.js?v=2">'+end)+
open+' id="bridge-game-data" type="application/json">'+data+end+
open+' id="bridge-runtime-bundle" type="text/plain">var T=window.THREE,runtime={files:[],fileUrls:[]};function warn(s){console.warn("Bridge GLB:",s);}'+terrainSource+'\n'+gameplaySource+'\n'+economySource+'\n'+loader+'\n'+engine+end+
open+'>'+bootCode+end+'</body></html>';
return html;
}
var warpgameMaxBytes=3000000;
function projectAudit(){
 if(project&&$('projectName'))project.name=$('projectName').value.trim()||project.name;
 var errors=[],warnings=[],count={objects:0,glb:0,scripts:0,ui:0};
 if(!project||!Array.isArray(project.objects)||!Array.isArray(project.ui)||!Array.isArray(project.scripts))return {errors:['Проект отсутствует или имеет неверную структуру'],warnings:[],count:count};
 var ids={};count.objects=project.objects.length;count.ui=project.ui.length;count.scripts=project.scripts.length;
 project.objects.forEach(function(o,i){var loc='Объект '+(i+1)+' ('+(o.name||o.id||'?')+')';if(!o.id||ids[o.id])errors.push(loc+': повторяющийся или пустой ID');ids[o.id]=true;
 ['position','rotation','scale'].forEach(function(k){if(!Array.isArray(o[k])||o[k].length!==3||o[k].some(function(v){return typeof v!=='number'||!isFinite(v);})){errors.push(loc+': неправильный вектор '+k);}});
 if(Array.isArray(o.scale)&&o.scale.some(function(v){return v<=0;}))errors.push(loc+': масштаб должен быть положительным');
 if(o.type==='glb'){count.glb++;var asset=getAsset(o);if(!asset)errors.push(loc+': отсутствует GLB-ассет '+(o.assetId||''));else if(asset.length>2.8e6)warnings.push(loc+': большая GLB-модель');}if(o.material&&o.material.textureId&&!project.textures.some(function(t){return t.id===o.material.textureId;}))errors.push(loc+': текстура не найдена');
 });
 project.objects.forEach(function(o){if((o.action==='teleport'||o.action==='toggle')&&o.target&&!ids[o.target])warnings.push('Объект «'+(o.name||o.id)+'»: не найден ID цели «'+o.target+'»');});
 project.scripts.forEach(function(sc,i){if(!sc.enabled)return;try{new Function('api','ctx','state','"use strict";\n'+(sc.code||''));}catch(e){errors.push('Скрипт «'+(sc.name||i)+'»: '+e.message);}});
 var raw=JSON.stringify(exportGameDoc()),estimated=raw.length+document.getElementById('embedded-gltf-loader').textContent.length+document.getElementById('embedded-game-runtime').textContent.length+document.getElementById('embedded-economy-core').textContent.length+10000;
 if((!$('exportProfile')||$('exportProfile').value==='warpgame')&&estimated>warpgameMaxBytes)warnings.push('Оценка размера HTML превышает 3 МБ: '+(estimated/1000000).toFixed(2)+' МБ');
 return {errors:errors,warnings:warnings,count:count,estimatedBytes:estimated};
}
function checkProject(){var a=projectAudit(),body=['Проверка проекта: '+(a.errors.length?'ошибки найдены':'ошибок не обнаружено'), 'Объектов '+a.count.objects+', GLB '+a.count.glb+', UI '+a.count.ui+', скриптов '+a.count.scripts];if(a.errors.length)body.push('ОШИБКИ:',a.errors.join('\n'));if(a.warnings.length)body.push('ПРЕДУПРЕЖДЕНИЯ:',a.warnings.join('\n'));$('auditReport').textContent=body.join('\n');$('auditReport').classList.toggle('warn',a.errors.length>0);status(a.errors.length?'Проект: '+a.errors.length+' ошибок':'Проверка проекта пройдена'+(a.warnings.length?' · предупреждений: '+a.warnings.length:''),a.errors.length>0);return a;}
function validate(){var a=projectAudit();if(a.errors.length)throw Error('Проверка проекта: '+a.errors[0]+(a.errors.length>1?' (и ещё '+(a.errors.length-1)+')':''));return true;}
function showPlayDiagnostic(msg){var text=String(msg||'Неизвестная ошибка');$('playDiagnosticText').textContent=text; $('playDiagnostic').hidden=false;status('Play: '+text,true);clearTimeout(playWatchdog);}
window.addEventListener('message',function(e){var d=e.data;if(!playing||e.origin!=='null'||!d||typeof d.bridgeGame!=='string'||e.source!==$('playFrame').contentWindow)return;if(d.detail!==undefined&&(typeof d.detail!=='string'||d.detail.length>8192))return;if(d.bridgeGame==='ready'){if(window.__bridgePlayReady)window.__bridgePlayReady();status('Play: 3D-кадр отрисован. Игра готова.');}else if(d.bridgeGame==='error')showPlayDiagnostic(d.detail||'Неизвестная ошибка игрового рендера');else if(d.bridgeGame==='script-warning')status('Предупреждение сценария: '+d.detail,true);});
function embedEngine(html,source){
   var marker='<script id="bridge-game-data"',point=html.indexOf(marker);
   if(point<0)throw Error('OFFLINE экспорт: не найден раздел данных игры.');
   // Escape the HTML script terminator without modifying JavaScript semantics.
   return html.slice(0,point)+'<script>'+"/*\nThree.js — The MIT License (MIT)\nCopyright (c) 2010-2021 three.js authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE SOFTWARE.\n*/\n"+source.replace(/<\/script/gi,'<\\/script')+'</'+'script>'+html.slice(point);
}
// The editor reads the engine. The preview receives its own copy and no host URL.
var previewSource=null,previewGeneration=0,previewURL=null;
function readPreviewSource(){
 if(!previewSource){
  previewSource=fetch(window.__bridgeThreeLoad.source||'three.min.js').then(async function(response){
   if(!response.ok)throw Error('Не удалось прочитать Three.js для Play.');
   var source=await response.text();
   if(source.length<150000||!source.includes('WebGLRenderer'))throw Error('Повреждена библиотека Three.js.');
   return source;
  }).catch(function(err){previewSource=null;throw err;});
 }
 return previewSource;
}
function releasePreview(){
 if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
}
async function play(){
 var generation=++previewGeneration;
 try{
 validate();
 var source=await readPreviewSource();
 if(generation!==previewGeneration)return;
$('playDiagnostic').hidden=true;var gotReady=false;clearTimeout(playWatchdog);playWatchdog=setTimeout(function(){if(playing&&!gotReady)showPlayDiagnostic('Игра не подтвердила первый 3D-кадр. Возможная причина — CDN, WebGL или ошибка JavaScript. Проверь консоль и доступность cdnjs.');},11500);window.__bridgePlayReady=function(){gotReady=true;clearTimeout(playWatchdog);};var html=embedEngine(gameHtml(true),source);
 var policy="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; worker-src 'none'";
 html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="referrer" content="no-referrer">');
 releasePreview();
 previewURL=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
 $('playFrame').onload=function(){try{$('playFrame').focus();$('playFrame').contentWindow.focus();}catch(e){}};$('playFrame').src=previewURL;$('playFrame').setAttribute('tabindex','0');$('playFrame').classList.remove('hidden');$('playBanner').classList.remove('hidden');$('btnStop').classList.remove('hidden');$('btnPlay').classList.add('hidden');$('emptyHint').classList.add('hidden');$('uiPreview').classList.add('hidden');playing=true;status('Play запущен · WASD — ходьба, мышь — камера, Space — прыжок.');}catch(e){if(generation===previewGeneration){stop();showPlayDiagnostic(e.message);}}}
function stop(){++previewGeneration;editorKeys={};clearTimeout(playWatchdog);$('playDiagnostic').hidden=true;playing=false;$('playFrame').src='about:blank';releasePreview();$('playFrame').classList.add('hidden');$('playBanner').classList.add('hidden');$('btnStop').classList.add('hidden');$('btnPlay').classList.remove('hidden');$('emptyHint').classList.remove('hidden');$('uiPreview').classList.remove('hidden');refreshUiPreview();status('Режим редактирования.');}
async function build(){try{
 validate();
 var mode=$('exportProfile').value,offline=mode==='offline',standalone=mode!=='warpgame';
 var html=gameHtml(false,standalone),engineSize=0;
 if(offline){
   // True self-contained HTML: the r128 library is embedded as executable code.
   // Do not silently fall back to a CDN if the local cache cannot be fetched.
   var response=await fetch('three.min.js',{cache:'no-store'});
   if(!response.ok)throw Error('OFFLINE экспорт: локальный three.min.js не найден. Запусти Windows-приложение с интернетом один раз для кэширования движка.');
   var source=await response.text();
   if(source.length<150000||source.indexOf('WebGLRenderer')<0||source.indexOf('REVISION')<0)throw Error('OFFLINE экспорт: файл Three.js недействителен. Нужна полная Three.js r128.');
   html=embedEngine(html,source);
   engineSize=new Blob([source]).size;
 }
 var bytes=new Blob([html]).size,ok=standalone||bytes<=warpgameMaxBytes;
 var profile=offline?'Standalone OFFLINE':standalone?'Standalone HTML':'WARPGAME HTML';
 $('buildReport').innerHTML='<strong class="'+(ok?'good':'warn')+'">'+profile+': ' + bytes.toLocaleString('ru-RU')+' байт · '+(standalone?'без ограничения размера':ok?'в пределах 3 МБ':'ЛИМИТ ПРЕВЫШЕН')+'</strong><p class="hint">'+(offline?'Полностью автономный HTML: Three.js r128 встроен ('+(engineSize/1024).toFixed(0)+' КБ). Сеть для запуска игры не нужна.':standalone?'Обычная браузерная игра, без Playding auth.js. Three.js загружается с CDN.':ok?'Сборка готова к тесту на WARPGAME.':'Уменьши размер GLB для WARPGAME или переключи профиль Standalone.')+'</p>';
 if(!ok){status('Экспорт WARPGAME остановлен. Превышение на '+(bytes-warpgameMaxBytes).toLocaleString('ru-RU')+' байт. Подробности в отчёте Build.',true);return;}
 dl(html,(offline?'OFFLINE-':standalone?'GAME-':'WARPGAME-')+(project.name||'game').replace(/[^a-zа-я0-9_-]+/gi,'-').slice(0,50)+'.html','text/html');status('Экспорт '+profile+': '+(bytes/1024).toFixed(0)+' КБ'+(ok?'':' · превышен лимит WARPGAME'),!ok);}catch(e){status(e.message,true);}}
function sceneData(){return JSON.stringify(cleanDoc());}
function downloadScene(data){
 dl(data,(project.name||'project').replace(/[^a-zа-я0-9_-]+/gi,'-')+'.rwscene','application/json');
}
function save(){
 try{
  var data=sceneData();downloadScene(data);
  if(data!==lastExplicitSave)setDirty(true);
  recordSnapshot(true);status('Скачивание .rwscene запрошено. Проверь файл в загрузках браузера.');
 }catch(e){status(e.message,true);}
}
var writingScene=false;
async function writeScene(data){
 if(writingScene)throw Error('Уже идёт запись проекта.');
 writingScene=true;
 var source=project,stream;
 try{
  var handle=nativeHandle||await window.showSaveFilePicker({suggestedName:(project.name||'project')+'.rwscene',types:[{description:'Bridge Studio scene',accept:{'application/json':['.rwscene']}}]});
  if(source!==project||data!==sceneData())throw Error('Проект изменился. Повтори сохранение.');
  stream=await handle.createWritable();await stream.write(data);await stream.close();stream=null;
  if(source!==project||data!==sceneData())throw Error('Во время записи проект изменился. Сохрани текущую версию.');
  nativeHandle=handle;lastExplicitSave=data;setDirty(false);
  return handle.name;
 }finally{
  try{if(stream)await stream.abort();}catch(e){}
  writingScene=false;
 }
}
async function saveNative(){
 if(!window.showSaveFilePicker){save();return;}
 try{
  var name=await writeScene(sceneData());
  recordSnapshot(true);status('Проект записан в файл: '+name);
 }catch(e){status(e.name==='AbortError'?'Сохранение отменено.':'Запись в файл: '+e.message,true);}
}
function verifyLoadedDoc(obj){
 if(!obj||obj.format!=='rwbridge.game'||obj.version!==2||!Array.isArray(obj.objects)||!Array.isArray(obj.ui)||!Array.isArray(obj.scripts))throw Error('Неподдерживаемый формат проекта. Нужна версия 2 (.rwscene).');
 if(obj.objects.length>10000)throw Error('Слишком много объектов (максимум 10000).');
 if(!obj.settings||typeof obj.settings!=='object')throw Error('Отсутствуют настройки сцены');
  if(obj.terrain!==undefined)window.BridgeTerrainCore.validate(obj.terrain);
 if(obj.assets!==undefined&&!Array.isArray(obj.assets))throw Error('Некорректная библиотека ассетов');
 if(obj.textures!==undefined&&!Array.isArray(obj.textures))throw Error('Некорректная библиотека текстур');
 if(obj.prefabs!==undefined&&!Array.isArray(obj.prefabs))throw Error('Некорректная библиотека Prefab');if(obj.graphs!==undefined&&!Array.isArray(obj.graphs))throw Error('Некорректные графы логики');
 var assets=new Set(),textures=new Set(),ids=new Set();
 (obj.assets||[]).forEach(function(a,i){if(!a||!a.id||assets.has(a.id)||typeof a.data!=='string'||!a.data.length)throw Error('Повреждённый GLB-ассет #'+i);assets.add(a.id);});
 (obj.textures||[]).forEach(function(t,i){if(!t||!t.id||textures.has(t.id)||typeof t.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,/i.test(t.data))throw Error('Повреждённая текстура #'+i);textures.add(t.id);});
 function check(o,i,prefab){if(!o||typeof o!=='object'||typeof o.id!=='string'||!o.id||(!prefab&&ids.has(o.id)))throw Error('Повторяющийся или пустой ID объекта #'+i);if(!prefab)ids.add(o.id);
 ['position','rotation','scale'].forEach(function(k){if(!Array.isArray(o[k])||o[k].length!==3||o[k].some(function(v){return typeof v!=='number'||!Number.isFinite(v);})){throw Error('Повреждён вектор '+k+' у объекта #'+i);}});
 if(o.scale.some(function(x){return x<=0;}))throw Error('Некорректный масштаб у объекта #'+i);
 if(o.type==='glb'&&!(typeof o.asset==='string'&&o.asset.length>0)&&!assets.has(o.assetId))throw Error('Отсутствует GLB у объекта #'+i);
 if(o.material&&o.material.textureId&&!textures.has(o.material.textureId))throw Error('Не найдена текстура у объекта #'+i);
 }
 obj.objects.forEach(function(o,i){check(o,i,false);});
 (obj.prefabs||[]).forEach(function(p,i){if(!p||!p.id||!Array.isArray(p.objects)||p.objects.length>2000)throw Error('Повреждён Prefab #'+i);p.objects.forEach(function(o,j){check(o,j,true);});});
 var validation=window.BridgeGameplayCore.validate(obj);if(validation.errors.length)throw Error('Неверная визуальная логика: '+validation.errors[0]);return obj;
} 
function loadDoc(obj,fromFile){verifyLoadedDoc(obj);if(project)recordSnapshot(true);stop();resetTextureCache();closeAssetPreview();assetThumbCache={};project=normalizeDoc(clone(obj));refreshAssetBrowser();refreshLightingControls();nativeHandle=null;draftLast='';setDirty(false);undoStack=[];redoStack=[];$('projectName').value=project.name;syncGameSettings();refreshScene();select('world',project.objects[0]&&project.objects[0].id);setTab('world');lastExplicitSave=fromFile?sceneData():'';setDirty(!fromFile);status('Проект открыт: '+project.name);}
/* Three.js r128 axis manipulators. Objects are edited in world axes, not via numeric fields. */
function setTool(mode){if(['move','rotate','scale','terrain'].indexOf(mode)<0)return;if(terrainStroke)endTerrainStroke(false);toolMode=mode;if(mode!=='terrain')hideTerrainCursor();if(gridHelper)gridHelper.visible=mode!=='terrain'&&$('gridEnabled').checked;document.querySelectorAll('[data-tool]').forEach(function(btn){btn.classList.toggle('selected',btn.dataset.tool===mode);});makeGizmo();refreshSelection();}
function axisVector(which){return which==='x'?new T.Vector3(1,0,0):which==='y'?new T.Vector3(0,1,0):new T.Vector3(0,0,1);}
function makeGizmo(){if(!editorScene||!T)return;if(gizmo){editorScene.remove(gizmo);gizmo.traverse(function(c){if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});}gizmo=new T.Group();gizmo.userData.bridgeGizmo=true;editorScene.add(gizmo);gizmoHits=[];
['x','y','z'].forEach(function(which){var v=axisVector(which),color={x:0xff6176,y:0x73ef9d,z:0x64aaff}[which];var mat=new T.MeshBasicMaterial({color:color,depthTest:false,depthWrite:false,side:T.DoubleSide});
var part;if(toolMode==='rotate'){part=new T.Mesh(new T.TorusGeometry(.78,.045,10,64),mat);if(which==='x')part.rotation.y=Math.PI/2;else if(which==='y')part.rotation.x=Math.PI/2;part.renderOrder=1001;gizmo.add(part);var pick=new T.Mesh(new T.TorusGeometry(.78,.12,10,64),new T.MeshBasicMaterial({visible:false,side:T.DoubleSide}));pick.rotation.copy(part.rotation);pick.userData.bridgeAxis=which;gizmo.add(pick);gizmoHits.push(pick);
}else {part=new T.Mesh(new T.CylinderGeometry(.027,.027,.82,10),mat);part.position.copy(v.clone().multiplyScalar(.50));part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v);part.renderOrder=1001;gizmo.add(part);var cap=new T.Mesh(toolMode==='scale'?new T.BoxGeometry(.19,.19,.19):new T.ConeGeometry(.095,.23,12),mat.clone());cap.position.copy(v.clone().multiplyScalar(.98));if(toolMode!=='scale')cap.quaternion.copy(part.quaternion);cap.renderOrder=1001;gizmo.add(cap);var pick=new T.Mesh(new T.CylinderGeometry(.13,.13,1.17,10),new T.MeshBasicMaterial({visible:false}));pick.position.copy(v.clone().multiplyScalar(.53));pick.quaternion.copy(part.quaternion);pick.userData.bridgeAxis=which;gizmo.add(pick);gizmoHits.push(pick);}
});gizmo.visible=selectedKind==='world'&&!!meshes[selectedId];}
function updateGizmo(){if(!gizmo||!gizmo.visible)return;var m=meshes[selectedId];if(!m){gizmo.visible=false;return;}if(selectedIds.length>1)gizmo.position.fromArray(selectionCenter());else m.getWorldPosition(gizmo.position);var distance=editorCamera.position.distanceTo(gizmo.position),factor=Math.max(.25,distance*.105);gizmo.scale.setScalar(factor);}
function getRay(e){var cv=renderer.domElement,rect=cv.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),editorCamera);return ray;}
function axisHit(e){if(!gizmo||!gizmo.visible)return null;var hits=getRay(e).intersectObjects(gizmoHits,false);return hits.length?hits[0].object.userData.bridgeAxis:null;}
function startGroundDrag(e,objectId){var data=project.objects.find(function(x){return x.id===objectId;});if(!data)return;remember();var point=getRay(e).ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-data.position[1]),new T.Vector3());if(!point){undoStack.pop();return;}axisDrag={mode:'ground',axis:'xz',targets:selectedObjects().map(function(o){return {data:o,position:o.position.slice(),rotation:o.rotation.slice(),scale:o.scale.slice()};}),center:selectionCenter(),data:data,startPoint:point.clone(),startPositions:data.position.slice(),snap:!!$('snapEnabled').checked,changed:false};}
function startAxisDrag(e,which){var data=pick();if(!data)return;remember();var axis=axisVector(which),center=selectedIds.length>1?new T.Vector3().fromArray(selectionCenter()):meshes[data.id].getWorldPosition(new T.Vector3());var cameraVec=editorCamera.position.clone().sub(center);var planeNormal,plane;
if(toolMode==='rotate')planeNormal=axis.clone();else{planeNormal=cameraVec.clone().addScaledVector(axis,-cameraVec.dot(axis));if(planeNormal.lengthSq()<.0001)planeNormal=new T.Vector3(0,1,0).addScaledVector(axis,-axis.y);if(planeNormal.lengthSq()<.0001)planeNormal=new T.Vector3(0,0,1);planeNormal.normalize();}
plane=new T.Plane().setFromNormalAndCoplanarPoint(planeNormal,center);var startPoint=getRay(e).ray.intersectPlane(plane,new T.Vector3());if(!startPoint)startPoint=center.clone().add(axis);
axisDrag={axis:which,mode:toolMode,targets:selectedObjects().map(function(o){return {data:o,position:o.position.slice(),rotation:o.rotation.slice(),scale:o.scale.slice()};}),groupCenter:selectionCenter(),data:data,center:center,axisVec:axis,plane:plane,startPoint:startPoint.clone(),startPositions:data.position.slice(),startRotation:data.rotation.slice(),startScale:data.scale.slice(),snap:!!$('snapEnabled').checked,changed:false};}
function applyAxisDrag(e){var d=axisDrag;if(!d)return;var plane=d.mode==='ground'?new T.Plane(new T.Vector3(0,1,0),-d.startPositions[1]):d.plane;var pos=getRay(e).ray.intersectPlane(plane,new T.Vector3());if(!pos)return;if(d.mode==='ground'){var delta=pos.clone().sub(d.startPoint);var x=d.startPositions[0]+delta.x,z=d.startPositions[2]+delta.z;d.data.position[0]=d.snap?Math.round(x/.25)*.25:x;d.data.position[2]=d.snap?Math.round(z/.25)*.25:z;var dx=d.data.position[0]-d.startPositions[0],dz=d.data.position[2]-d.startPositions[2];d.targets.forEach(function(t){if(t.data===d.data)return;t.data.position[0]=t.position[0]+dx;t.data.position[2]=t.position[2]+dz;var m=meshes[t.data.id];if(m)m.position.fromArray(t.data.position);});var groundMesh=meshes[d.data.id];if(groundMesh)groundMesh.position.fromArray(d.data.position);d.changed=true;refreshInspector();if(outline)outline.update();updateGizmo();return;}var idx='xyz'.indexOf(d.axis);var snap=d.snap;
if(d.mode==='move'){var distance=pos.clone().sub(d.startPoint).dot(d.axisVec);var v=d.startPositions[idx]+distance;d.data.position[idx]=snap?Math.round(v/.25)*.25:v;}
else if(d.mode==='scale'){var delta=pos.clone().sub(d.startPoint).dot(d.axisVec);var scale=Math.max(.05,d.startScale[idx]+delta*.65);d.data.scale[idx]=snap?Math.max(.05,Math.round(scale/.1)*.1):scale;}
else if(d.mode==='rotate'){var a=d.startPoint.clone().sub(d.center),b=pos.clone().sub(d.center);a.addScaledVector(d.axisVec,-a.dot(d.axisVec));b.addScaledVector(d.axisVec,-b.dot(d.axisVec));if(a.lengthSq()<1e-6||b.lengthSq()<1e-6)return;a.normalize();b.normalize();var angle=Math.atan2(new T.Vector3().crossVectors(a,b).dot(d.axisVec),a.dot(b)),v=d.startRotation[idx]+angle;d.data.rotation[idx]=snap?Math.round(v/(Math.PI/12))*(Math.PI/12):v;}
if(d.targets.length>1){
 var center=d.groupCenter, delta;
 if(d.mode==='move'){delta=d.data.position[idx]-d.startPositions[idx];d.targets.forEach(function(t){if(t.data!==d.data)t.data.position[idx]=t.position[idx]+delta;});}
 if(d.mode==='rotate'){delta=d.data.rotation[idx]-d.startRotation[idx];var co=Math.cos(delta),si=Math.sin(delta);d.targets.forEach(function(t){var offset=t.position.map(function(v,i){return v-center[i];}),x=offset[0],y=offset[1],z=offset[2];if(idx===0){offset[1]=co*y-si*z;offset[2]=si*y+co*z;}if(idx===1){offset[0]=co*x+si*z;offset[2]=-si*x+co*z;}if(idx===2){offset[0]=co*x-si*y;offset[1]=si*x+co*y;}for(var n=0;n<3;n++)t.data.position[n]=center[n]+offset[n];if(t.data!==d.data)t.data.rotation[idx]=t.rotation[idx]+delta;});}
 if(d.mode==='scale'){var ratio=d.data.scale[idx]/Math.max(.00001,d.startScale[idx]);d.targets.forEach(function(t){if(t.data!==d.data)t.data.scale[idx]=Math.max(.05,t.scale[idx]*ratio);t.data.position[idx]=center[idx]+(t.position[idx]-center[idx])*ratio;});}
 }
 d.targets.forEach(function(t){var mesh=meshes[t.data.id];if(mesh){mesh.position.fromArray(t.data.position);mesh.rotation.set.apply(mesh.rotation,t.data.rotation);mesh.scale.fromArray(t.data.scale);}});d.changed=true;refreshInspector();if(outline)outline.update();updateGizmo();}
function fitScene(){if(!editorCamera||!project)return;var bounds=new T.Box3();project.objects.forEach(function(o){var m=meshes[o.id];if(m)bounds.expandByObject(m);});terrainMeshes.forEach(function(m){bounds.expandByObject(m);});if(bounds.isEmpty()){orbit.target.set(0,1,0);orbit.distance=17;return;}var size=bounds.getSize(new T.Vector3());orbit.target.copy(bounds.getCenter(new T.Vector3()));orbit.distance=Math.min(100,Math.max(8,size.length()*1.5));}
function focusSelected(){var m=meshes[selectedId];if(!m||!editorCamera)return;var bounds=new T.Box3().setFromObject(m);if(bounds.isEmpty())return;var center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()).length();orbit.target.copy(center);orbit.distance=Math.max(3,Math.min(80,size*2.15));}
function setRenderState(msg){var o=$('renderState');if(o)o.textContent=msg;}
function showRenderError(reason){setRenderState('3D: ошибка');var el=$('renderError');el.hidden=false;el.textContent='Ошибка 3D-рендера\n\n'+reason+'\n\nПроверь доступ к cdnjs и аппаратное ускорение браузера.\nПопробуй открыть studio.html в Chrome или Edge.';status('3D: '+reason,true);}
function initRenderer(){if(!T){showRenderError('Three.js r128 не загрузился.');return;}editorScene=new T.Scene();editorScene.background=new T.Color('#80bbeb');editorCamera=new T.PerspectiveCamera(50,1,.04,500);orbit.target=new T.Vector3(0,1,0);var viewport=$('viewport');try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){showRenderError('WebGL недоступен: '+e.message);return;}renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;viewport.insertBefore(renderer.domElement,viewport.firstChild);editorAmbient=new T.HemisphereLight(0xeaf6ff,0x62748c,1.5);editorScene.add(editorAmbient);var dir=new T.DirectionalLight(0xffeed9,1.6);editorSun=dir;dir.position.set(-10,15,11);dir.castShadow=true;dir.shadow.mapSize.set(1024,1024);dir.shadow.camera.left=-30;dir.shadow.camera.right=30;dir.shadow.camera.top=30;dir.shadow.camera.bottom=-30;editorScene.add(dir);gridHelper=new T.GridHelper(80,80,0x7f9baa,0x6f91a0);editorScene.add(gridHelper);makeGizmo();setRenderState('WebGL запущен · ожидание кадра');
var cv=renderer.domElement;cv.tabIndex=0;cv.setAttribute('aria-label','3D редактор — камера WASD Q E');
cv.addEventListener('blur',function(){editorKeys={};editorCamActive=false;});
cv.oncontextmenu=function(e){e.preventDefault();};
cv.addEventListener('pointerdown',function(e){if(playing||e.button>2)return;cv.focus({preventScroll:true});editorCamActive=true;editorCamRightMouse=e.button===2;
 if(toolMode==='terrain'&&e.button===0&&!e.altKey){
  if(!project.terrain){status('Создай Terrain, прежде чем рисовать.',true);return;}
  var point=terrainIntersection(e);
  if(point){e.preventDefault();startTerrainStroke(e,point);cv.setPointerCapture(e.pointerId);cv.classList.add('dragging');}
  return;
 }
if(e.button===0&&!e.altKey){var axis=!e.shiftKey&&axisHit(e);if(axis){startAxisDrag(e,axis);cv.setPointerCapture(e.pointerId);cv.classList.add('dragging');return;}
var hits=getRay(e).intersectObjects(Object.values(meshes),true);if(hits.length){var o=hits[0].object;while(o&&!o.userData.id)o=o.parent;if(o&&o.userData.id){setTab('world');if(e.ctrlKey||e.metaKey){selectWorld(o.userData.id,e);cv.setPointerCapture(e.pointerId);return;}if(e.shiftKey&&selectedIds.length>1){selectWorld(o.userData.id,e);cv.setPointerCapture(e.pointerId);return;}if(selectedIds.indexOf(o.userData.id)<0)select('world',o.userData.id);if(toolMode==='move'||e.shiftKey){startGroundDrag(e,o.userData.id);cv.setPointerCapture(e.pointerId);cv.classList.add('dragging');return;}cv.setPointerCapture(e.pointerId);return;}}}
mouse={x:e.clientX,y:e.clientY,yaw:orbit.yaw,pitch:orbit.pitch,tx:orbit.target.x,ty:orbit.target.y,tz:orbit.target.z,button:e.button,moved:false};cv.setPointerCapture(e.pointerId);cv.classList.add('dragging');});
cv.addEventListener('pointermove',function(e){
 if(toolMode==='terrain'&&!playing){
  var point=terrainIntersection(e);if(point)showTerrainCursor(point.x,point.z);else hideTerrainCursor();
  if(terrainStroke){if(point)moveTerrainStroke(e,point);return;}
 }
 if(axisDrag){applyAxisDrag(e);return;}if(!mouse)return;var dx=e.clientX-mouse.x,dy=e.clientY-mouse.y;if(Math.abs(dx)+Math.abs(dy)>3)mouse.moved=true;if(mouse.button===1){var moveSpeed=orbit.distance*.0018;var right=new T.Vector3(Math.cos(orbit.yaw),0,-Math.sin(orbit.yaw));orbit.target.set(mouse.tx,mouse.ty,mouse.tz).addScaledVector(right,-dx*moveSpeed);orbit.target.y+=dy*moveSpeed;}
else {orbit.yaw=mouse.yaw-dx*.006;orbit.pitch=Math.max(.08,Math.min(3.04,mouse.pitch-dy*.006));}});
function finishPointer(e){if(terrainStroke){endTerrainStroke(e&&e.type==='pointercancel');}if(axisDrag){if(axisDrag.changed){status('Изменён объект '+axisDrag.data.name+' · '+axisDrag.mode.toUpperCase()+' · ось '+axisDrag.axis.toUpperCase());}else if(undoStack.length)undoStack.pop();axisDrag=null;}mouse=null;editorCamRightMouse=false;cv.classList.remove('dragging');if(e&&cv.hasPointerCapture&&cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);}
cv.addEventListener('pointerup',finishPointer);cv.addEventListener('pointercancel',finishPointer);
cv.addEventListener('wheel',function(e){e.preventDefault();orbit.distance=Math.max(.5,Math.min(200,orbit.distance*Math.exp(e.deltaY*.001)));},{passive:false});
var prevSize=[0,0];function frame(now){requestAnimationFrame(frame);if(!renderer)return;
var dt=Math.min(.06,Math.max(0,((now||performance.now())-(editorCameraTick||((now||performance.now())-16)))/1000));editorCameraTick=now||performance.now();
if(!playing&&!axisDrag&&!terrainStroke&&editorCamActive){var k=editorKeys;var forward=(k.w?1:0)-(k.s?1:0),rightward=(k.d?1:0)-(k.a?1:0),vertical=(k.e?1:0)-(k.q?1:0);var magnitude=Math.hypot(forward,rightward,vertical);
if(magnitude){var step=editorCamSpeed*(k.shift?3.0:1)*dt/magnitude;orbit.target.x+=(-Math.sin(orbit.yaw)*forward+Math.cos(orbit.yaw)*rightward)*step;orbit.target.z+=(-Math.cos(orbit.yaw)*forward-Math.sin(orbit.yaw)*rightward)*step;orbit.target.y+=vertical*step;}}
var w=viewport.clientWidth,h=viewport.clientHeight;if(w>0&&h>0&&(w!==prevSize[0]||h!==prevSize[1])){renderer.setSize(w,h);editorCamera.aspect=w/h;editorCamera.updateProjectionMatrix();prevSize=[w,h];}editorCamera.position.set(orbit.target.x+orbit.distance*Math.sin(orbit.pitch)*Math.sin(orbit.yaw),orbit.target.y+orbit.distance*Math.cos(orbit.pitch),orbit.target.z+orbit.distance*Math.sin(orbit.pitch)*Math.cos(orbit.yaw));editorCamera.lookAt(orbit.target);window.__bridgeEditorCameraDebug=function(){return {position:[editorCamera.position.x,editorCamera.position.y,editorCamera.position.z],target:[orbit.target.x,orbit.target.y,orbit.target.z],yaw:orbit.yaw,pitch:orbit.pitch,active:editorCamActive,keys:Object.keys(editorKeys).filter(function(k){return !!editorKeys[k];})};};updateGizmo();try{renderer.render(editorScene,editorCamera);if(outline)outline.update();sceneFrames++;if(sceneFrames===1){setRenderState('3D готов · '+(window.__bridgeThreeLoad&&window.__bridgeThreeLoad.source||'Three.js'));$('renderError').hidden=true;}if(sceneFrames%120===0){setRenderState('3D работает · '+project.objects.length+' объектов · '+((renderer.info&&renderer.info.render&&renderer.info.render.calls)||0)+' draw calls');}}catch(ex){if(lastSceneError!==ex.message){lastSceneError=ex.message;showRenderError('Ошибка отрисовки: '+ex.message);console.error(ex);}}}requestAnimationFrame(frame);
}
function assetName(name){return String(name||'Asset').slice(0,100);}
function refreshAssetBrowser(){var list=$('assetLibrary');if(!list||!project)return;var term=($('assetSearch').value||'').toLowerCase();list.innerHTML='';(project.assets||[]).filter(function(a){return a.name.toLowerCase().includes(term);}).forEach(function(a){var card=document.createElement('div');card.className='asset-card';card.dataset.assetId=a.id;var thumb=document.createElement('div');thumb.className='asset-thumb';if(assetThumbCache[a.id]){var img=document.createElement('img');img.src=assetThumbCache[a.id];img.alt='Миниатюра';thumb.appendChild(img);}else thumb.textContent='3D';thumb.title='Предпросмотр 3D';thumb.onclick=function(){previewAsset(a.id);};var content=document.createElement('div');content.className='asset-content';var title=document.createElement('b');title.textContent=a.name;var sz=document.createElement('small');sz.textContent=((a.bytes||a.data.length*.75)/1024).toFixed(0)+' КБ · GLB';var controls=document.createElement('div');controls.className='asset-controls';[['В сцену',function(){addAssetInstance(a.id);}],['3D',function(){previewAsset(a.id);}],['×',function(){deleteAsset(a.id);}]].forEach(function(pair){var btn=document.createElement('button');btn.textContent=pair[0];btn.onclick=pair[1];controls.appendChild(btn);});content.appendChild(title);content.appendChild(sz);content.appendChild(controls);card.appendChild(thumb);card.appendChild(content);card.draggable=true;card.ondragstart=function(ev){ev.dataTransfer.setData('application/x-bridge-asset',a.id);ev.dataTransfer.effectAllowed='copy';};list.appendChild(card);});if(!list.children.length)list.innerHTML='<p class="hint">Нет моделей. Импортируй GLB, чтобы создать библиотеку.</p>';refreshTextureList();refreshPrefabBrowser();}
function addAssetInstance(assetId,position){var a=project.assets.find(function(a){return a.id===assetId;});if(!a){status('Ассет не найден',true);return;}remember();var center=position||orbit.target.toArray(),o={id:id(),name:a.name.replace(/\.glb$/i,''),type:'glb',assetId:a.id,position:[round(center[0]),round(center[1]),round(center[2])],rotation:[0,0,0],scale:[1,1,1],color:'#ffffff',solid:false,action:'none',value:0};project.objects.push(o);createVisual(o);setTab('world');select('world',o.id);status('В сцену добавлен ассет «'+a.name+'»');return o;}
function deleteAsset(assetId){var a=project.assets.find(function(a){return a.id===assetId;});if(!a)return;var used=project.objects.some(function(o){return o.assetId===assetId;})||project.prefabs.some(function(p){return p.objects.some(function(o){return o.assetId===assetId;});});if(used){status('Нельзя удалить: модель используется в сцене или Prefab.',true);return;}if(!confirm('Удалить ассет '+a.name+' из библиотеки?'))return;remember();project.assets=project.assets.filter(function(x){return x.id!==assetId;});closeAssetPreview();refreshAssetBrowser();status('Ассет удалён.');}
function addTexture(files){var arr=Array.from(files).filter(function(f){return /^image\/(png|jpeg|webp)$/.test(f.type)||/\.(png|jpe?g|webp)$/i.test(f.name);});arr.reduce(function(pr,f){return pr.then(async function(){if(f.size>12*1024*1024)throw Error('Текстура '+f.name+' превышает 12 МиБ');var d=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=reject;reader.readAsDataURL(f);});remember();project.textures.push({id:id(),name:assetName(f.name),data:d,bytes:f.size});refreshAssetBrowser();refreshInspector();status('Текстура загружена: '+f.name);});},Promise.resolve()).catch(function(e){status('Текстуры: '+e.message,true);});}
function refreshTextureList(){var sel=$('textureLibrary');if(!sel)return;sel.innerHTML='';project.textures.forEach(function(t){var row=document.createElement('div');row.className='texture-row';var img=document.createElement('img');img.src=t.data;img.alt='';var name=document.createElement('span');name.textContent=t.name;var del=document.createElement('button');del.textContent='×';del.title='Удалить текстуру';del.onclick=function(){var used=project.objects.some(function(o){return o.material&&o.material.textureId===t.id;})||project.prefabs.some(function(p){return p.objects.some(function(o){return o.material&&o.material.textureId===t.id;});});if(used){status('Эта текстура используется в сцене или Prefab.',true);return;}remember();project.textures=project.textures.filter(function(x){return x.id!==t.id;});resetTextureCache();refreshAssetBrowser();};row.appendChild(img);row.appendChild(name);row.appendChild(del);sel.appendChild(row);});if(!sel.children.length)sel.innerHTML='<p class="hint">Текстур пока нет.</p>';}
function createPrefab(){if(selectedKind!=='world'||!selectedIds.length){status('Сначала выдели объекты для Prefab.',true);return;}var name=prompt('Название нового Prefab','Новый Prefab');if(!name)return;var center=selectionCenter();remember();var objs=selectedObjects().map(function(o){var c=clone(o);c.position=c.position.map(function(v,i){return round(v-center[i]);});return c;});var selectedSet=new Set(selectedObjects().map(function(o){return o.id;}));var graphs=project.graphs.filter(function(g){return g.source&&selectedSet.has(g.source);}).map(clone);var p={id:id(),name:assetName(name),objects:objs,graphs:graphs};project.prefabs.push(p);refreshPrefabBrowser();status('Prefab сохранён: '+name+' ('+objs.length+' объектов).');}
function instantiatePrefab(prefabId,position){var p=project.prefabs.find(function(p){return p.id===prefabId;});if(!p){status('Prefab не найден',true);return;}remember();var c=position||orbit.target.toArray(),mapping={},groupName=p.name+' #'+(project.objects.length+1);p.objects.forEach(function(o){mapping[o.id]=id();});var objects=p.objects.map(function(o){var d=clone(o);d.id=mapping[o.id];d.name=o.name;d.group=groupName;d.prefabId=p.id;d.target=mapping[o.target]||o.target||'';(d.components||[]).forEach(function(c){if(c.target)c.target=mapping[c.target]||c.target;});d.position=o.position.map(function(v,i){return round(v+c[i]);});return d;});objects.forEach(function(o){project.objects.push(o);createVisual(o);});(p.graphs||[]).forEach(function(graph){var g=clone(graph),nodeMapping={};g.id=id();g.name=p.name+' · '+g.name;g.source=mapping[g.source]||g.source;g.nodes.forEach(function(n){var old=n.id;nodeMapping[old]=id();n.id=nodeMapping[old];if(n.target)n.target=mapping[n.target]||n.target;});g.links.forEach(function(l){l.from=nodeMapping[l.from]||l.from;l.to=nodeMapping[l.to]||l.to;});project.graphs.push(g);});setTab('world');setSelectedIds(objects.map(function(o){return o.id;}),objects[0].id);status('Добавлен Prefab «'+p.name+'»: '+objects.length+' объектов.');}
function refreshPrefabBrowser(){var list=$('prefabLibrary');if(!list||!project)return;list.innerHTML='';project.prefabs.forEach(function(p){var row=document.createElement('div');row.className='prefab-card';var title=document.createElement('b');title.textContent='▦ '+p.name+' ('+p.objects.length+')';var b=document.createElement('button');b.textContent='В сцену';b.onclick=function(){instantiatePrefab(p.id);};var save=document.createElement('button');save.textContent='↓';save.title='Скачать Prefab';save.onclick=function(){exportPrefab(p.id);};var rm=document.createElement('button');rm.textContent='×';rm.onclick=function(){if(!confirm('Удалить шаблон '+p.name+'? Размещённые экземпляры останутся в сцене.'))return;remember();project.prefabs=project.prefabs.filter(function(x){return x.id!==p.id;});refreshPrefabBrowser();};row.appendChild(title);row.appendChild(b);row.appendChild(save);row.appendChild(rm);row.draggable=true;row.ondragstart=function(ev){ev.dataTransfer.setData('application/x-bridge-prefab',p.id);ev.dataTransfer.effectAllowed='copy';};list.appendChild(row);});if(!list.children.length)list.innerHTML='<p class="hint">Выдели объекты и нажми «Создать Prefab».</p>';}
function exportPrefab(prefabId){var p=project.prefabs.find(function(x){return x.id===prefabId;});if(!p)return;var ai=new Set(p.objects.map(function(o){return o.assetId;}).filter(Boolean)),ti=new Set(p.objects.map(function(o){return o.material&&o.material.textureId;}).filter(Boolean));var pack={format:'rwbridge.prefab',version:1,prefab:p,assets:project.assets.filter(function(a){return ai.has(a.id);}),textures:project.textures.filter(function(t){return ti.has(t.id);})};dl(JSON.stringify(pack),(p.name.replace(/[^a-zа-я0-9_-]+/gi,'-')||'prefab')+'.rwprefab','application/json');}
function importPrefabFile(pack){if(!pack||pack.format!=='rwbridge.prefab'||!pack.prefab||!Array.isArray(pack.prefab.objects))throw Error('Неверный формат .rwprefab');if(pack.prefab.objects.length>2000)throw Error('Слишком много объектов в Prefab');remember();var am={},tm={};(pack.assets||[]).forEach(function(a){var same=project.assets.find(function(x){return x.data===a.data;});if(same)am[a.id]=same.id;else{var copy=clone(a);copy.id=id();project.assets.push(copy);am[a.id]=copy.id;}});(pack.textures||[]).forEach(function(t){var same=project.textures.find(function(x){return x.data===t.data;});if(same)tm[t.id]=same.id;else{var copy=clone(t);copy.id=id();project.textures.push(copy);tm[t.id]=copy.id;}});var newPrefab=clone(pack.prefab);newPrefab.id=id();newPrefab.objects.forEach(function(o){if(o.assetId)o.assetId=am[o.assetId]||o.assetId;if(o.material&&o.material.textureId)o.material.textureId=tm[o.material.textureId]||o.material.textureId;});project.prefabs.push(newPrefab);refreshAssetBrowser();status('Prefab импортирован: '+newPrefab.name);}
function updateLightingControls(){if(!project)return;var l=project.settings.lighting;document.querySelectorAll('[data-light]').forEach(function(el){var k=el.dataset.light;el.type==='checkbox'?el.checked=!!l[k]:el.value=k==='sky'?project.settings.sky:l[k];});}
function refreshLightingControls(){updateLightingControls();}
function exportLibrary(){var pack={format:'rwbridge.library',version:1,assets:clone(project.assets),textures:clone(project.textures),prefabs:clone(project.prefabs)};dl(JSON.stringify(pack),(project.name.replace(/[^a-zа-я0-9_-]+/gi,'-')||'library')+'.rwlib','application/json');status('Библиотека ассетов экспортирована (.rwlib).');}
function importLibrary(pack){if(!pack||pack.format!=='rwbridge.library'||pack.version!==1||!Array.isArray(pack.assets)||!Array.isArray(pack.textures)||!Array.isArray(pack.prefabs))throw Error('Неизвестный формат библиотеки .rwlib');if(pack.assets.length>1000||pack.textures.length>1000||pack.prefabs.length>2000)throw Error('Слишком много элементов библиотеки');
 remember();var am={},tm={},imported=0;
 pack.assets.forEach(function(a){if(typeof a.id!=='string'||typeof a.data!=='string'||!a.data.length)throw Error('Библиотека содержит повреждённую GLB-модель');var known=project.assets.find(function(x){return x.data===a.data;});if(known)am[a.id]=known.id;else{var fresh=clone(a);fresh.id=id();project.assets.push(fresh);am[a.id]=fresh.id;imported++;}});
 pack.textures.forEach(function(t){if(typeof t.id!=='string'||typeof t.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,/i.test(t.data))throw Error('Библиотека содержит повреждённую текстуру');var known=project.textures.find(function(x){return x.data===t.data;});if(known)tm[t.id]=known.id;else{var fresh=clone(t);fresh.id=id();project.textures.push(fresh);tm[t.id]=fresh.id;imported++;}});
 pack.prefabs.forEach(function(p){if(!Array.isArray(p.objects)||p.objects.length>2000)throw Error('Повреждён Prefab в библиотеке');var fresh=clone(p);fresh.id=id();fresh.objects.forEach(function(o){if(o.assetId)o.assetId=am[o.assetId]||o.assetId;if(o.material&&o.material.textureId)o.material.textureId=tm[o.material.textureId]||o.material.textureId;});project.prefabs.push(fresh);imported++;});
 refreshAssetBrowser();status('Импортировано элементов библиотеки: '+imported+'.');}
function viewportDropPoint(e){try{var p=getRay(e).ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());if(p)return [round(p.x),round(p.y),round(p.z)];}catch(ex){}return orbit.target.toArray();}
function previewAsset(assetId){var a=project.assets.find(function(a){return a.id===assetId;});if(!a)return;closeAssetPreview();var pane=$('assetPreview');pane.hidden=false;$('assetPreviewTitle').textContent=a.name;var host=$('assetPreviewCanvas');host.innerHTML='';try{var r=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});r.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));r.setSize(Math.max(210,host.clientWidth||280),185);host.appendChild(r.domElement);var sc=new T.Scene();sc.background=new T.Color('#122536');sc.add(new T.HemisphereLight(0xffffff,0x4e6375,2));var sun=new T.DirectionalLight(0xffffff,2);sun.position.set(4,8,9);sc.add(sun);var cam=new T.PerspectiveCamera(45,Math.max(210,host.clientWidth||280)/185,.01,1000);var preview={renderer:r,scene:sc,camera:cam,active:true,object:null,theta:.5};assetPreview=preview;var bytes=bytesFromB64(a.data),g=decodeGlb(bytes);parseData(g.json,g.bin).then(function(result){if(!preview.active)return;preview.object=result.object;sc.add(result.object);var bb=new T.Box3().setFromObject(result.object),size=bb.getSize(new T.Vector3()),center=bb.getCenter(new T.Vector3()),radius=Math.max(.2,size.x,size.y,size.z);preview.center=center;preview.radius=radius;cam.position.set(center.x+radius*1.9,center.y+radius*.9,center.z+radius*1.9);cam.lookAt(center);}).catch(function(err){$('assetPreviewTitle').textContent='GLB: '+err.message;});function tick(){if(!preview.active)return;if(preview.object&&preview.center){preview.theta+=.006;cam.position.set(preview.center.x+Math.sin(preview.theta)*preview.radius*2.8,preview.center.y+preview.radius*.8,preview.center.z+Math.cos(preview.theta)*preview.radius*2.8);cam.lookAt(preview.center);}r.render(sc,cam);if(preview.object&&!preview.captured){preview.captured=true;try{assetThumbCache[a.id]=r.domElement.toDataURL('image/webp',.72);refreshAssetBrowser();}catch(e){}}requestAnimationFrame(tick);}tick();}catch(e){host.textContent='3D-предпросмотр недоступен: '+e.message;}}
function closeAssetPreview(){if(assetPreview){assetPreview.active=false;if(assetPreview.scene&&assetPreview.object){assetPreview.scene.remove(assetPreview.object);disposeVisual(assetPreview.object);}if(assetPreview.renderer&&assetPreview.renderer.dispose)assetPreview.renderer.dispose();assetPreview=null;}var pane=$('assetPreview');if(pane)pane.hidden=true;}
function importGLB(files){var arr=Array.from(files).filter(function(f){return /\.glb$/i.test(f.name);});if(!arr.length){status('Нужен файл .glb',true);return;}arr.reduce(function(p,f){return p.then(async function(){var bytes=new Uint8Array(await f.arrayBuffer());var d=decodeGlb(bytes);await parseData(d.json,d.bin);var b64=b64Encoded(bytes);var found=project.assets.find(function(a){return a.data===b64;});if(!found){remember();found={id:id(),name:assetName(f.name),type:'glb',data:b64,bytes:bytes.length};project.assets.push(found);}refreshAssetBrowser();addAssetInstance(found.id);status('GLB импортирован в библиотеку: '+f.name+' ('+(bytes.length/1024).toFixed(0)+' КБ)');});},Promise.resolve()).catch(function(e){status('Импорт: '+e.message,true);});}
/* Gameplay Systems editor, part of the Studio closure. Graphs and components are
   serializable data: no eval/new Function is required for visual logic. */
var logicGraphId=null,logicNodeId=null,logicLinkFrom=null;
var logicEventNames={start:'При запуске',touch:'Касание / вход в зону',leave:'Выход из зоны',interact:'Нажатие E',collect:'Подбор предмета',checkpoint:'Чекпоинт',health:'Изменение здоровья',death:'Гибель персонажа',win:'Победа',ui:'Нажатие UI-кнопки',timer:'По таймеру',signal:'Получен сигнал'};
var logicNodeNames={message:'Показать сообщение',coins:'Добавить монеты',heal:'Восстановить HP',damage:'Нанести урон',teleport:'Телепорт к объекту',door:'Открыть/закрыть дверь',visibility:'Показать/скрыть объект',checkpoint:'Установить чекпоинт',flag:'Установить флаг',win:'Завершить уровень',reset:'Перезапустить',ifCoins:'Если монет ≥',ifHealth:'Если HP ≥',ifFlag:'Если флаг',counter:'Изменить счётчик',ifCounter:'Если счётчик ≥',emitSignal:'Отправить сигнал'};
var componentNames={pickup:'Подбор монет',damage:'Зона урона',heal:'Лечение',checkpoint:'Контрольная точка',teleporter:'Телепорт',door:'Дверь',npc:'NPC / диалог',movingPlatform:'Движущаяся платформа',trigger:'Зона события'};
function gameplayComponentDefaults(type){var a={type:type,enabled:true,cooldown:900,activation:(['teleporter','door','npc'].includes(type)?'interact':'touch'),amount:1,message:'',target:'',openHeight:3,period:4,patrolDistance:0,offset:[3,0,0]};if(type==='damage')a.amount=20;if(type==='heal')a.amount=25;if(type==='npc')a.message='Привет! Нажми E рядом со мной.';if(type==='pickup')a.message='Предмет получен!';return a;}
function gameplayComponentOptions(value){return '<option value="">— Не задан —</option>'+project.objects.map(function(d){return '<option value="'+esc(d.id)+'"'+(value===d.id?' selected':'')+'>'+esc(d.name)+'</option>';}).join('');}
function componentMarkup(object){var comps=object.components||[],html='<div class="inspector-divider">КОМПОНЕНТЫ · GAMEPLAY</div><p class="hint">Поведение можно настраивать без JS. Компоненты и графы работают в Play и экспортированной игре.</p>';
comps.forEach(function(c,i){if(!c||!c.type)return;html+='<div class="component-card" data-component-index="'+i+'"><div class="component-title"><span>'+esc(componentNames[c.type]||c.type)+'</span><label><input type="checkbox" data-comp-field="enabled"'+(c.enabled!==false?' checked':'')+'> вкл</label></div>';
if(['damage','heal','pickup'].includes(c.type))html+='<label>Количество<input type="number" data-comp-field="amount" value="'+Number(c.amount||0)+'" min="0" step="1"></label>';
if(!['movingPlatform'].includes(c.type))html+='<label>Активация<select data-comp-field="activation"><option value="touch"'+(c.activation==='touch'?' selected':'')+'>Касание</option><option value="interact"'+(c.activation==='interact'?' selected':'')+'>E · взаимодействие</option><option value="graph"'+(c.activation==='graph'?' selected':'')+'>Только граф логики</option></select></label>';
if(['teleporter','door'].includes(c.type))html+='<label>Целевой объект<select data-comp-field="target">'+gameplayComponentOptions(c.target)+'</select></label>';
if(['npc','teleporter','pickup'].includes(c.type))html+='<label>Сообщение<input data-comp-field="message" value="'+esc(c.message||'')+'"></label>';
if(c.type==='door')html+='<label>Высота открытия<input type="number" min="0.75" max="30" step=".25" data-comp-field="openHeight" value="'+(Number(c.openHeight)||3)+'"></label>';
if(c.type==='npc')html+='<label>Радиус патруля<input type="number" min="0" max="20" step=".5" data-comp-field="patrolDistance" value="'+(Number(c.patrolDistance)||0)+'"></label><label>Период патруля (сек)<input type="number" min="1" max="100" step=".5" data-comp-field="period" value="'+(Number(c.period)||5)+'"></label>';
if(c.type==='movingPlatform')html+='<label>Смещение X / Y / Z</label><div class="three">'+(c.offset||[3,0,0]).map(function(v,k){return '<input type="number" step=".5" data-comp-offset="'+k+'" value="'+Number(v)+'">';}).join('')+'</div><label>Период движения (сек)<input type="number" min=".6" max="100" step=".5" data-comp-field="period" value="'+(Number(c.period)||4)+'"></label>';
if(['damage','heal','teleporter','door','npc'].includes(c.type))html+='<label>Задержка (мс)<input type="number" min="0" max="60000" step="100" data-comp-field="cooldown" value="'+Number(c.cooldown==null?900:c.cooldown)+'"></label>';
html+='<button class="mini" data-remove-component="'+i+'">Удалить компонент</button></div>';});
html+='<label>Добавить компонент</label><div class="twocol"><select id="newComponentType">'+Object.entries(componentNames).map(function(p){return '<option value="'+p[0]+'">'+esc(p[1])+'</option>';}).join('')+'</select><button id="addComponentToObject">+ Добавить</button></div>';
return html;}
function bindComponentInspector(container,object){if(!container||!object||selectedKind!=='world')return;
 var add=container.querySelector('#addComponentToObject');if(add)add.onclick=function(){var type=container.querySelector('#newComponentType').value;remember();object.components=object.components||[];object.components.push(gameplayComponentDefaults(type));refreshInspector();status('Добавлен компонент: '+componentNames[type]);};
 container.querySelectorAll('[data-component-index]').forEach(function(card){var component=object.components[Number(card.dataset.componentIndex)];
  card.querySelectorAll('[data-comp-field]').forEach(function(input){input.onchange=function(){remember();var k=input.dataset.compField,v=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;component[k]=v;refreshInspector();};});
  card.querySelectorAll('[data-comp-offset]').forEach(function(input){input.onchange=function(){var i=Number(input.dataset.compOffset),v=Number(input.value);if(!Number.isFinite(v))return;remember();component.offset=component.offset||[3,0,0];component.offset[i]=v;};});
  var rm=card.querySelector('[data-remove-component]');if(rm)rm.onclick=function(){remember();object.components.splice(Number(rm.dataset.removeComponent),1);refreshInspector();};
 });
}
function graphSelected(){return (project.graphs||[]).find(function(g){return g.id===logicGraphId;});}
function graphNodeSelected(){var g=graphSelected();return g&&g.nodes.find(function(n){return n.id===logicNodeId;});}
function addLogicGraph(){remember();var g={id:id(),name:'Новый граф',event:'interact',source:'*',enabled:true,nodes:[{id:id(),type:'message',x:340,y:205,text:'Событие выполнено!',amount:1}],links:[]};g.links.push({from:'start',to:g.nodes[0].id,port:'next'});project.graphs.push(g);logicGraphId=g.id;logicNodeId=g.nodes[0].id;logicLinkFrom=null;setTab('logic');refreshLogicEditor();}
function addTimerCounterDemo(){
 if(!project||project.graphs.length>=100){status('Лимит графов: 100.',true);return;}
 remember();var add=id(),check=id(),reward=id(),message=id(),reset=id();
 var g={id:id(),name:'Награда каждые 3 тика',event:'timer',interval:2,source:'*',enabled:true,
  nodes:[
   {id:add,type:'counter',key:'ticks',mode:'add',amount:1,x:280,y:130},
   {id:check,type:'ifCounter',key:'ticks',amount:3,x:520,y:130},
   {id:reward,type:'coins',amount:5,x:760,y:75},
   {id:message,type:'message',text:'Таймер: +5 монет!',x:960,y:75},
   {id:reset,type:'counter',key:'ticks',mode:'set',amount:0,x:1150,y:75}
  ],
  links:[{from:'start',to:add,port:'next'},{from:add,to:check,port:'next'},
   {from:check,to:reward,port:'yes'},{from:reward,to:message,port:'next'},
   {from:message,to:reset,port:'next'}]};
 project.graphs.push(g);logicGraphId=g.id;logicNodeId=add;logicLinkFrom=null;
 setTab('logic');refreshLogicEditor();status('Готовый граф: каждые три срабатывания таймера +5 монет. Измени интервал и запусти Play.');
}
function addUnlockGateDemo(){
 if(!project||project.graphs.length>98||project.objects.length>1990){status('Недостаточно места для игровой схемы.',true);return;}
 remember();
 var spawn=project.objects.find(function(o){return o.type==='spawn';}),pos=spawn&&spawn.position||[0,0,0];
 var bx=pos[0]+1.2,bz=pos[2],gx=pos[0]+4,gz=pos[2];
 function floorAt(x,z){var h=window.BridgeTerrainCore.sampleHeight(project.terrain,x,z);return h===null?pos[1]:h;}
 var button={id:id(),name:'Кнопка · 3 нажатия',type:'block',position:[bx,floorAt(bx,bz)+.45,bz],rotation:[0,0,0],scale:[.8,.8,.8],color:'#43d4c4',solid:false,action:'none',value:0,
   components:[{type:'trigger',enabled:true,activation:'interact'}]};
 var gate={id:id(),name:'Ворота · открыть графом',type:'block',position:[gx,floorAt(gx,gz)+1,gz],rotation:[0,0,0],scale:[1,2,3],color:'#a674eb',solid:true,action:'none',value:0,
   components:[{type:'door',enabled:true,activation:'graph',openHeight:3}]};
 var add=id(),test=id(),open=id(),signal=id(),reward=id(),notice=id();
 var first={id:id(),name:'3 нажатия → открыть ворота',event:'interact',source:button.id,enabled:true,
   nodes:[{id:add,type:'counter',key:'gate_presses',mode:'add',amount:1,x:280,y:120},
    {id:test,type:'ifCounter',key:'gate_presses',amount:3,compare:'eq',x:520,y:120},
    {id:open,type:'door',target:gate.id,mode:'open',x:760,y:120},
    {id:signal,type:'emitSignal',signal:'gate_unlocked',x:980,y:120}],
   links:[{from:'start',to:add,port:'next'},{from:add,to:test,port:'next'},
    {from:test,to:open,port:'yes'},{from:open,to:signal,port:'next'}]};
 var second={id:id(),name:'Сигнал ворот → награда',event:'signal',signal:'gate_unlocked',source:'*',enabled:true,
   nodes:[{id:reward,type:'coins',amount:10,x:320,y:160},
    {id:notice,type:'message',text:'Ворота открыты! +10 монет.',x:555,y:160}],
   links:[{from:'start',to:reward,port:'next'},{from:reward,to:notice,port:'next'}]};
 project.objects.push(button,gate);project.graphs.push(first,second);
 logicGraphId=first.id;logicNodeId=test;logicLinkFrom=null;
 refreshScene();refreshLists();setTab('logic');refreshLogicEditor();setDirty(true);
 status('Создано: кнопка у Spawn, ворота и два графа. В Play нажми E три раза у кнопки.');
}
function logicSelectGraph(gid){logicGraphId=gid;logicNodeId=null;logicLinkFrom=null;refreshLogicEditor();}
function addLogicNode(){var g=graphSelected();if(!g)return;var type=$('logicNodeType').value;if(g.nodes.length>=80){status('В одном графе не более 80 блоков.',true);return;}remember();var n={id:id(),type:type,x:350+(g.nodes.length%5)*220,y:60+Math.floor(g.nodes.length/5)*165,text:'Новое сообщение',amount:1,target:'',flag:'ready',value:true,mode:type==='counter'?'add':'toggle',key:'score',signal:'gate_unlocked',compare:'gte'};g.nodes.push(n);logicNodeId=n.id;refreshLogicEditor();}
function removeLogicNode(){var g=graphSelected(),n=graphNodeSelected();if(!g||!n)return;remember();g.nodes=g.nodes.filter(function(x){return x.id!==n.id;});g.links=g.links.filter(function(l){return l.from!==n.id&&l.to!==n.id;});logicNodeId=null;logicLinkFrom=null;refreshLogicEditor();}
function deleteLogicGraph(){var g=graphSelected();if(!g)return;if(!confirm('Удалить граф «'+g.name+'»?'))return;remember();project.graphs=project.graphs.filter(function(x){return x.id!==g.id;});logicGraphId=project.graphs[0]&&project.graphs[0].id||null;logicNodeId=null;refreshLogicEditor();}
function eventSourceChoices(g){if(g.event==='timer'||g.event==='signal')return '<option value="*">Вся игра</option>';var isUI=g.event==='ui',available=isUI?project.ui:project.objects;return '<option value="*">Любой объект</option>'+available.map(function(o){return '<option value="'+esc(o.id)+'"'+(g.source===o.id?' selected':'')+'>'+esc(o.name)+'</option>';}).join('');}
function drawLogicWires(){var g=graphSelected(),svg=$('logicWires');if(!g||!svg)return;var nodes={start:{x:32,y:200}};g.nodes.forEach(function(n){nodes[n.id]={x:Math.max(0,Number(n.x)||0),y:Math.max(0,Number(n.y)||0)};});var paths=[];g.links.forEach(function(l){var a=nodes[l.from],b=nodes[l.to];if(!a||!b)return;var sy=a.y+(l.port==='yes'?116:l.port==='no'?145:91),tx=b.x,ty=b.y+48;var sx=a.x+190,curve=Math.max(45,Math.abs(tx-sx)*.5);paths.push('<path class="logic-wire '+(l.port==='yes'?'branch-yes':l.port==='no'?'branch-no':'')+'" d="M'+sx+' '+sy+' C'+(sx+curve)+' '+sy+' '+(tx-curve)+' '+ty+' '+tx+' '+ty+'"/>');});svg.innerHTML=paths.join('');}
function renderLogicGraph(){var g=graphSelected(),host=$('logicGraphSurface');host.querySelectorAll('.logic-node:not(.logic-event)').forEach(function(n){n.remove();});var start=$('logicStartName');start.textContent=g?logicEventNames[g.event]:'Выбери граф';if(!g){$('logicWires').innerHTML='';return;}
 g.nodes.forEach(function(n){var wrap=document.createElement('div');wrap.className='logic-node'+(logicNodeId===n.id?' selected':'');wrap.dataset.node=n.id;wrap.style.left=Math.max(0,Math.min(1250,Number(n.x)||0))+'px';wrap.style.top=Math.max(0,Math.min(760,Number(n.y)||0))+'px';var cond=n.type.indexOf('if')===0;
 wrap.innerHTML='<button class="in-port" data-logic-in="'+esc(n.id)+'" title="Вход блока">◉ Вход</button><strong>'+esc(logicNodeNames[n.type]||n.type)+'</strong><small>'+esc(n.type==='message'?n.text||'':n.type==='door'||n.type==='teleport'?n.target||'Выбери цель':cond?'Условие':['coins','heal','damage'].includes(n.type)?String(n.amount||1):n.type==='counter'||n.type==='ifCounter'?(n.key||'score')+' '+String(n.amount==null?1:n.amount):n.type==='emitSignal'?(n.signal||'gate_unlocked'):'Действие')+'</small><div class="ports">'+(cond?'<button data-logic-out="yes" data-node-id="'+esc(n.id)+'">✓ Да</button><button data-logic-out="no" data-node-id="'+esc(n.id)+'">× Нет</button>':'<button data-logic-out="next" data-node-id="'+esc(n.id)+'">● Далее</button>')+'</div>';
 wrap.onclick=function(e){if(e.target.closest('button'))return;logicNodeId=n.id;renderLogicGraph();renderLogicNodeProperties();};
 wrap.addEventListener('pointerdown',function(e){if(e.button!==0||e.target.closest('button'))return;var beginX=e.clientX,beginY=e.clientY,oldX=Number(n.x)||0,oldY=Number(n.y)||0,changed=false;logicNodeId=n.id;var dragTarget=wrap;function move(ev){if(!changed&&Math.abs(ev.clientX-beginX)+Math.abs(ev.clientY-beginY)>3){remember();changed=true;}n.x=Math.max(0,Math.min(1250,oldX+ev.clientX-beginX));n.y=Math.max(0,Math.min(750,oldY+ev.clientY-beginY));dragTarget.style.left=n.x+'px';dragTarget.style.top=n.y+'px';drawLogicWires();}function finish(){window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);refreshLogicEditor();}window.addEventListener('pointermove',move);window.addEventListener('pointerup',finish);});host.appendChild(wrap);
 });
 host.querySelectorAll('[data-logic-out]').forEach(function(btn){btn.classList.toggle('pending',!!logicLinkFrom&&logicLinkFrom.from===btn.dataset.nodeId&&logicLinkFrom.port===btn.dataset.logicOut);btn.onclick=function(e){e.preventDefault();logicLinkFrom={from:btn.dataset.nodeId,port:btn.dataset.logicOut};$('logicConnectionHint').textContent='Теперь нажми «◉ Вход» целевого блока';renderLogicGraph();};});
 host.querySelectorAll('[data-logic-in]').forEach(function(btn){btn.onclick=function(e){e.preventDefault();if(!logicLinkFrom)return;var to=btn.dataset.logicIn;if(to===logicLinkFrom.from){status('Нельзя подключить блок сам к себе.',true);return;}var link={from:logicLinkFrom.from,to:to,port:logicLinkFrom.port};if(!g.links.some(function(l){return l.from===link.from&&l.to===link.to&&l.port===link.port;})){remember();g.links.push(link);}logicLinkFrom=null;$('logicConnectionHint').textContent='Связь создана. Нажми выход другого блока для продолжения';renderLogicGraph();};});
 drawLogicWires();}
function logicPropertyField(label,key,value,type){return '<label>'+esc(label)+'<input data-logic-prop="'+key+'" '+(type==='number'?'type="number" step="1"':'type="text"')+' value="'+esc(value)+'"></label>';}
function renderLogicNodeProperties(){var g=graphSelected(),node=graphNodeSelected(),c=$('logicPropertyFields');if(!g){c.textContent='Сначала создай граф.';return;}if(!node){c.textContent='Нажми на блок, затем меняй его параметры.';return;}
 var html='<strong>'+esc(logicNodeNames[node.type])+'</strong>';
 if(node.type==='message')html+=logicPropertyField('Текст','text',node.text||'','text');
 if(['coins','heal','damage','ifCoins','ifHealth','counter','ifCounter'].includes(node.type))html+=logicPropertyField('Количество','amount',node.amount==null?1:node.amount,'number');
 if(['counter','ifCounter'].includes(node.type))html+=logicPropertyField('Имя счётчика','key',node.key||'score','text');
 if(node.type==='ifCounter')html+='<label>Сравнение<select data-logic-prop="compare">'+[['gte','≥ больше/равно'],['eq','= равно'],['lte','≤ меньше/равно']].map(function(p){return '<option value="'+p[0]+'"'+((node.compare||'gte')===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></label>';
 if(node.type==='emitSignal')html+=logicPropertyField('Имя сигнала','signal',node.signal||'gate_unlocked','text');
 if(node.type==='counter')html+='<label>Операция<select data-logic-prop="mode"><option value="add"'+(node.mode==='set'?'':' selected')+'>Добавить</option><option value="set"'+(node.mode==='set'?' selected':'')+'>Установить</option></select></label>';
 if(['teleport','door','visibility','checkpoint'].includes(node.type))html+='<label>Цель<select data-logic-prop="target">'+gameplayComponentOptions(node.target)+'</select></label>';
 if(['door','visibility'].includes(node.type))html+='<label>Действие<select data-logic-prop="mode">'+(node.type==='door'?[['toggle','Переключить'],['open','Открыть'],['close','Закрыть']]:[['show','Показать'],['hide','Скрыть']]).map(function(p){return '<option value="'+p[0]+'"'+(node.mode===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join('')+'</select></label>';
 if(['flag','ifFlag'].includes(node.type))html+=logicPropertyField('Имя флага','flag',node.flag||'ready','text')+'<label class="inlinecheck"><input data-logic-prop="value" type="checkbox"'+(node.value!==false?' checked':'')+'> значение TRUE</label>';
 c.innerHTML=html;
 c.querySelectorAll('[data-logic-prop]').forEach(function(input){input.onchange=function(){remember();var key=input.dataset.logicProp;node[key]=input.type==='number'?Number(input.value):input.type==='checkbox'?input.checked:input.value;renderLogicGraph();};});
}
function refreshLogicEditor(){var list=$('logicGraphList');if(!list||!project)return;list.innerHTML='';project.graphs.forEach(function(g){var btn=document.createElement('button');btn.className='listbtn'+(g.id===logicGraphId?' active':'');btn.innerHTML='<span>'+esc(g.name||'Граф')+'</span><small>'+esc(g.event||'')+'</small>';btn.onclick=function(){logicSelectGraph(g.id);};list.appendChild(btn);});if(!project.graphs.length)list.innerHTML='<div class="empty">Графов пока нет. Нажми «+ Новый граф».</div>';
 var g=graphSelected();if(!g&&project.graphs.length){logicGraphId=project.graphs[0].id;g=graphSelected();}
 $('logicActiveTitle').textContent=g?(g.name||'Граф'):'Создай новый граф';
 $('logicEvent').disabled=!g;$('logicSource').disabled=!g;$('logicAddNode').disabled=!g;$('logicDeleteGraph').disabled=!g;
 if(g){$('logicEvent').value=g.event;$('logicSource').innerHTML=eventSourceChoices(g);$('logicSource').value=g.source||'*';$('logicGraphName').value=g.name;$('logicGraphEnabled').checked=g.enabled!==false;}else{$('logicGraphName').value='';$('logicSource').innerHTML='';}
 $('logicGraphName').disabled=!g;$('logicGraphEnabled').disabled=!g;
 var timerSettings=$('logicTimerSettings'),timerInput=$('logicTimerInterval');
 var signalSettings=$('logicSignalSettings'),signalInput=$('logicSignalName');
 if(signalSettings)signalSettings.hidden=!g||g.event!=='signal';
 if(signalInput){signalInput.disabled=!g||g.event!=='signal';if(g)signalInput.value=g.signal||'gate_unlocked';}
 if(timerSettings)timerSettings.hidden=!g||g.event!=='timer';
 if(timerInput){timerInput.disabled=!g||g.event!=='timer';if(g)timerInput.value=g.interval==null?2:g.interval;}
 $('logicSource').disabled=!g||g.event==='timer'||g.event==='signal';
 renderLogicGraph();renderLogicNodeProperties();}
function createGameplayDemo(){if(!confirm('Создать новый проект Gameplay Lab? Текущий проект будет заменён. Сохрани его заранее.'))return;
 recordSnapshot(true);stop();var doc=blank();doc.name='Gameplay Lab · Visual Logic';doc.settings.sky='#a3c9db';doc.settings.maxHealth=100;doc.objects[0].scale=[34,1,34];
 function obj(id_,name,type,pos,scale,col,components){doc.objects.push({id:id_,name:name,type:type,position:pos,rotation:[0,0,0],scale:scale,color:col,solid:type==='block'||type==='ground'||type==='movingPlatform',action:'none',value:0,components:components||[]});}
 obj('lab_npc','NPC · проводник','npc',[2,1,2],[.85,2,.85],'#ba90da',[{type:'npc',enabled:true,activation:'interact',cooldown:900,patrolDistance:1.5,period:5,message:'Нажми кнопку возле ворот, чтобы пройти дальше.'}]);
 obj('lab_button','Кнопка у ворот','block',[-2,.35,-2],[.8,.7,.8],'#40d2d5',[{type:'trigger',enabled:true,activation:'interact'}]);
 obj('lab_wall_left','Левая стена','block',[-9,1.4,-5],[16,2.8,.65],'#344e61',[]);
 obj('lab_wall_right','Правая стена','block',[9,1.4,-5],[16,2.8,.65],'#344e61',[]);
 obj('lab_door','Поднимающаяся дверь','block',[0,1.4,-5],[3,2.8,.6],'#c1b9a2',[{type:'door',enabled:true,activation:'interact',cooldown:250,openHeight:3.4}]);
 obj('lab_coin','Монета · предмет','coin',[2,1,-3],[1,1,1],'#ffd774',[{type:'pickup',enabled:true,activation:'touch',amount:3,message:'Получено 3 монеты'}]);
 obj('lab_damage','Красная опасность','hazard',[-4,.13,-7],[2,.26,2],'#f76462',[{type:'damage',enabled:true,activation:'touch',amount:20,cooldown:700}]);
 obj('lab_heal','Лечебная сфера','coin',[-5,.8,-3],[.65,.65,.65],'#61e8b5',[{type:'heal',enabled:true,activation:'touch',amount:25,cooldown:1500}]);
 obj('lab_checkpoint','Чекпоинт','spawn',[0,0,-9],[1.3,1,1.3],'#68eabe',[{type:'checkpoint',enabled:true,activation:'touch',cooldown:1000}]);
 obj('lab_teleport','Телепорт','goal',[3,1,-11],[1.0,1.2,1],'#5a95ef',[{type:'teleporter',enabled:true,activation:'interact',target:'lab_exit',message:'Телепорт выполнен',cooldown:900}]);
 obj('lab_exit','Выход телепорта','spawn',[-5,0,-11],[1,1,1],'#ffd4a1',[]);
 obj('lab_mover','Движущаяся платформа','movingPlatform',[0,.2,-13],[2,.4,2],'#64bbd8',[{type:'movingPlatform',enabled:true,offset:[3,0,0],period:4}]);
 obj('lab_goal','Финиш','goal',[0,1,-16],[1.3,1.3,1],'#f3db8d',[]);
 doc.graphs=[
  {id:'g_lab_door',name:'Кнопка открывает дверь',event:'interact',source:'lab_button',enabled:true,nodes:[{id:'n_door',type:'door',target:'lab_door',mode:'toggle',x:310,y:190},{id:'n_msg',type:'message',text:'Ворота открыты! Двигайся вперёд.',x:550,y:190}],links:[{from:'start',to:'n_door',port:'next'},{from:'n_door',to:'n_msg',port:'next'}]},
  {id:'g_lab_goal',name:'Финиш после монеты',event:'touch',source:'lab_goal',enabled:true,nodes:[{id:'n_hascoins',type:'ifCoins',amount:3,x:300,y:190},{id:'n_win',type:'win',x:575,y:100},{id:'n_more',type:'message',text:'Сначала собери монету возле ворот!',x:575,y:320}],links:[{from:'start',to:'n_hascoins',port:'next'},{from:'n_hascoins',to:'n_win',port:'yes'},{from:'n_hascoins',to:'n_more',port:'no'}]},
  {id:'g_lab_npc',name:'Проводник объясняет механику',event:'interact',source:'lab_npc',enabled:true,nodes:[{id:'n_hello',type:'message',text:'WASD — ходить, E — говорить, V — вид камеры. Кнопка откроет дверь.',x:330,y:200}],links:[{from:'start',to:'n_hello',port:'next'}]}
 ];
 doc.ui=[{id:'ui_lab_health',name:'Индикатор здоровья',type:'label',text:'Здоровье',bind:'health',x:3,y:6,width:220,fontSize:17,color:'#ffffff',action:'none',value:0}];
 doc.scripts=[];loadDoc(doc);logicGraphId='g_lab_door';setTab('logic');status('Gameplay Lab создан. Три графа, девять новых игровых объектов и компоненты готовы к Play.');}
function attachGameplayEditor(){
 $('addLogicGraph').onclick=addLogicGraph;$('makeGameplayDemo').onclick=createGameplayDemo;$('makeTimerCounterDemo').onclick=addTimerCounterDemo;$('makeUnlockGateDemo').onclick=addUnlockGateDemo;$('logicAddNode').onclick=addLogicNode;$('logicDeleteGraph').onclick=deleteLogicGraph;$('logicRemoveNode').onclick=removeLogicNode;
 $('logicDisconnect').onclick=function(){var g=graphSelected(),n=graphNodeSelected();if(!g||!n)return;remember();g.links=g.links.filter(function(l){return l.to!==n.id;});renderLogicGraph();};
 $('logicExit').onclick=function(){setTab('world');};
 Object.entries(logicEventNames).forEach(function(pair){var opt=document.createElement('option');opt.value=pair[0];opt.textContent=pair[1];$('logicEvent').appendChild(opt);});
 Object.entries(logicNodeNames).forEach(function(pair){var opt=document.createElement('option');opt.value=pair[0];opt.textContent=pair[1];$('logicNodeType').appendChild(opt);});
 $('logicEvent').onchange=function(){var g=graphSelected();if(!g)return;remember();g.event=this.value;g.source='*';if(g.event==='timer'&&!(Number(g.interval)>=.1))g.interval=2;if(g.event==='signal'&&!g.signal)g.signal='gate_unlocked';refreshLogicEditor();};
 $('logicTimerInterval').onchange=function(){var g=graphSelected();if(!g||g.event!=='timer')return;remember();var n=Number(this.value);g.interval=Number.isFinite(n)?Math.max(.1,Math.min(3600,n)):2;refreshLogicEditor();};
 $('logicSignalName').onchange=function(){var g=graphSelected();if(!g||g.event!=='signal')return;var name=this.value.trim();if(!/^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_-]{0,39}$/.test(name)){status('Имя сигнала: 1–40 букв/цифр, начало — буква или _',true);this.value=g.signal||'gate_unlocked';return;}remember();g.signal=name;refreshLogicEditor();};
 $('logicSource').onchange=function(){var g=graphSelected();if(!g)return;remember();g.source=this.value;refreshLogicEditor();};
 $('logicGraphName').onchange=function(){var g=graphSelected();if(!g)return;remember();g.name=this.value.trim().slice(0,75)||'Граф';refreshLogicEditor();};
 $('logicGraphEnabled').onchange=function(){var g=graphSelected();if(!g)return;remember();g.enabled=this.checked;};
 $('gameHealth').onchange=function(){remember();project.settings.maxHealth=Math.max(1,Math.min(1000,Number(this.value)||100));this.value=project.settings.maxHealth;status('Максимальное здоровье: '+project.settings.maxHealth);};
 refreshLogicEditor();
}
// Audit wraps the existing project validator and checks the gameplay graph document too.
var _legacyProjectAudit=projectAudit;
projectAudit=function(){var res=_legacyProjectAudit();try{if(project.terrain)window.BridgeTerrainCore.validate(project.terrain);}catch(e){res.errors.push('Terrain: '+e.message);}var extra=window.BridgeGameplayCore.validate(project);res.errors.push.apply(res.errors,extra.errors);res.warnings.push.apply(res.warnings,extra.warnings);var economy=window.BridgeEconomy.validate(project);res.errors.push.apply(res.errors,economy.errors);res.warnings.push.apply(res.warnings,economy.warnings);return res;};

function attach(){document.querySelectorAll('[data-tab]').forEach(function(b){b.onclick=function(){setTab(this.dataset.tab);};});[['addGround','ground'],['addBlock','block'],['addCoin','coin'],['addGoal','goal'],['addSpawn','spawn'],['addHazard','hazard'],['addNPC','npc'],['addMovingPlatform','movingPlatform']].forEach(function(pair){$(pair[0]).onclick=function(){addObject(pair[1]);};});$('addLabel').onclick=function(){addUI('label');};$('addButton').onclick=function(){addUI('button');};$('addPanel').onclick=function(){addUI('panel');};$('addProgress').onclick=function(){addUI('progress');};$('addUiDemo').onclick=addUiDemo;$('addShopItem').onclick=addShopItem;$('gameVolume').onchange=function(){remember();project.settings.audioVolume=Math.max(0,Math.min(1,+this.value||0));};$('testAudio').onclick=function(){try{var ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),g=ctx.createGain();osc.connect(g);g.connect(ctx.destination);osc.frequency.value=660;g.gain.setValueAtTime(.04,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.18);osc.start();osc.stop(ctx.currentTime+.18);}catch(e){status('Web Audio недоступен: '+e.message,true);}};$('addScript').onclick=addScript;$('deleteItem').onclick=deleteSelected;$('duplicate').onclick=duplicateSelected;$('importGLB').onclick=function(){$('fileInput').click();};$('addDemo').onclick=addMiniRover;document.querySelectorAll('[data-tool]').forEach(function(btn){btn.onclick=function(){setTool(this.dataset.tool);if(this.dataset.tool==='terrain')setTab('terrain');else if(activeTab==='terrain')setTab('world');};});$('focusSelection').onclick=focusSelected;$('fitScene').onclick=fitScene;$('gridEnabled').onchange=function(){if(gridHelper)gridHelper.visible=this.checked&&toolMode!=='terrain';};$('alignX').onclick=function(){alignSelection('x');};$('alignY').onclick=function(){alignSelection('y');};$('alignZ').onclick=function(){alignSelection('z');};$('distributeX').onclick=function(){distributeSelection('x');};$('distributeZ').onclick=function(){distributeSelection('z');};$('groupSelection').onclick=groupSelected;$('ungroupSelection').onclick=ungroupSelected;$('undoBtn').onclick=historyBack;$('redoBtn').onclick=historyForward;$('fileInput').onchange=function(e){importGLB(e.target.files);e.target.value='';};$('projectName').oninput=function(){project.name=this.value;setDirty(true);};$('btnPlay').onclick=play;$('playRetry').onclick=function(){stop();play();};$('playClose').onclick=stop;$('playLog').onclick=function(){var out={version:'0.17.1',time:new Date().toISOString(),project:project&&project.name,objectCount:project&&project.objects&&project.objects.length,three:window.__bridgeThreeLoad,userAgent:navigator.userAgent,playDiagnostic:$('playDiagnosticText').textContent,editorRenderState:$('renderState').textContent,projectAudit:projectAudit()};dl(JSON.stringify(out,null,2),'BridgeStudio-Diagnostics.json','application/json');};$('btnStop').onclick=stop;$('btnBuild').onclick=build;$('saveProject').onclick=save;$('btnCheck').onclick=checkProject;$('btnDemoReset').onclick=function(){if(confirm('Вернуть демонстрацию Coin Rush? Несохранённые изменения будут потеряны.')){loadDoc(sample());checkProject();}};$('restoreDraft').onclick=loadDraft;$('snapshotNow').onclick=function(){recordSnapshot(true).then(function(ok){status(ok?'Резервная копия сохранена.':'Не удалось записать копию в IndexedDB.',!ok);});};$('saveNative').onclick=saveNative;$('loadProject').onclick=function(){$('projectInput').click();};$('projectInput').onchange=async function(e){try{var f=e.target.files[0];if(f)loadDoc(JSON.parse(await f.text()),true);}catch(err){status(err.message,true);}e.target.value='';};$('newProject').onclick=function(){if(confirm('Создать новый проект? Сначала сохрани текущие изменения.'))loadDoc(blank());};$('cameraCenter').onclick=function(){orbit.yaw=.64;orbit.pitch=.95;orbit.distance=17;orbit.target.set(0,1,0);};$('cameraTop').onclick=function(){orbit.pitch=.13;orbit.distance=18;};$('editorSpeed').oninput=function(){editorCamSpeed=Number(this.value)||6;$('editorSpeedValue').textContent=editorCamSpeed.toFixed(1);};
$('gameSpeed').onchange=function(){remember();project.settings.moveSpeed=Math.max(1,Math.min(18,Number(this.value)||5));this.value=project.settings.moveSpeed;status('Скорость игрока обновлена');};
$('terrainDemo').onclick=addDemoTerrain;
 $('terrainFlat').onclick=addFlatTerrain;
  document.querySelectorAll('[data-terrain-mode]').forEach(function(b){b.onclick=function(){if(terrainStroke)endTerrainStroke(false);terrainWorkMode=this.dataset.terrainMode;updateTerrainUI();setTool('terrain');refreshInspector();};});
  document.querySelectorAll('[data-terrain-material]').forEach(function(b){b.onclick=function(){if(terrainStroke)endTerrainStroke(false);terrainMaterial=this.dataset.terrainMaterial;updateTerrainUI();setTool('terrain');refreshInspector();};});
 document.querySelectorAll('[data-terrain-brush]').forEach(function(b){b.onclick=function(){terrainBrush=this.dataset.terrainBrush;updateTerrainUI();setTool('terrain');};});
 ['terrainRadius','terrainStrength','terrainHardness'].forEach(function(id){$(id).oninput=updateTerrainUI;});
 updateTerrainUI();
$('gameJump').onchange=function(){remember();project.settings.jumpPower=Math.max(3,Math.min(18,Number(this.value)||7.6));this.value=project.settings.jumpPower;status('Сила прыжка обновлена');};
$('gameSlope').onchange=function(){remember();var n=Number(this.value);project.settings.maxWalkableSlopeDeg=Number.isFinite(n)?Math.max(0,Math.min(89,n)):45;this.value=project.settings.maxWalkableSlopeDeg;status('Предельный угол подъёма обновлён');};
 $('exportLibrary').onclick=exportLibrary;$('importLibrary').onclick=function(){$('libraryInput').click();};$('libraryInput').onchange=async function(e){try{var f=e.target.files[0];if(f)importLibrary(JSON.parse(await f.text()));}catch(err){status('Библиотека: '+err.message,true);}e.target.value='';};
 $('viewport').addEventListener('dragover',function(e){if(!playing){e.preventDefault();e.dataTransfer.dropEffect='copy';}});$('viewport').addEventListener('drop',function(e){if(playing)return;e.preventDefault();var assetId=e.dataTransfer.getData('application/x-bridge-asset'),prefabId=e.dataTransfer.getData('application/x-bridge-prefab'),pt=viewportDropPoint(e);if(assetId)addAssetInstance(assetId,pt);else if(prefabId)instantiatePrefab(prefabId,pt);else if(e.dataTransfer.files&&e.dataTransfer.files.length)importGLB(e.dataTransfer.files);});
 $('assetSearch').oninput=refreshAssetBrowser;$('textureInput').onchange=function(e){addTexture(e.target.files);e.target.value='';};$('addTexture').onclick=function(){$('textureInput').click();};$('createPrefab').onclick=createPrefab;$('importPrefab').onclick=function(){$('prefabInput').click();};$('prefabInput').onchange=async function(e){try{var file=e.target.files[0];if(file)importPrefabFile(JSON.parse(await file.text()));}catch(err){status('Prefab: '+err.message,true);}e.target.value='';};$('assetPreviewClose').onclick=closeAssetPreview;
 document.querySelectorAll('[data-light]').forEach(function(el){el.onchange=function(){var k=this.dataset.light;remember();if(k==='sky')project.settings.sky=this.value;else project.settings.lighting[k]=this.type==='checkbox'?this.checked:this.type==='number'?Number(this.value):this.value;applyLighting();status('Освещение сцены обновлено.');};});
 
var editorPlayCodeMap={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyQ:'q',KeyE:'e',KeyV:'v',Space:' ',ShiftLeft:'shift',ShiftRight:'shift',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright'};
function editorPhysicalKey(e){return editorPlayCodeMap[e.code]||String(e.key||'').toLowerCase();}
function sendPlayKey(e,down){var k=editorPhysicalKey(e);if(['w','a','s','d','q','e','v','shift',' ','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k)<0)return false;
if(e.target&&/^(input|textarea|select)$/i.test(e.target.tagName||''))return false;
try{var child=$('playFrame').contentWindow;if(child)child.postMessage({bridgeInput:'key',key:k,down:down},'*');}catch(ex){}return true;}
window.addEventListener('keyup',function(e){var key=editorPhysicalKey(e);if(playing){if(sendPlayKey(e,false))e.preventDefault();return;}delete editorKeys[key];});
window.addEventListener('blur',function(){editorKeys={};editorCamRightMouse=false;if(playing){try{$('playFrame').contentWindow.postMessage({bridgeInput:'clear'},'*');}catch(ex){}}});
window.addEventListener('keydown',function(e){
if(playing){if(sendPlayKey(e,true))e.preventDefault();return;}
var key=editorPhysicalKey(e);
if(editorCamActive&&document.activeElement===renderer.domElement&&!e.ctrlKey&&!e.altKey&&['w','a','s','d','q','e','shift'].indexOf(key)>=0){editorKeys[key]=true;e.preventDefault();return;}
if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();save();return;}if(/input|textarea/i.test((document.activeElement||{}).tagName||''))return;if(e.ctrlKey&&e.key.toLowerCase()==='a'&&activeTab==='world'){e.preventDefault();setSelectedIds(project.objects.map(function(o){return o.id;}),selectedId);return;}if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)historyForward();else historyBack();return;}if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();historyForward();return;}if(e.key.toLowerCase()==='g'){setTool('move');return;}if(e.key.toLowerCase()==='r'){setTool('rotate');return;}if(e.key.toLowerCase()==='s'&&!e.ctrlKey){setTool('scale');return;}if(e.key.toLowerCase()==='f'){focusSelected();return;}if(e.key==='Home'){fitScene();return;}if(e.key==='Escape'&&terrainStroke){e.preventDefault();endTerrainStroke(true);return;}if(e.key==='Escape'){editorCamActive=false;editorKeys={};if(renderer)renderer.domElement.blur();select('world',null);return;}
if(selectedKind==='world'&&selectedIds.length&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','PageUp','PageDown'].indexOf(e.key)>=0){e.preventDefault();var step=e.shiftKey?1:($('snapEnabled').checked?.25:.1);remember();selectedObjects().forEach(function(chosen){if(e.key==='ArrowLeft')chosen.position[0]-=step;else if(e.key==='ArrowRight')chosen.position[0]+=step;else if(e.key==='ArrowUp')chosen.position[2]-=step;else if(e.key==='ArrowDown')chosen.position[2]+=step;else if(e.key==='PageUp')chosen.position[1]+=step;else if(e.key==='PageDown')chosen.position[1]-=step;var m=meshes[chosen.id];if(m)m.position.fromArray(chosen.position);});refreshSelection();updateGizmo();refreshInspector();status('Перемещено объектов: '+selectedIds.length);return;}
if(e.key==='Delete'){deleteSelected();}if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();save();}if(e.ctrlKey&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelected();}});}
initRenderer();project=normalizeDoc(initialProject());$('projectName').value=project.name;attach();attachGameplayEditor();syncGameSettings();refreshAssetBrowser();refreshLightingControls();if(editorScene)refreshScene();select('world',project.objects.some(function(o){return o.id==='demo_rover';})?'demo_rover':project.objects[0].id);lastExplicitSave=sceneData();setDirty(false);status('Bridge Studio v0.21.0 · Visual Scripting готов к работе.');setInterval(writeDraft,15000);document.addEventListener('visibilitychange',function(){if(document.hidden)writeDraft();});window.__bridgeQA=function(){return {project:clone(project),selectedIds:selectedIds.slice(),dirty:dirty,tool:toolMode,sculpting:!!terrainStroke};};window.__bridgeGameplayQA={getGraph:function(){return clone(graphSelected());},emitAvailable:!!window.BridgeGameplayCore,createGameplayDemo:createGameplayDemo};window.__bridgeV13={exportLibrary:exportLibrary,importLibrary:importLibrary,normalizeDoc:normalizeDoc,exportGameDoc:exportGameDoc,createPrefab:createPrefab,instantiatePrefab:instantiatePrefab,addAssetInstance:addAssetInstance,importPrefabFile:importPrefabFile,previewAsset:previewAsset};
// v0.17.2: signed live-patch UI. Works only through the dedicated local Windows host.

function attachLiveUpdates(){
 var btn=$('btnUpdates');if(!btn)return;
 // The signed update protocol and local host are unchanged.
 if(location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')return;
 var state=null,notes={
   '0.21.0':['Visual Scripting: отправка и получение именованных сигналов между графами без JavaScript.','Для числовых условий добавлены ≥, = и ≤; компонент двери теперь может управляться только графом.','Готовая схема «3 нажатия на кнопку → открыть ворота → +10 монет», Play/HTML и сохранение .rwscene.'],
   '0.20.0':['Gameplay Engine: новый триггер «По таймеру» с интервалом 0.1–3600 сек.','Новые блоки визуальной логики: «Изменить счётчик» (добавить/установить) и «Если счётчик ≥».','Готовый шаблон «Награда каждые 3 тика», сохранение .rwscene и единая логика в Play и HTML-экспорте.'],
   '0.19.4':['Скольжение начинается на 7° раньше предела ходьбы: по умолчанию с 38° вместо 45°.','Персонаж соскальзывает намного медленнее: максимум 1.8 единицы/с, ускорение зависит от крутизны склона.','Предел обычной ходьбы остаётся 45°, настройка проекта и старые .rwscene совместимы.'],
   '0.19.3':['Terrain Physics: персонаж больше не поднимается по слишком крутым склонам благодаря проверке нормалей треугольников.','Настраиваемый максимум подъёма от 0° до 89° (по умолчанию 45°), движение вдоль склонов и скольжение вниз.','Исправлен grounded на крутых поверхностях, сохранена совместимость старых .rwscene и Play / HTML-экспорта.'],
   '0.19.2':['Terrain Paint: трава, песок, земля и камень с плавными переходами и встроенными процедурными текстурами.','Переключатель SCULPT / PAINT, выбор материала и кисть с параметрами радиуса, силы и жёсткости.','Один мазок покраски — одно Undo/Redo. Слои сохраняются в .rwscene и экспортируются в HTML вместе с рельефом.'],
  '0.19.1':['Исправлены провалы персонажа сквозь изменённый Terrain при движении по холмам и крутым склонам.','Добавлена проверка траектории ходьбы небольшими шагами и блокировка слишком высоких откосов.','Приземление использует фактическую поверхность Terrain. Поддерживается сохранение старых .rwscene.'],
  '0.19.0':['Отдельная вкладка «РЕЛЬЕФ» для создания карт 1×1, 2×2 и 4×4 участка.','Четыре кисти Raise, Lower, Smooth и Flatten с радиусом, силой, жёсткостью и живым кругом на поверхности.','Один мазок отменяется одним Undo/Redo. Escape отменяет текущий мазок.','Обновляются только затронутые участки. Рельеф сохраняется в .rwscene, работает в Play и экспортированном WARPGAME HTML.'],
  '0.18.5':['Добавлен Terrain Core: два связанных участка рельефа, единая высота поверхности в редакторе, Play и экспорте.', 'Кнопка «Создать тестовый склон» во вкладке «Мир». Рельеф сохраняется в .rwscene, поддерживает Undo/Redo.', 'Исправлена физика первого кадра: отрицательное время больше не вызывает неверное движение персонажа.'],
  '0.18.4':["Play запускает игру в изолированном окне с собственной копией Three.js.", "При наличии локального Three.js предпросмотр работает без сети. Stop освобождает документ игры."],
  '0.18.3':["Build проверяет фактическое число байтов готового HTML для WARPGAME.", "При превышении 3 000 000 байт скачивание игры останавливается. В отчёте виден точный размер. Оба профиля Standalone сохраняют большие игры."],
  '0.18.2':["Перед патчем можно сохранить изменённый проект или отменить установку.", "Редактор проверяет запись .rwscene. При обычном скачивании можно подтвердить файл, выбрав его для проверки."],
  '0.18.1':['Добавлено окно истории обновлений и описаний патчей.','Изменения доступного обновления показываются до установки.','Проверка обновлений и установка доступны в одном окне.'],
  '0.18.0':['UI Builder: текст, кнопки, панели, HP-полоски.','Инвентарь (I) и магазин (B) с покупками за монеты.','Встроенные звуки, сохранение .rwscene и HTML-экспорт.'],
  '0.17.3':['Проверена установка обновления через GitHub без переустановки редактора.'],
  '0.17.2':['Live Patches: проверка целостности, резервное копирование и откат.'],
  '0.17.1':['Исправление WASD и поворота персонажа относительно камеры.'],
  '0.17.0':['Игровые компоненты и визуальная логика: NPC, HP, двери, телепорты и чекпоинты.']
 };
 var dialog=$('patchNotesBackdrop'),noteList=$('patchNotesList'),installBtn=$('patchNotesInstall');
 function compareVersions(a,b){var x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(var i=0;i<3;i++){var d=(y[i]||0)-(x[i]||0);if(d)return d;}return 0;}
 function renderNotes(){
  if(dialog.hidden)return;
  noteList.replaceChildren();
  var current=(state&&state.current)||'0.21.0',available=state&&state.ready&&state.available||'';
  $('patchNotesStatus').textContent='Установлено: v'+current+(available?' · Доступно: v'+available:' · '+(state&&state.message||'Нет новых обновлений'));
  installBtn.hidden=!available;if(available)installBtn.textContent='⬇ Установить v'+available;
  var versions=Object.keys(notes).concat(available&&!notes[available]?[available]:[]).sort(compareVersions).filter(function(v){return compareVersions(v,current)>=0||v===current||v===available;}).slice(0,8);
  if(!versions.length)versions=[current];
  versions.forEach(function(v){
   var section=document.createElement('section');section.className='patch-notes-entry';
   var h=document.createElement('h3');h.textContent='v'+v+(v===available?' · Доступный патч':v===current?' · Установлена':'');section.appendChild(h);
   var changes=notes[v],list=document.createElement('ul');
   if(!Array.isArray(changes)||!changes.length)changes=['Описание этой версии пока не опубликовано.'];
   changes.slice(0,12).forEach(function(c){if(typeof c!=='string')return;var li=document.createElement('li');li.textContent=c.slice(0,500);list.appendChild(li);});
   section.appendChild(list);noteList.appendChild(section);
  });
 }
 async function loadNotes(){
  try{
   var response=await fetch('https://raw.githubusercontent.com/jonhspoky2/bridge-studio-updates/main/updates/changelog.json',{cache:'no-store'});
   if(!response.ok)throw Error('Release notes not available');
   var payload=await response.json();if(!payload||!payload.versions||typeof payload.versions!=='object')throw Error('Invalid notes');
   Object.keys(payload.versions).forEach(function(version){
    var entries=payload.versions[version];
    if(/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version)&&Array.isArray(entries)&&entries.length<=20&&entries.every(function(e){return typeof e==='string';}))notes[version]=entries;
   });
  }catch(e){}finally{renderNotes();}
 }
 async function poll(){
  try{
   var response=await fetch('__updates/status',{cache:'no-store'});
   if(!response.ok||!String(response.headers.get('content-type')||'').includes('application/json'))throw Error('not desktop host');
   state=await response.json();btn.classList.remove('hidden');
   if(state.ready){btn.textContent='⬇ Патч '+state.available;btn.style.borderColor='#5bd5a4';}
   else if(state.checking){btn.textContent='↻ Проверка…';btn.style.borderColor='';}
   else if(state.configured&&/ошибка|не удалось|failed|not found|404|403/i.test(state.message||'')){btn.textContent='! Патчи';btn.style.borderColor='#c07878';}
   else{btn.textContent=state.configured?'✓ '+state.current:'↻ Патчи';btn.style.borderColor='';}
   btn.title='Открыть изменения патчей. '+(state.message||'');
   renderNotes();
  }catch(e){btn.classList.add('hidden');}
 }
 function openNotes(){dialog.hidden=false;renderNotes();$('patchNotesDialog').focus();loadNotes();}
 function closeNotes(){dialog.hidden=true;btn.focus();}
 btn.onclick=openNotes;
 $('patchNotesClose').onclick=closeNotes;
 dialog.onclick=function(e){if(e.target===dialog)closeNotes();};
 window.addEventListener('keydown',function(e){if(saveDialog.open){e.stopImmediatePropagation();if(e.ctrlKey&&e.key.toLowerCase()==='s')e.preventDefault();return;}if(e.key==='Escape'&&!dialog.hidden){e.preventDefault();e.stopPropagation();closeNotes();}},true);
 $('patchNotesCheck').onclick=async function(){
  if(!state)return;
  if(!state.configured){status('Канал обновлений не подключён. Проверь update-channel.txt.',true);return;}
  this.disabled=true;
  try{await fetch('__updates/check',{method:'POST'});await poll();setTimeout(poll,1500);}
  catch(e){status('Проверка обновлений: '+e.message,true);}
  finally{this.disabled=false;}
 };
 var saveDialog=$('patchSaveDialog'),yes=$('patchSaveYes'),no=$('patchSaveNo'),file=$('patchVerifyFile');
 var message=$('patchSaveMessage'),pendingData=null,targetVersion='',busy=false;
 function lock(value){
  busy=value;yes.disabled=value;no.disabled=value;
 }
 function closeSave(){saveDialog.close();pendingData=null;installBtn.disabled=false;installBtn.focus();}
 function showError(e){
  message.textContent=e.name==='AbortError'?'Сохранение отменено. Можно повторить или закрыть окно.':e.message;
 }
 no.onclick=closeSave;
 saveDialog.oncancel=function(e){if(e.target!==saveDialog)return;e.preventDefault();if(!busy)closeSave();};
 function requireCurrent(data){
  if(data!==sceneData()){setDirty(true);throw Error('Проект изменился. Закрой окно и начни установку снова.');}
 }
 async function applySaved(data){
  message.textContent='Создаём резервную копию проекта…';
  requireCurrent(data);
  if(!await recordSnapshot(true))throw Error('Не удалось записать резервную копию. Установка остановлена.');
  requireCurrent(data);
  if(playing||!state.ready||state.available!==targetVersion)throw Error('Состояние редактора или патча изменилось. Проверь обновления снова.');
  message.textContent='Устанавливаем патч…';
  var response=await fetch('__updates/apply',{method:'POST'});
  if(!response.ok)throw Error('Локальный сервер не ответил.');
  var result=await response.json();
  if(!result.ok)throw Error(result.message||'Не удалось применить обновление.');
  if(data!==sceneData()){setDirty(true);throw Error('Патч применён. Проект изменился во время установки. Закрой окно и сохрани его перед перезапуском.');}
  location.reload();
 }
 async function run(action){
  if(busy)return;
  lock(true);
  try{await action();}catch(e){showError(e);}finally{lock(false);}
 }
 yes.onclick=function(){
  if(pendingData!==null){file.value='';file.click();return;}
  run(async function(){
   var data=sceneData();
   if(dirty||data!==lastExplicitSave){
    if(!window.showSaveFilePicker){
     downloadScene(data);pendingData=data;yes.textContent='Выбрать .rwscene…';
     message.textContent='После скачивания выбери сохранённый файл .rwscene. Редактор сверит его с текущим проектом перед установкой.';
     return;
    }
    message.textContent='Сохраняем проект в .rwscene…';
    await writeScene(data);
   }
   await applySaved(data);
  });
 };
 file.onchange=function(){
  var saved=file.files[0];if(!saved||pendingData===null||!saveDialog.open)return;
  run(async function(){
   var data=pendingData;
   if(!/\.rwscene$/i.test(saved.name)||saved.size!==new Blob([data]).size||await saved.text()!==data)
    throw Error('Файл отличается от текущего проекта. Выбери скачанный .rwscene или отмени установку.');
   requireCurrent(data);lastExplicitSave=data;setDirty(false);pendingData=null;
   yes.textContent='Продолжить установку';
   await applySaved(data);
  });
 };
 file.oncancel=function(){message.textContent='Файл не выбран. Установка приостановлена.';};
 installBtn.onclick=function(){
  if(!state||!state.ready||saveDialog.open)return;
  if(playing){alert('Сначала останови Play Mode, затем обнови редактор.');return;}
  targetVersion=state.available;pendingData=null;
  var needsSave=dirty||sceneData()!==lastExplicitSave;
  if(needsSave)setDirty(true);
  message.textContent=needsSave?'Проект изменён. Сохранить его в .rwscene перед установкой v'+targetVersion+'? После установки редактор перезагрузится.':'Установить патч v'+targetVersion+' и перезагрузить редактор?';
  yes.textContent=needsSave?'Да, сохранить':'Да, установить';
  saveDialog.showModal();no.focus();installBtn.disabled=true;
 };
 poll();setInterval(poll,30000);
}
attachLiveUpdates();
})();
