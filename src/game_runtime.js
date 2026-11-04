/* Bridge Studio 0.17.1 - keyboard layout and character heading fix. THREE r128 global. */
(function(){'use strict';
function report(kind,message){try{if(window.parent!==window)window.parent.postMessage({bridgeGame:kind,detail:String(message||'')},'*');}catch(e){}}
window.addEventListener('error',function(e){report('error',(e.error&&e.error.stack)||e.message||'Runtime error');var b=document.getElementById('bootIndicator');if(b){b.style.display='grid';b.textContent='ОШИБКА ИГРЫ: '+(e.message||'unknown');}});
window.addEventListener('unhandledrejection',function(e){report('error',(e.reason&&e.reason.message)||e.reason||'Promise error');});
var doc=JSON.parse(document.getElementById('bridge-game-data').textContent),T=window.THREE;
var root=document.getElementById('game'),hud=document.getElementById('hud'),status=document.getElementById('notice');
if(!T){report('error','Three.js r128 не загрузился');status.textContent='Не удалось загрузить Three.js. Нужен доступ к cdnjs.';status.style.display='block';var boot=document.getElementById('bootIndicator');if(boot)boot.textContent=status.textContent;return;}
var state={coins:0,collected:0,won:false,checkpoint:null};var economy=null,quests=null,uiOverlay=null;var requiredCoins=(doc.objects||[]).filter(function(o){return o.action==='collect';}).length;var scene=new T.Scene();
var saveEnabled=!!(doc.settings&&doc.settings.saveProgress===true&&typeof doc.projectId==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(doc.projectId));
var saveKey=saveEnabled?'bridge-game-save:v1:'+doc.projectId:'',saveAvailable=false,restoring=false;
function saveProgress(){
 if(!saveEnabled||restoring||!quests||!economy||!gameplay)return false;
 try{
  var picked=gameObjects.filter(function(q){return q.def.action==='collect'&&!q.mesh.visible;}).map(function(q){return q.def.id;});
  localStorage.setItem(saveKey,JSON.stringify({version:1,coins:state.coins,collected:state.collected,inventory:economy.snapshot(),
   quests:quests.snapshot(),picked:picked,componentPicked:Object.keys(gameplay.state.picked).filter(function(k){return !!gameplay.state.picked[k];})}));
  saveAvailable=true;return true;
 }catch(e){saveAvailable=false;return false;}
}
function loadProgress(){
 if(!saveEnabled||!quests||!economy||!gameplay)return false;
 try{
  var saved=JSON.parse(localStorage.getItem(saveKey)||'null');saveAvailable=true;
  if(!saved||saved.version!==1||typeof saved!=='object')return false;
  restoring=true;
  var number=function(v,max){return typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;};
  state.coins=number(saved.coins,1000000000);state.collected=number(saved.collected,requiredCoins);
  economy.restore(saved.inventory);quests.restore(saved.quests);
  var valid=new Set(gameObjects.map(function(q){return q.def.id;}));
  (Array.isArray(saved.picked)?saved.picked:[]).slice(0,2000).forEach(function(id){
   if(!valid.has(id))return;var q=objectById(id);if(q&&q.def.action==='collect')q.mesh.visible=false;
  });
  (Array.isArray(saved.componentPicked)?saved.componentPicked:[]).slice(0,2000).forEach(function(id){
   if(!valid.has(id))return;gameplay.state.picked[id]=true;var q=objectById(id);if(q)q.mesh.visible=false;
  });
  restoring=false;return true;
 }catch(e){restoring=false;saveAvailable=false;return false;}
}
var environment=Object.assign({ambientColor:'#eaf6ff',ambientIntensity:1.5,sunColor:'#ffeed9',sunIntensity:1.6,shadows:true,fog:false,fogColor:'#96bfd8',fogNear:20,fogFar:95},doc.settings.lighting||{});
scene.background=new T.Color(doc.settings.sky||'#78b9ef');scene.fog=environment.fog?new T.Fog(environment.fogColor,Number(environment.fogNear)||20,Math.max(Number(environment.fogFar)||95,Number(environment.fogNear)+1)):null;
var gameTextureCache={};function gameAsset(d){return d.asset||((doc.assets||[]).find(function(a){return a.id===d.assetId;})||{}).data||'';}
function gameTexture(id){if(!id)return null;var data=(doc.textures||[]).find(function(t){return t.id===id;});if(!data)return null;if(gameTextureCache[id])return gameTextureCache[id];if(typeof T.TextureLoader!=='function')return null;var tex=new T.TextureLoader().load(data.data);tex.encoding=T.sRGBEncoding;gameTextureCache[id]=tex;return tex;}
function gameMaterialConfig(d){var m=d.material||{};return {roughness:m.roughness==null?(d.type==='coin'?.32:.75):Number(m.roughness),metalness:m.metalness==null?(d.type==='coin'?.62:.05):Number(m.metalness),opacity:m.opacity==null?1:Number(m.opacity),emissive:m.emissive||'#000000',emissiveIntensity:m.emissiveIntensity==null?0:Number(m.emissiveIntensity),textureId:m.textureId||'',overrideGLB:!!m.overrideGLB};}
function gameMaterial(d){var m=gameMaterialConfig(d),opts={color:d.color||'#59bbcc',roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.opacity<1,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity};var map=gameTexture(m.textureId);if(map)opts.map=map;return new T.MeshStandardMaterial(opts);}
function decorateGameGlb(root,d){var mc=gameMaterialConfig(d);root.traverse(function(o){if(!o.material)return;o.castShadow=true;o.receiveShadow=true;if(mc.overrideGLB)o.material=Array.isArray(o.material)?o.material.map(function(){return gameMaterial(d);}):gameMaterial(d);});} 
var renderer;
try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){report('error','WebGL: '+e.message);status.textContent='WebGL недоступен: '+e.message;status.style.display='block';var boot=document.getElementById('bootIndicator');if(boot)boot.textContent=status.textContent;return;}
renderer.setPixelRatio(Math.min(1.65,window.devicePixelRatio||1));renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=(function(v){v=Number(v);return Number.isFinite(v)?Math.min(2,Math.max(.45,v)):1.22;})(environment.exposure);renderer.shadowMap.enabled=!!environment.shadows;renderer.shadowMap.type=T.PCFSoftShadowMap;root.appendChild(renderer.domElement);
var camera=new T.PerspectiveCamera(65,1,.04,180),sun=new T.DirectionalLight(environment.sunColor,Number(environment.sunIntensity));sun.position.set((function(v){v=Number(v);return Number.isFinite(v)?Math.min(100,Math.max(-100,v)):-10;})(environment.sunX),(function(v){v=Number(v);return Number.isFinite(v)?Math.min(100,Math.max(.5,v)):19;})(environment.sunY),(function(v){v=Number(v);return Number.isFinite(v)?Math.min(100,Math.max(-100,v)):13;})(environment.sunZ));sun.castShadow=!!environment.shadows;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;scene.add(sun);scene.add(new T.HemisphereLight(environment.ambientColor,0x63788b,Number(environment.ambientIntensity)));
var gameObjects=[],colliders=[],triggerObjs=[],spawn=[0,0,0],spawnSelected=false,player=new T.Group(),velocity=0,grounded=false,prevY=0,keys={},yaw=0,camPitch=.38,drag=null,elapsed=0,firstPerson=false,gameplay=null,standingOn=null,slideSpeed=0;
var minTerrainClearance=Infinity;var terrainMeshes=[];if(doc.terrain){window.BridgeTerrainCore.validate(doc.terrain);terrainMeshes=window.BridgeTerrainCore.createMeshes(T,doc.terrain);terrainMeshes.forEach(function(m){scene.add(m);});}
var moveSpeed=Math.max(1,Math.min(18,Number(doc.settings.moveSpeed)||5)),jumpPower=Math.max(3,Math.min(18,Number(doc.settings.jumpPower)||7.6));
var maxWalkableSlopeDeg=Number(doc.settings.maxWalkableSlopeDeg);if(!Number.isFinite(maxWalkableSlopeDeg))maxWalkableSlopeDeg=45;maxWalkableSlopeDeg=Math.max(0,Math.min(89,maxWalkableSlopeDeg));
// Sliding begins seven degrees before the walk limit; existing projects keep their climb setting.
var slideSlopeDeg=Math.max(0,maxWalkableSlopeDeg-7);
var body=new T.Mesh(new T.BoxGeometry(.68,1.15,.43),new T.MeshStandardMaterial({color:0x38b7da,roughness:.72}));body.position.y=.94;body.castShadow=true;player.add(body);var head=new T.Mesh(new T.BoxGeometry(.49,.48,.49),new T.MeshStandardMaterial({color:0xffd3a4,roughness:.9}));head.position.y=1.77;head.castShadow=true;player.add(head);var hair=new T.Mesh(new T.BoxGeometry(.54,.2,.54),new T.MeshStandardMaterial({color:0x243044}));hair.position.y=2.07;player.add(hair);
// Visible face marks the model's local forward direction (-Z), including when turning.
var faceMat=new T.MeshStandardMaterial({color:0x162432,roughness:.95});for(var eyeX of [-.115,.115]){var eye=new T.Mesh(new T.BoxGeometry(.065,.07,.025),faceMat);eye.position.set(eyeX,1.82,-.258);player.add(eye);}
var legs=[],arms=[];for(var s of [-1,1]){var leg=new T.Mesh(new T.BoxGeometry(.23,.46,.33),new T.MeshStandardMaterial({color:0x26364a}));leg.position.set(s*.19,.26,0);player.add(leg);legs.push(leg);var arm=new T.Mesh(new T.BoxGeometry(.23,.78,.3),new T.MeshStandardMaterial({color:0x35b4d0}));arm.position.set(s*.47,1.13,0);player.add(arm);arms.push(arm);}scene.add(player);
var audioContext=null,volume=Math.max(0,Math.min(1,Number(doc.settings.audioVolume==null?.35:doc.settings.audioVolume)||0));
function sfx(kind){if(!volume)return;try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!audioContext)audioContext=new C();if(audioContext.state==='suspended')audioContext.resume().catch(function(){});var t=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=kind==='hurt'?'sawtooth':'sine';osc.frequency.setValueAtTime(kind==='hurt'?185:kind==='buy'?530:kind==='win'?660:400,t);osc.frequency.exponentialRampToValueAtTime(kind==='hurt'?115:kind==='win'?990:kind==='buy'?730:610,t+.13);gain.gain.setValueAtTime(Math.max(.0001,.09*volume),t);gain.gain.exponentialRampToValueAtTime(.0001,t+.18);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.185);}catch(e){/* Web Audio may be blocked by autoplay policy */}}
function closeGameOverlay(){if(uiOverlay){uiOverlay.remove();uiOverlay=null;}try{cv.focus({preventScroll:true});}catch(e){}}
function showGameOverlay(mode){if(uiOverlay)uiOverlay.remove();var overlay=document.createElement('div');overlay.id='bridgeModal';overlay.style.cssText='position:absolute;inset:0;z-index:12;display:grid;place-items:center;background:#04111dbb;pointer-events:auto;color:#e6f7ff;font:15px Segoe UI,Arial,sans-serif';var panel=document.createElement('section');panel.style.cssText='width:min(560px,90vw);max-height:80vh;overflow:auto;background:#112539;border:1px solid #4e8ba9;border-radius:16px;padding:22px;box-shadow:0 15px 80px #0009';var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px';var title=document.createElement('strong');title.style.fontSize='22px';title.textContent=mode==='shop'?'МАГАЗИН':mode==='quests'?'ЗАДАНИЯ':'ИНВЕНТАРЬ';var close=document.createElement('button');close.textContent='Закрыть ×';close.style.cssText='background:#34546e;color:white;border:0;border-radius:9px;padding:9px 13px;cursor:pointer';close.onclick=closeGameOverlay;row.append(title,close);panel.appendChild(row);var balance=document.createElement('div');balance.style.cssText='margin:10px 0;color:#ffe0a0';balance.textContent='✦ Монеты: '+state.coins;panel.appendChild(balance);var entries=economy?economy.list():[];
if(mode==='quests'){
 var tasks=quests?quests.list():[];
 if(!tasks.length){var empty=document.createElement('p');empty.textContent='Заданий пока нет. Добавь их в редакторе.';panel.appendChild(empty);}
 tasks.forEach(function(q){
  var e=document.createElement('div');e.style.cssText='border-bottom:1px solid #345067;padding:14px 6px';
  var title=document.createElement('strong');title.textContent=q.title;e.appendChild(title);
  var detail=document.createElement('div');detail.style.cssText='font-size:12px;color:#b5cce1;margin:5px 0';
  detail.textContent=(q.description?q.description+' · ':'')+q.progress+' / '+q.required+' · Награда: '+q.rewardCoins+' монет'+(q.rewardItemId?' + '+q.rewardItemCount+'× '+q.rewardItemId:'');e.appendChild(detail);
  var button=document.createElement('button');button.style.cssText='background:#38b69d;color:#082c28;border:0;border-radius:8px;padding:8px 12px;font-weight:700';
  button.disabled=q.claimed||q.progress<q.required;
  button.textContent=q.claimed?'Получено':q.progress<q.required?'Выполняется':'Забрать награду';
  button.onclick=function(){var result;restoring=true;try{result=quests.claim(q.id);}finally{restoring=false;}if(result.ok){saveProgress();notice('Задание выполнено: '+q.title);sfx('buy');showGameOverlay('quests');}
   else notice(result.error);};e.appendChild(button);panel.appendChild(e);
 });
 overlay.appendChild(panel);root.appendChild(overlay);uiOverlay=overlay;return;
}
if(!entries.length){var p=document.createElement('p');p.textContent='В проекте пока нет предметов. Добавь их во вкладке UI редактора.';panel.appendChild(p);}else entries.forEach(function(item){var e=document.createElement('div');e.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 9px;border-bottom:1px solid #345067';var description=document.createElement('div');var n=document.createElement('strong');n.textContent=item.icon+' '+item.name;var d=document.createElement('div');d.style.cssText='font-size:12px;color:#9fb9cb;margin-top:4px';d.textContent=mode==='shop'?'Цена: '+item.price+' ✦ · В сумке: '+economy.count(item.id)+'/'+item.maxStack:'Количество: '+economy.count(item.id)+' / '+item.maxStack;description.append(n,d);e.appendChild(description);if(mode==='shop'){var b=document.createElement('button');b.textContent='Купить';b.style.cssText='border:0;border-radius:8px;background:#40bba7;color:#082523;padding:10px 14px;font-weight:bold;cursor:pointer';b.onclick=function(){var r=economy.buy(item.id,1);if(r.ok){notice('Куплено: '+item.name);sfx('buy');drawHud();showGameOverlay('shop');}else{notice(r.error);sfx('hurt');}};e.appendChild(b);}panel.appendChild(e);});overlay.appendChild(panel);root.appendChild(overlay);uiOverlay=overlay;}
function notice(s){status.textContent=s;status.style.display='block';clearTimeout(notice._t);notice._t=setTimeout(function(){status.style.display='none';},2600);}
function runScripts(type,ctx){(doc.scripts||[]).forEach(function(s){if(!s.enabled||s.event!==type)return;try{new Function('api','ctx','state','"use strict";\n'+s.code)(api,ctx||{},state);}catch(e){notice('Ошибка '+s.name+': '+e.message);console.error('Bridge script:',s.name,e);report('script-warning',s.name+': '+(e.stack||e.message));}});}
var uiNodes=[];
function drawHud(){uiNodes.forEach(function(ent){if(ent.config.bind==='coins')ent.el.textContent=(ent.config.text||'Coins')+': '+state.coins;else if(ent.config.bind==='health'&&gameplay)ent.el.textContent=(ent.config.text||'HP')+': '+gameplay.state.health;else if(ent.config.bind==='inventory'&&economy)ent.el.textContent=(ent.config.text||'Рюкзак')+': '+Object.values(economy.snapshot().inventory).reduce(function(a,n){return a+n;},0);else if(ent.config.bind==='healthPercent'&&gameplay){var percentage=Math.max(0,Math.min(100,Math.round(100*gameplay.state.health/gameplay.state.maxHealth)));ent.el.textContent=(ent.config.text||'HP')+' '+percentage+'%';if(ent.config.type==='progress')ent.el.style.background='linear-gradient(90deg,#51e0a0 '+percentage+'%,#293948 '+percentage+'%)';}});var hp=document.getElementById('health');if(hp&&gameplay)hp.textContent='♥ '+gameplay.state.health+' / '+gameplay.state.maxHealth;var built=document.getElementById('defaultCoins');if(built)built.textContent='✦ '+state.coins;var objective=document.getElementById('objective');if(objective){var questList=quests?quests.list():[],pending=questList.find(function(q){return !q.claimed;}),done=questList.filter(function(q){return q.claimed;}).length;objective.textContent=(requiredCoins?'Собрано '+state.collected+' / '+requiredCoins:'Свободный режим')+(pending?' · '+pending.title+': '+pending.progress+'/'+pending.required+' [Q]':questList.length?' · Задания '+done+'/'+questList.length+' [Q]':'');
 var progressTrack=document.getElementById('questProgressTrack'),progressFill=document.getElementById('questProgressFill');
 if(progressTrack&&progressFill){
  // The first unclaimed quest is the active objective. Claiming switches to the
  // next task. Pure coin maps without quests get a backward-compatible fallback.
  var maximum=pending?pending.required:requiredCoins,current=pending?pending.progress:state.collected;
  if(maximum>0){current=Math.max(0,Math.min(current,maximum));progressTrack.hidden=false;progressTrack.setAttribute('aria-valuenow',String(current));progressTrack.setAttribute('aria-valuemax',String(maximum));progressTrack.setAttribute('aria-valuetext',(pending?pending.title:'Собрано')+': '+current+'/'+maximum);progressFill.style.width=(100*current/maximum).toFixed(1)+'%';progressTrack.classList.toggle('complete',current>=maximum);}
  else{progressTrack.hidden=true;progressFill.style.width='0%';progressTrack.classList.remove('complete');}
 }
}}
function gameWin(){if(state.won)return;if(requiredCoins&&state.collected<requiredCoins){notice('Сначала собери предметы: '+state.collected+'/'+requiredCoins);return;}state.won=true;notice('ПОБЕДА! Монет: '+state.coins);sfx('win');document.getElementById('win').hidden=false;runScripts('win',{coins:state.coins});if(gameplay)gameplay.emit('win','',{coins:state.coins});}
var api={addCoins:function(n){state.coins+=Math.max(0,Math.round(Number(n)||0));drawHud();saveProgress();},setCoins:function(n){state.coins=Math.max(0,Math.round(Number(n)||0));drawHud();saveProgress();},getCoins:function(){return state.coins;},message:notice,win:gameWin,reset:function(){restart();},teleport:function(x,y,z){player.position.set(+x||0,+y||0,+z||0);velocity=0;},setVisible:function(id,v){var q=gameObjects.find(function(o){return o.def.id===id;});if(q)q.mesh.visible=!!v;},getObject:function(id){return gameObjects.find(function(o){return o.def.id===id;})||null;}};
economy=window.BridgeEconomy.create(doc,{getCoins:function(){return state.coins;},setCoins:function(n){state.coins=Math.max(0,Math.floor(Number(n)||0));drawHud();saveProgress();},onChange:function(){drawHud();saveProgress();},onPurchase:function(id,n){if(quests)quests.record('buy',id,n);}});
quests=window.BridgeQuests.create(doc,{addCoins:function(n){api.addCoins(n);},grantItem:function(id,n){return economy.grant(id,n);},onChange:function(){drawHud();saveProgress();}});
function respawn(){standingOn=null;slideSpeed=0;player.position.fromArray(state.checkpoint||spawn);var terrainStart=window.BridgeTerrainCore.sampleHeight(doc.terrain,player.position.x,player.position.z);if(terrainStart!==null&&player.position.y<terrainStart+.2)player.position.y=terrainStart+.2;velocity=0;grounded=false;state.won=false;document.getElementById('win').hidden=true;if(gameplay)gameplay.respawn();drawHud();}
function restart(){state.checkpoint=null;state.coins=0;state.collected=0;if(economy)economy.reset();if(quests)quests.reset();closeGameOverlay();if(gameplay)gameplay.reset();gameObjects.forEach(function(q){if(q.def.action==='collect'||(q.def.components||[]).some(function(c){return c.type==='pickup';}))q.mesh.visible=true;if(q.doorOrigin){q.mesh.position.copy(q.doorOrigin);q.doorOpen=false;q.doorTarget=false;}});drawHud();respawn();saveProgress();}
function action(q,mode){if(!q||!q.mesh.visible)return;var d=q.def,a=d.action||'none';if(a==='win'&&state.won)return;if(['win','checkpoint','hazard'].includes(a)){var stamp=performance.now();if(stamp-(q.lastTouch||0)<900)return;q.lastTouch=stamp;}if(a==='collect'){q.mesh.visible=false;state.collected++;api.addCoins(d.value||1);sfx('coin');if(economy&&d.itemId)economy.grant(d.itemId,1);notice('+'+(d.value||1)+' ✦ '+d.name);runScripts('collect',{id:d.id,name:d.name,value:d.value||1});if(gameplay)gameplay.emit('collect',d.id,{value:d.value||1});saveProgress();}
else if(a==='win'){gameWin();}else if(a==='checkpoint'){state.checkpoint=d.position.slice();notice('Контрольная точка');}
else if(a==='hazard'){notice('Опасность!');respawn();}else if(a==='message'){notice(d.message||d.name);}
else if(a==='toggle'){var tgt=gameObjects.find(function(x){return x.def.id===d.target;});if(tgt){tgt.mesh.visible=!tgt.mesh.visible;notice(tgt.mesh.visible?'Объект открыт':'Объект скрыт');}}
else if(a==='teleport'){var t=gameObjects.find(function(x){return x.def.id===d.target;});if(t){player.position.copy(t.mesh.position);player.position.y+=.8;velocity=0;}}
if(mode!=='interact'){runScripts('interact',{id:d.id,name:d.name,action:a,value:d.value||0});if(gameplay)gameplay.emit('interact',d.id,{action:a});}}
function createObject(d){var grp=new T.Group(),p=d.position||[0,0,0],scale=d.scale||[1,1,1];grp.position.fromArray(p);grp.rotation.set.apply(grp.rotation,d.rotation||[0,0,0]);grp.scale.fromArray(scale);grp.userData.bridgeId=d.id;
var mat=gameMaterial(d);var mesh=null;
if(d.type==='coin'){mesh=new T.Mesh(new T.TorusGeometry(.42,.145,12,26),mat);mesh.rotation.x=Math.PI/2;mesh.castShadow=true;}
else if(d.type==='goal'){mesh=new T.Mesh(new T.TorusGeometry(.78,.12,12,32),mat);mesh.castShadow=true;}
else if(d.type==='spawn'){mesh=new T.Mesh(new T.CylinderGeometry(.45,.45,.12,24),mat);mesh.position.y=.06;if(!spawnSelected){spawn=[p[0],p[1]+.15,p[2]];spawnSelected=true;}}
else if(d.type==='npc'){mesh=new T.Group();var nb=new T.Mesh(new T.BoxGeometry(.67,1.03,.42),mat);nb.position.y=1.05;mesh.add(nb);var nh=new T.Mesh(new T.SphereGeometry(.28,12,10),new T.MeshStandardMaterial({color:0xf1c6a3}));nh.position.y=1.81;mesh.add(nh);var npcLegs=[];for(var ix of [-1,1]){var nl=new T.Mesh(new T.BoxGeometry(.22,.57,.28),new T.MeshStandardMaterial({color:0x2a354c}));nl.position.set(ix*.18,.31,0);mesh.add(nl);npcLegs.push(nl);}grp.userData.npcLegs=npcLegs;}
else if(d.type==='glb'){mesh=null;}
else{mesh=new T.Mesh(new T.BoxGeometry(1,1,1),mat);mesh.castShadow=true;mesh.receiveShadow=true;}
if(mesh)grp.add(mesh);scene.add(grp);var q={def:d,mesh:grp};gameObjects.push(q);if(['ground','block','movingPlatform'].includes(d.type)&&d.solid!==false)colliders.push(q);if((d.action&&d.action!=='none')||(d.components||[]).length||(doc.graphs||[]).some(function(g){return g.source===d.id&&(g.event==='interact'||g.event==='touch');})||(doc.quests||[]).some(function(qt){return qt.source===d.id&&qt.event==='interact';}))triggerObjs.push(q);
var door=(d.components||[]).find(function(c){return c.type==='door'&&c.enabled!==false;});if(door){q.doorOrigin=grp.position.clone();q.doorOpen=false;q.doorTarget=false;q.doorHeight=Math.max(.75,Number(door.openHeight)||3);}
var moving=(d.components||[]).find(function(c){return c.type==='movingPlatform'&&c.enabled!==false;});if(moving)q.motion={origin:grp.position.clone(),offset:Array.isArray(moving.offset)?moving.offset:[3,0,0],period:Math.max(.6,Number(moving.period)||4)};
var npc=(d.components||[]).find(function(c){return c.type==='npc'&&c.enabled!==false;});if(npc)q.npcMotion={origin:grp.position.clone(),distance:Number(npc.patrolDistance)||0,period:Math.max(1,Number(npc.period)||5)};
if(d.type==='glb'&&gameAsset(d)){try{var x=decodeGlb(bytesFromB64(gameAsset(d)));parseData(x.json,x.bin).then(function(result){decorateGameGlb(result.object,d);grp.add(result.object);}).catch(function(e){notice('GLB '+d.name+': '+e.message);});}catch(e){notice(e.message);}}
return q;}
(doc.objects||[]).forEach(createObject);
function objectById(target){return gameObjects.find(function(o){return o.def.id===target;});}
function toggleDoor(target,mode){var q=objectById(target);if(!q)return false;if(q.doorOrigin){q.doorTarget=mode==='open'?true:mode==='close'?false:!q.doorTarget;notice(q.doorTarget?'Дверь открывается':'Дверь закрывается');return true;}q.mesh.visible=mode==='hide'?false:mode==='show'?true:!q.mesh.visible;return true;}
gameplay=window.BridgeGameplayCore.create(doc,{
 message:notice,addCoins:function(n){api.addCoins(n);},getCoins:function(){return state.coins;},onEvent:function(event,source){if(event==='collect'){if(quests)quests.record('collect',source,1);saveProgress();}},
 teleportTo:function(target){var q=objectById(target);if(q){player.position.copy(q.mesh.position);player.position.y+=.85;velocity=0;grounded=false;}else notice('Нет точки телепорта: '+target);},
 toggleDoor:toggleDoor,setVisible:function(target,v){api.setVisible(target,v);},
 setCheckpoint:function(target){var q=objectById(target);if(q)state.checkpoint=[q.mesh.position.x,q.mesh.position.y+.3,q.mesh.position.z];},
 healthChange:function(h){if(h<gameplay.state.maxHealth)sfx('hurt');drawHud();},dead:function(){notice('Здоровье закончилось · Возрождение');respawn();},
 win:gameWin,restart:restart,warn:function(s){console.warn('Visual Logic:',s);report('script-warning',s);}
});
loadProgress();respawn();
function buildHud(){(doc.ui||[]).forEach(function(u){var tag=u.type==='button'?'button':'div',el=document.createElement(tag);el.className='custom-ui '+(u.type==='button'?'ui-button':'ui-label');el.style.left=(+u.x||0)+'%';el.style.top=(+u.y||0)+'%';el.style.width=(+u.width||160)+'px';el.style.height=(+u.height||36)+'px';el.style.color=u.color||'#ffffff';el.style.fontSize=(+u.fontSize||16)+'px';if(u.bgColor)el.style.backgroundColor=u.bgColor;if(u.type==='panel'){el.style.minHeight='48px';el.style.borderRadius='12px';}if(u.type==='progress'){el.style.borderRadius='9px';el.style.fontWeight='bold';el.style.background='linear-gradient(90deg,#51e0a0 100%,#293948 100%)';}el.textContent=u.text||'UI';el.title=u.name||'';hud.appendChild(el);uiNodes.push({el:el,config:u});if(u.type==='button')el.onclick=function(){if(gameplay)gameplay.emit('ui',u.id,{action:u.action});if(u.action==='coins')api.addCoins(u.value||1);else if(u.action==='jump'&&grounded){velocity=jumpPower;grounded=false;}else if(u.action==='win')gameWin();else if(u.action==='reset')restart();else if(u.action==='message')notice(u.message||u.text);else if(u.action==='inventory')showGameOverlay('inventory');else if(u.action==='quests')showGameOverlay('quests');else if(u.action==='shop')showGameOverlay('shop');else if(u.action==='buy'||u.action==='giveItem'){var result=economy&&(u.action==='buy'?economy.buy(u.itemId,u.value||1):economy.grant(u.itemId,u.value||1));if(result&&result.ok){notice('Получен предмет: '+result.item.name);sfx('buy');}else notice(result&&result.error||'Предмет не найден');}runScripts('ui',{id:u.id,name:u.name,action:u.action,itemId:u.itemId||''});};});drawHud();}

buildHud();
// One explicit action route. Legacy collect/pickup defaults to E, unless touch is selected.
function actionMode(d){
 return d.actionActivation==='touch'||d.actionActivation==='interact'?d.actionActivation:
  (['win','hazard','checkpoint'].includes(d.action)?'touch':'interact');
}
function componentMode(c){
 return c.activation||(c.type==='door'||c.type==='npc'||c.type==='teleporter'||c.type==='pickup'?'interact':'touch');
}
function isInteractable(q){
 if(!q||!q.mesh.visible)return false;
 var d=q.def;
 if(d.action&&d.action!=='none'&&actionMode(d)==='interact')return true;
 if((d.components||[]).some(function(c){return c.enabled!==false&&componentMode(c)==='interact';}))return true;
 if((doc.graphs||[]).some(function(g){return g&&g.enabled!==false&&g.event==='interact'&&(g.source==='*'||g.source===d.id);}))return true;
 return !!(quests&&quests.list().some(function(x){return x.event==='interact'&&!x.claimed&&x.source===d.id&&x.progress<x.required;}));
}
function interactiveDistance(q){var dx=q.mesh.position.x-player.position.x,dz=q.mesh.position.z-player.position.z,dy=q.mesh.position.y-player.position.y;return Math.hypot(dx,dz,dy*.65);}
function isPendingQuestTarget(q){
 return !!(quests&&quests.list().some(function(x){return x.event==='interact'&&x.source===q.def.id&&!x.claimed&&x.progress<x.required;}));
}
function nearestInteraction(){
 return triggerObjs.filter(function(q){return isInteractable(q)&&interactiveDistance(q)<2.85;})
  .sort(function(a,b){
   var aQuest=isPendingQuestTarget(a),bQuest=isPendingQuestTarget(b);
   if(aQuest!==bQuest)return aQuest?-1:1;
   return interactiveDistance(a)-interactiveDistance(b);
  })[0]||null;
}
function interactWith(q){
 if(uiOverlay||!isInteractable(q)||interactiveDistance(q)>=2.85)return false;
 var d=q.def,a=d.action||'none';
 if(a!=='none'&&actionMode(d)==='interact')action(q,'interact');
 runScripts('interact',{id:d.id,name:d.name,action:a,value:d.value||0});
 if(gameplay)gameplay.interact(d.id,performance.now());
 if(quests)quests.record('interact',d.id,1);
 drawHud();return true;
}
function updateInteractionHint(){
 var hint=document.getElementById('interactPrompt'),q=uiOverlay?null:nearestInteraction();
 if(!hint)return;
 hint.style.display=q?'block':'none';
 if(!q)return;
 var task=quests&&quests.list().find(function(v){return v.event==='interact'&&v.source===q.def.id&&!v.claimed;});
 hint.textContent='[E] '+(q.def.action==='collect'?'Подобрать ':task?'Задание · ':'')+(q.def.name||'Объект')+(task?' · '+task.progress+'/'+task.required:'');
 hint.style.borderColor=task?'#e5b85a':'#5bcad8';
}
var cv=renderer.domElement;cv.tabIndex=0;cv.addEventListener('pointerdown',function(e){cv.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,moved:false};cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-drag.x;if(Math.abs(dx)>1||Math.abs(e.clientY-drag.y)>1)drag.moved=true;yaw+=dx*.004;camPitch=Math.max(-.18,Math.min(1.15,camPitch+(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;});cv.addEventListener('pointerup',function(e){if(!drag)return;var wasMoved=drag.moved;drag=null;if(wasMoved)return;var r=cv.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);var hit=ray.intersectObjects(gameObjects.map(function(q){return q.mesh;}),true).filter(function(h){return h.object.userData.bridgeId||h.object.parent;})[0];if(hit){var node=hit.object;while(node&&!node.userData.bridgeId)node=node.parent;var q=gameObjects.find(function(x){return node&&x.def.id===node.userData.bridgeId;});if(q)interactWith(q);}});
// Physical key codes work with Russian / non-Latin keyboard layouts.
// Keep the same canonical key names for both direct iframe input and parent postMessage.
var gameKeyCodeMap={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyE:'e',KeyQ:'q',KeyV:'v',KeyI:'i',KeyB:'b',Escape:'Escape',Space:' ',ShiftLeft:'shift',ShiftRight:'shift',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright'};
function gameKey(e){return gameKeyCodeMap[e.code]||String(e.key||'').toLowerCase();}
window.addEventListener('keydown',function(e){var k=gameKey(e);keys[k]=true;if(['w','a','s','d',' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='i'&&!e.repeat){uiOverlay?closeGameOverlay():showGameOverlay('inventory');}if(k==='b'&&!e.repeat){uiOverlay?closeGameOverlay():showGameOverlay('shop');}if(k==='q'&&!e.repeat){uiOverlay?closeGameOverlay():showGameOverlay('quests');}if(k==='Escape'&&uiOverlay)closeGameOverlay();if(k==='v'&&!e.repeat){firstPerson=!firstPerson;notice(firstPerson?'Камера от первого лица':'Камера от третьего лица');}if(k==='e'&&!e.repeat&&!uiOverlay){var target=nearestInteraction();if(target)interactWith(target);else notice('Рядом нет доступного действия. Подойди к кнопке или предмету.');}});
window.addEventListener('keyup',function(e){keys[gameKey(e)]=false;});
window.addEventListener('blur',function(){keys={};});
window.addEventListener('message',function(e){if(e.source!==window.parent||!e.data)return;var d=e.data;if(d.bridgeInput==='key'&&typeof d.key==='string'){keys[d.key]=!!d.down;}else if(d.bridgeInput==='clear'){keys={};}});
window.__bridgeDebugState=function(){return {position:[player.position.x,player.position.y,player.position.z],keys:Object.keys(keys).filter(function(k){return !!keys[k];}),grounded:grounded,yaw:yaw,playerYaw:player.rotation.y,playerForward:[-Math.sin(player.rotation.y),-Math.cos(player.rotation.y)],coins:state.coins,collected:state.collected,environment:environment,renderExposure:renderer.toneMappingExposure,sunPosition:[sun.position.x,sun.position.y,sun.position.z],health:gameplay&&gameplay.state.health,checkpointId:gameplay&&gameplay.state.checkpointId,flags:gameplay&&gameplay.state.flags,counters:gameplay&&gameplay.state.counters,graphTrace:gameplay&&gameplay.trace(),firstPerson:firstPerson,doorStates:gameObjects.filter(function(q){return !!q.doorOrigin;}).map(function(q){return {id:q.def.id,open:q.doorOpen,y:q.mesh.position.y};}),inventory:economy&&economy.snapshot(),quests:quests&&quests.snapshot(),saveEnabled:saveEnabled,saveAvailable:saveAvailable,overlay:uiOverlay&&uiOverlay.id,firstDt:firstDelta,minTerrainClearance:minTerrainClearance===Infinity?null:minTerrainClearance,terrainChunks:terrainMeshes.length,terrainY:window.BridgeTerrainCore.sampleHeight(doc.terrain,player.position.x,player.position.z),terrainSlope:((window.BridgeTerrainCore.sampleSurface(doc.terrain,player.position.x,player.position.z)||{}).slopeDeg??null),maxWalkableSlopeDeg:maxWalkableSlopeDeg,slideSlopeDeg:slideSlopeDeg,slideSpeed:slideSpeed,objects:gameObjects.length,glbInstances:gameObjects.filter(function(q){return q.def.type==='glb';}).length,embeddedAssets:(doc.assets||[]).length,embeddedTextures:(doc.textures||[]).length,interactionTarget:(nearestInteraction()||{def:{}}).def.id||null};};
window.__bridgeEconomyQA={grantCoins:function(n){api.addCoins(n);return state.coins;},inventory:function(){return economy.snapshot();}};
function resize(){var w=root.clientWidth,h=root.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();var prev=performance.now(),firstDelta=null;
var fatalRenderFailure=false;function frame(now){if(fatalRenderFailure)return;requestAnimationFrame(frame);var dt=Math.max(0,Math.min(.05,(now-prev)/1000));if(firstDelta===null)firstDelta=dt;prev=now;elapsed+=dt;
// Move dynamic collision surfaces before resolving player physics.
gameObjects.forEach(function(q){if(q.motion){var old=q.mesh.position.clone(),phase=(1-Math.cos(elapsed*2*Math.PI/q.motion.period))/2;q.mesh.position.set(q.motion.origin.x+q.motion.offset[0]*phase,q.motion.origin.y+q.motion.offset[1]*phase,q.motion.origin.z+q.motion.offset[2]*phase);q.motionDelta=q.mesh.position.clone().sub(old);}if(q.npcMotion&&q.npcMotion.distance){q.mesh.position.x=q.npcMotion.origin.x+Math.sin(elapsed*2*Math.PI/q.npcMotion.period)*q.npcMotion.distance;}if(q.mesh.userData.npcLegs){q.mesh.userData.npcLegs.forEach(function(leg,i){leg.position.z=(i?1:-1)*Math.sin(elapsed*7)*.14;});}if(q.doorOrigin){var targetY=q.doorOrigin.y+(q.doorTarget?q.doorHeight:0);q.mesh.position.y+=(targetY-q.mesh.position.y)*Math.min(1,dt*5);q.doorOpen=q.mesh.position.y>q.doorOrigin.y+.8;}});
if(standingOn&&standingOn.motion&&standingOn.motionDelta)player.position.add(standingOn.motionDelta);
var mx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),mz=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);var m=Math.hypot(mx,mz)||1;mx/=m;mz/=m;var speed=moveSpeed*(keys.shift?1.55:1);var xx=(Math.cos(yaw)*mx-Math.sin(yaw)*mz)*speed*dt,zz=(Math.sin(yaw)*mx+Math.cos(yaw)*mz)*speed*dt;
function blocksAt(px,pz,feet){for(var bi=0;bi<colliders.length;bi++){var bq=colliders[bi];if(!['block','movingPlatform'].includes(bq.def.type)||!bq.mesh.visible||bq.doorOpen)continue;var bounds=new T.Box3().setFromObject(bq.mesh);if(feet+1.65>bounds.min.y+.04&&feet<bounds.max.y-.03&&px>bounds.min.x-.27&&px<bounds.max.x+.27&&pz>bounds.min.z-.27&&pz<bounds.max.z+.27)return true;}return false;}
var steepContact=window.BridgeTerrainCore.sampleSurface(doc.terrain,player.position.x,player.position.z);
if(steepContact&&steepContact.slopeDeg>slideSlopeDeg+1e-4&&Math.abs(player.position.y-steepContact.height)<=.18&&velocity<=0){
 // Gentle downhill drift near the threshold; maximum 1.8 units/s versus 7 previously.
 var excess=Math.min(1,Math.max(0,(steepContact.slopeDeg-slideSlopeDeg)/30));
 slideSpeed=Math.min(1.8,slideSpeed+2.8*excess*dt);
 var slid=window.BridgeTerrainCore.slideHeightfield(doc.terrain,player.position.x,player.position.z,player.position.y,slideSpeed,dt,blocksAt,slideSlopeDeg);
 if(slid.sliding)player.position.set(slid.x,slid.y,slid.z);
}else slideSpeed=0;
var walked=window.BridgeTerrainCore.walkHeightfield(doc.terrain,player.position.x,player.position.z,player.position.y,xx,zz,grounded&&!standingOn&&!keys[' '],blocksAt,maxWalkableSlopeDeg);
player.position.x=walked.x;player.position.z=walked.z;player.position.y=walked.y;// Camera yaw is positive when looking to +X, while THREE Object3D +Y rotation
// sends a -Z-facing character toward -X. Derive heading from the WORLD move vector.
// Smoothing uses the shortest angular path, avoiding 360-degree turns at +/-PI.
if(mx||mz){var heading=Math.atan2(-xx,-zz);var deltaHeading=Math.atan2(Math.sin(heading-player.rotation.y),Math.cos(heading-player.rotation.y));player.rotation.y+=deltaHeading*Math.min(1,dt*15);}var groundedBefore=grounded;if(keys[' ']&&grounded){velocity=jumpPower;grounded=false;}prevY=player.position.y;velocity-=19*dt;player.position.y+=velocity*dt;grounded=false;standingOn=null;
for(var i=0;i<colliders.length;i++){var q=colliders[i];if(!q.mesh.visible)continue;var box=new T.Box3().setFromObject(q.mesh);var top=box.max.y;if(player.position.x>box.min.x-.24&&player.position.x<box.max.x+.24&&player.position.z>box.min.z-.23&&player.position.z<box.max.z+.23&&prevY>=top-.12&&player.position.y<=top&&velocity<=0){player.position.y=top;velocity=0;grounded=true;standingOn=q;}}
// Horizontal sweep already rejects walls above the player's feet. When falling,
// clamp to the exact triangles even if the player moved onto a newly sculpted
// height discontinuity during a slow frame. The old prevY threshold let this
// collision be skipped forever, causing falls through visible terrain.
var terrainInfo=window.BridgeTerrainCore.sampleSurface(doc.terrain,player.position.x,player.position.z),terrainTop=terrainInfo?terrainInfo.height:null;if(terrainTop!==null&&velocity<=0&&player.position.y<=terrainTop){player.position.y=terrainTop;velocity=0;grounded=terrainInfo.slopeDeg<=maxWalkableSlopeDeg+1e-4;standingOn=null;}
if(terrainTop!==null)minTerrainClearance=Math.min(minTerrainClearance,player.position.y-terrainTop);
if(player.position.y< -18)respawn();
var contacts=[];triggerObjs.forEach(function(q){if(!q.mesh.visible)return;var dx=q.mesh.position.x-player.position.x,dz=q.mesh.position.z-player.position.z,dy=Math.abs(q.mesh.position.y-player.position.y);var near=Math.hypot(dx,dz)<(q.def.type==='coin'?1.05:1.5)&&dy<2.3;if(near){contacts.push(q.def.id);if(['collect','hazard','win','checkpoint'].includes(q.def.action)&&actionMode(q.def)==='touch')action(q,'touch');}if(q.def.type==='coin')q.mesh.rotation.y+=dt*1.2;});if(gameplay){gameplay.updateContacts(contacts,now);gameplay.tick(dt);}updateInteractionHint();
var walk=Math.min(1,Math.hypot(mx,mz));legs.forEach(function(leg,i){leg.position.z=(i?1:-1)*Math.sin(elapsed*(keys.shift?15:10))*.19*walk;});arms.forEach(function(arm,i){arm.position.z=(i?1:-1)*Math.sin(elapsed*(keys.shift?15:10))*.09*walk;});
var camOffset=firstPerson?new T.Vector3(0,1.65,0):new T.Vector3(-Math.sin(yaw)*Math.cos(camPitch)*6,2.05+Math.sin(camPitch)*6,Math.cos(yaw)*Math.cos(camPitch)*6);
camera.position.lerp(player.position.clone().add(camOffset),Math.min(1,dt*8));if(firstPerson){camera.lookAt(player.position.x+Math.sin(yaw)*5,player.position.y+1.65-Math.sin(camPitch)*5,player.position.z-Math.cos(yaw)*5);player.visible=false;}else{camera.lookAt(player.position.x,player.position.y+1.05,player.position.z);player.visible=true;}try{renderer.render(scene,camera);if(!frame._rendered){frame._rendered=true;report('ready','Первый 3D-кадр отрисован');var boot=document.getElementById('bootIndicator');if(boot)boot.style.display='none';}}catch(err){var boot=document.getElementById('bootIndicator');if(boot){boot.style.display='grid';boot.textContent='Ошибка отрисовки: '+err.message;}fatalRenderFailure=true;report('error','Ошибка отрисовки: '+(err.stack||err.message));console.error(err);}}
requestAnimationFrame(frame);if(gameplay)gameplay.emit('start','',{name:doc.name});runScripts('start',{name:doc.name});notice('WASD — ходьба · E — взаимодействие и монеты · Q — задания'+((doc.quests||[]).length?' · Квестовая кнопка у Spawn':'')+' · I/B — сумка/магазин');
document.getElementById('retry').onclick=function(){restart();};
})();
