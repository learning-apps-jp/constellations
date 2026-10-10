const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),buttons=[];
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
function element(id){if(!elements.has(id))elements.set(id,{value:'',checked:['lines'].includes(id),hidden:false,textContent:'',children:[],getBoundingClientRect:()=>({width:550,height:320}),getContext:()=>ctx,setAttribute(){},append(x){this.children.push(x)},replaceChildren(){this.children=[]}});return elements.get(id)}
for(const mode of ['year','day'])buttons.push({...element(mode),dataset:{mode}});
for(const direction of ['south','north'])buttons.push({...element(direction),dataset:{direction}});
const sandbox={console,Math,Date,devicePixelRatio:1,setInterval(){},document:{getElementById:element,createElement:()=>({...element('new'),children:[]}),querySelectorAll:s=>s==='[data-mode]'?buttons.filter(b=>b.dataset.mode):s==='[data-direction]'?buttons.filter(b=>b.dataset.direction):element('answers').children,addEventListener(){}},window:{addEventListener(){}}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('stars.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);
vm.runInContext(`
 const assert=(condition,message)=>{if(!condition)throw new Error(message)};
 assert(Math.abs(horizontal(2.53,89.264).alt-35.7)<1,'北極星の高度');
 const south1=horizontal(5.9195,7.407,14,1140),south2=horizontal(5.9195,7.407,14,1260);
 assert(south1.az<south2.az,'南天の星が西へ動く');
 const delta=wrap(lst(45,1260)-lst(14,1260));assert(delta>29&&delta<32,'1か月の恒星時差');
 assert(horizontal(sun(172,720).ra,sun(172,720).dec,172,720).alt>70,'夏の正午の太陽');
 assert(horizontal(sun(172,0).ra,sun(172,0).dec,172,0).alt<0,'真夜中の太陽');
 assert(nextMonth(30)===58,'1月31日の翌月は2月28日');assert(nextMonth(364)===395,'12月31日の翌月は2027年1月31日');
 setMode('day');assert(state.mode==='day'&&state.time===1140,'日周モード');
 $('step').onclick();assert(state.time===1200,'1時間ステップ');
 $('trail').checked=true;render();$('compare').checked=true;render();
 state.day=14;state.time=1410;advanceMinutes(60);assert(state.day===15&&state.time===30,'真夜中は翌日に進む');
 assert(!groups.find(g=>g.name==='おとめ座').hr.includes(4626),'誤座標の恒星を除外');
 assert(new Set(groups.find(g=>g.name==='おおいぬ座').hr).size===5,'恒星の重複を除去');
 assert(groups.find(g=>g.name.startsWith('秋の')).hr.includes(15),'秋の四辺形にAlpha Andromedae');
 assert(STAR_DATA.stars.length===905,'実在星表だけを使用');
 const east=horizontal(wrap(lst()+90)/15,0),west=horizontal(wrap(lst()-90)/15,0);
 assert(Math.abs(east.az-90)<.00001&&Math.abs(west.az-270)<.00001,'東西の方位の符号');
 state.direction='south';assert(project({alt:10,az:90},500,300).x<250,'南向きの東は左');
 state.direction='north';assert(project({alt:10,az:90},500,300).x>250,'北向きの東は右');
 state.day=348;state.time=1260;state.mode='year';advanceDate();render();assert(state.day===348&&$('step').disabled,'1か月進めるを年末で無効化');
 state.day=14;state.time=720;assert(!canShowStars(),'昼は通常星を省略');$('virtual').checked=true;assert(canShowStars(),'仮想表示の明示的選択');
 setDirection('north');render();$('reset').onclick();assert(state.mode==='day'&&state.day===14&&state.target==='オリオン座','リセット');
 console.log('PASS: celestial coordinates, real-star catalogue, month/year boundaries, midnight, daylight, rendering, simple modes, reset');
`,sandbox);
assert.equal(element('target').children.length,13);
if(fs.existsSync('audit/jpl-sun-reference.json')){
 const reference=JSON.parse(fs.readFileSync('audit/jpl-sun-reference.json','utf8'));
 const rows=reference.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
 assert.equal(rows.length,reference.samples.length);
 const results=rows.map((row,i)=>{
  const fields=row.split(','),refAz=+fields[5],refAlt=+fields[6],sample=reference.samples[i];
  const value=vm.runInContext(`horizontal(sun(${sample.day},${sample.time}).ra,sun(${sample.day},${sample.time}).dec,${sample.day},${sample.time})`,sandbox);
  const altitudeError=Math.abs(value.alt-refAlt),azimuthError=Math.abs((value.az-refAz+540)%360-180);
  assert.ok(altitudeError<.05,'JPL solar altitude discrepancy');assert.ok(azimuthError<.05,'JPL solar azimuth discrepancy');
  return {...sample,reference:{alt:refAlt,az:refAz},app:value,altitudeError,azimuthError};
 });
 const summary={count:results.length,maxAltitudeErrorDeg:Math.max(...results.map(r=>r.altitudeError)),maxAzimuthErrorDeg:Math.max(...results.map(r=>r.azimuthError)),reference:'NASA JPL Horizons, Sun, Tokyo 139.7 E / 35.7 N, AIRLESS, 72 samples in 2026',note:'Solar verification only. Not an all-stars or all-dates error guarantee.',results};
 fs.writeFileSync('audit/solar-verification.json',JSON.stringify(summary,null,2));
 console.log('JPL 72 samples: max altitude error '+summary.maxAltitudeErrorDeg.toFixed(5)+' deg; max azimuth error '+summary.maxAzimuthErrorDeg.toFixed(5)+' deg');
}
if(fs.existsSync('audit/erfa-star-reference.json')){
 const reference=JSON.parse(fs.readFileSync('audit/erfa-star-reference.json','utf8'));
 sandbox.referenceSamples=reference.samples;
 const summary=vm.runInContext(`(()=>{
  let count=0,maxSeparation=0,maxAltitude=0,worst=null;
  for(const sample of referenceSamples)for(const [hr,alt,az] of sample.positions){
   const p=starHorizontal(byHR.get(hr),sample.day,sample.time);
   const cosine=Math.sin(rad(alt))*Math.sin(rad(p.alt))+Math.cos(rad(alt))*Math.cos(rad(p.alt))*Math.cos(rad(p.az-az));
   const separation=deg(Math.acos(Math.max(-1,Math.min(1,cosine))));
   count++;maxAltitude=Math.max(maxAltitude,Math.abs(alt-p.alt));
   if(separation>maxSeparation){maxSeparation=separation;worst={hr,day:sample.day,time:sample.time,app:p,reference:{alt,az}}}
  }
  return {count,maxAngularSeparationDeg:maxSeparation,maxAltitudeErrorDeg:maxAltitude,worst};
 })()`,sandbox);
 assert.ok(summary.maxAngularSeparationDeg<.03,'SOFA observed-star direction discrepancy');
 fs.writeFileSync('audit/star-verification.json',JSON.stringify({...summary,source:reference.source,conditions:reference.conditions,note:'905 stars at 16 times in 2026. Sample verification is not a guarantee for all dates or physical visibility.'},null,2));
 console.log('SOFA-derived '+summary.count+' star positions: max directional error '+summary.maxAngularSeparationDeg.toFixed(5)+' deg; max altitude error '+summary.maxAltitudeErrorDeg.toFixed(5)+' deg');
}

vm.runInContext(`setMode('year');if(state.time!==1260||!$('timeControl').hidden||$('dateControl').hidden)throw new Error('季節モードは21時固定・日付のみ');setMode('day');if($('timeControl').hidden||!$('dateControl').hidden)throw new Error('一晩モードは時刻のみ');`,sandbox);
assert.ok(!fs.readFileSync('index.html','utf8').includes('学習チャレンジ'));
assert.ok(!fs.readFileSync('app.js','utf8').includes('recordObservation'));
console.log('PASS: single-slider modes, fixed 21:00, challenge and records removed');
vm.runInContext(`
 const sizes=[[1100,460],[330,360]];state.direction='south';
 for(const day of [14,104,195,287])for(const time of [0,720,1260])for(const group of groups)for(const star of group.stars){
  const position=starHorizontal(star,day,time),a=project(position,...sizes[0]),b=project(position,...sizes[1]),ga=skyGeometry(...sizes[0]),gb=skyGeometry(...sizes[1]);
  if(a.visible!==b.visible||Math.abs((a.x-ga.cx)/ga.r-(b.x-gb.cx)/gb.r)>1e-12||Math.abs((a.y-ga.cy)/ga.r-(b.y-gb.cy)/gb.r)>1e-12)throw new Error('画面比率による形の変化');
  if(a.visible&&Math.hypot(a.x-ga.cx,a.y-ga.cy)>ga.r+1e-8)throw new Error('地平線内への投影');
 }
 for(const alt of [0,30,60,89])for(const az of [0,90,180,270]){
  const epsilon=1e-5,p=project({alt,az},1100,460),u=project({alt:alt+epsilon,az},1100,460),v=project({alt,az:az+epsilon/Math.cos(rad(alt))},1100,460);
  const ux=u.x-p.x,uy=u.y-p.y,vx=v.x-p.x,vy=v.y-p.y;
  if(Math.abs(Math.hypot(ux,uy)/Math.hypot(vx,vy)-1)>1e-4||Math.abs((ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))>1e-4)throw new Error('局所角度・縦横縮尺');
 }
 const zenith=project({alt:90,az:123},1100,460),geo=skyGeometry(1100,460);if(Math.hypot(zenith.x-geo.cx,zenith.y-geo.cy)>1e-8)throw new Error('真上が中心');
 console.log('PASS: all 13 constellation groups at 12 times retain shape across desktop/mobile; conformality, horizon and zenith');
`,sandbox);
