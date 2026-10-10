'use strict';
const $=id=>document.getElementById(id), TAU=Math.PI*2;
const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI, wrap=(v,n=360)=>(v%n+n)%n;
const byHR=new Map(STAR_DATA.stars.map(s=>[s.hr,s]));
const groups=STAR_DATA.groups.map(g=>({...g,stars:g.hr.map(hr=>byHR.get(hr))}));
const references=[{name:'おうし座',star:'アルデバラン',hr:1457,day:14,season:'冬'},{name:'しし座',star:'レグルス',hr:3982,day:104,season:'春'},{name:'さそり座',star:'アンタレス',hr:6134,day:195,season:'夏'},{name:'秋の四辺形とペガスス座',label:'秋の四辺形',star:'マルカブ',hr:8781,day:287,season:'秋'}];

const state={day:14,time:1140,mode:'day',direction:'south',target:'オリオン座',playing:false};
const base=Date.UTC(2026,0,1), latitude=rad(35.7), longitude=139.7;
function instant(day=state.day,time=state.time){return base+day*86400000+(time-540)*60000}
function julian(day=state.day,time=state.time){return instant(day,time)/86400000+2440587.5}
function lst(day=state.day,time=state.time){const d=julian(day,time)-2451545,t=d/36525;return wrap(280.46061837+360.98564736629*d+longitude+0.000387933*t*t-t*t*t/38710000)}
// Geometric altitude; north=0, east=90. Refraction is deliberately excluded.
function horizontal(ra,dec,day=state.day,time=state.time){
 const H=rad(wrap(lst(day,time)-ra*15+180)-180),d=rad(dec);
 const alt=Math.asin(Math.sin(latitude)*Math.sin(d)+Math.cos(latitude)*Math.cos(d)*Math.cos(H));
 const az=wrap(deg(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(latitude)-Math.tan(d)*Math.cos(latitude)))+180);
 return {alt:deg(alt),az};
}
// BSC pmRA is mu_alpha*cos(delta), arcsec/year. IAU 1976 precession, J2000->date.
function starEquatorial(s,day=state.day,time=state.time){
 const t=(julian(day,time)-2451545)/36525,years=t*100;
 const a=rad(s.ra*15+s.pmra*years/(3600*Math.cos(rad(s.dec)))),d=rad(s.dec+s.pmdec*years/3600);
 const zeta=rad((2306.2181*t+0.30188*t*t+0.017998*t*t*t)/3600);
 const z=rad((2306.2181*t+1.09468*t*t+0.018203*t*t*t)/3600);
 const theta=rad((2004.3109*t-0.42665*t*t-0.041833*t*t*t)/3600);
 const A=Math.cos(d)*Math.sin(a+zeta),B=Math.cos(theta)*Math.cos(d)*Math.cos(a+zeta)-Math.sin(theta)*Math.sin(d);
 const C=Math.sin(theta)*Math.cos(d)*Math.cos(a+zeta)+Math.cos(theta)*Math.sin(d);
 return {ra:wrap(deg(Math.atan2(A,B)+z))/15,dec:deg(Math.asin(Math.max(-1,Math.min(1,C))))};
}
function starHorizontal(s,day=state.day,time=state.time){const p=starEquatorial(s,day,time);return horizontal(p.ra,p.dec,day,time)}
// US Naval Observatory's approximate solar-coordinate algorithm.
function sun(day=state.day,time=state.time){const n=julian(day,time)-2451545,g=rad(wrap(357.529+0.98560028*n)),L=rad(wrap(280.459+0.98564736*n+1.915*Math.sin(g)+0.02*Math.sin(2*g))),e=rad(23.439-0.00000036*n);return {lon:L,obliquity:e,ra:wrap(deg(Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))))/15,dec:deg(Math.asin(Math.sin(e)*Math.sin(L)))}}
function sunAltitude(day=state.day,time=state.time){const s=sun(day,time);return horizontal(s.ra,s.dec,day,time).alt}
function dateText(day=state.day,includeYear=false){return new Date(base+day*86400000).toLocaleDateString('ja-JP',{timeZone:'UTC',...(includeYear?{year:'numeric'}:{}),month:'long',day:'numeric'})}
function timeText(time=state.time){return `${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`}
function nextMonth(day=state.day){const d=new Date(base+day*86400000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,date=d.getUTCDate(),end=new Date(Date.UTC(y,m+1,0)).getUTCDate();return Math.round((Date.UTC(y,m,Math.min(date,end))-base)/86400000)}
function observationKind(){return state.mode}
function advanceMinutes(minutes){const total=state.time+minutes,nextDay=state.day+Math.floor(total/1440);if(nextDay>364){state.day=364;state.time=1430;stop();return}state.day=nextDay;state.time=wrap(total,1440)}
function advanceDate(){const next=nextMonth();if(next<=364)state.day=next;else stop()}
function setupCanvas(id){const canvas=$(id),rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);return {c,w:rect.width,h:rect.height}}
function text(c,s,x,y,color='#647687',size=11,align='center'){c.fillStyle=color;c.font=`${size}px "Noto Sans JP", sans-serif`;c.textAlign=align;c.fillText(s,x,y)}
function line(c,x,y,x2,y2,color,width=1,dash=[]){c.beginPath();c.setLineDash(dash);c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();c.setLineDash([])}
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill()}
// Halos emphasize catalogue stars at their exact computed centres; no decorative stars.
function stellarDot(c,x,y,r,mag,active=false,light=false){
 if(mag<2||active){const radius=active?6:7,halo=c.createRadialGradient(x,y,0,x,y,radius);halo.addColorStop(0,active?'#86ffe573':'#d2e8ff4d');halo.addColorStop(1,active?'#86ffe500':'#d2e8ff00');circle(c,x,y,radius,halo)}
 circle(c,x,y,r,active?'#b4fff0':light?'#e3ecf890':'#edf5ff');
 if(mag<1.3&&!light){line(c,x-r-2,y,x+r+2,y,active?'#b4fff044':'#e0efff33',.6);line(c,x,y-r-2,x,y+r+2,active?'#b4fff044':'#e0efff33',.6)}
}
function arrow(c,x,y,x2,y2,color){line(c,x,y,x2,y2,color,1.7);const a=Math.atan2(y2-y,x2-x);c.beginPath();c.moveTo(x2,y2);c.lineTo(x2-9*Math.cos(a-.4),y2-9*Math.sin(a-.4));c.lineTo(x2-9*Math.cos(a+.4),y2-9*Math.sin(a+.4));c.closePath();c.fillStyle=color;c.fill()}
function eclipticLongitude(star){const p=starEquatorial(star),a=rad(p.ra*15),d=rad(p.dec),e=sun().obliquity;return Math.atan2(Math.sin(a)*Math.cos(e)+Math.tan(d)*Math.sin(e),Math.cos(a))}
function orbit(){
 const {c,w,h}=setupCanvas('orbit'),cx=w/2,cy=h/2,R=Math.min(w*.28,h*.28),outer=R*1.58,theta=sun().lon+Math.PI;
 const background=c.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.65);background.addColorStop(0,'#19354b');background.addColorStop(.5,'#10283d');background.addColorStop(1,'#081827');c.fillStyle=background;c.fillRect(0,0,w,h);
 c.beginPath();c.arc(cx,cy,R,0,TAU);c.strokeStyle='#7ac3bf13';c.lineWidth=9;c.stroke();c.strokeStyle='#8dc6c37d';c.lineWidth=1.2;c.stroke();
 const a=rad(90);arrow(c,cx+R*Math.cos(a-.2),cy-R*Math.sin(a-.2),cx+R*Math.cos(a),cy-R*Math.sin(a),'#8ce5cd');
 // Uneven directions derived from actual representative-star coordinates, not zodiac sectors.
 for(const ref of references){const {hr}=ref,label=ref.label||ref.name;const a=eclipticLongitude(byHR.get(hr)),x=cx+outer*Math.cos(a),y=cy-outer*Math.sin(a);stellarDot(c,x,y,2,byHR.get(hr).mag,state.target===ref.name);text(c,label,Math.max(48,Math.min(w-48,x)),y+(y<cy||y>h-55?-12:17),state.target===ref.name?'#a1ffe5':'#b6ccda',w<400?10:11)}
 const ex=cx+R*Math.cos(theta),ey=cy-R*Math.sin(theta);arrow(c,ex,ey,cx,cy,'#dfb650');
 const vx=Math.cos(theta),vy=-Math.sin(theta);arrow(c,ex,ey,ex+vx*R*.6,ey+vy*R*.6,'#de8069');
 const glow=c.createRadialGradient(cx,cy,3,cx,cy,68);glow.addColorStop(0,'#fff0bddd');glow.addColorStop(.28,'#ffc87555');glow.addColorStop(.6,'#e9a45012');glow.addColorStop(1,'#ffd27800');circle(c,cx,cy,68,glow);
 const solarDisc=c.createRadialGradient(cx-4,cy-5,1,cx,cy,14);solarDisc.addColorStop(0,'#fffce2');solarDisc.addColorStop(.5,'#ffe3a1');solarDisc.addColorStop(1,'#eeae55');circle(c,cx,cy,14,solarDisc);text(c,'太陽',cx,cy+31,'#e7cf9b',11);
 const atmosphere=c.createRadialGradient(ex,ey,7,ex,ey,20);atmosphere.addColorStop(0,'#7be8dd66');atmosphere.addColorStop(1,'#7be8dd00');circle(c,ex,ey,20,atmosphere);
 const ocean=c.createRadialGradient(ex-4,ey-5,1,ex,ey,11);ocean.addColorStop(0,'#b0e8dc');ocean.addColorStop(.45,'#4db5c6');ocean.addColorStop(1,'#1a617c');circle(c,ex,ey,11,ocean);c.save();c.beginPath();c.arc(ex,ey,11,0,TAU);c.clip();c.translate(ex,ey);c.rotate(Math.atan2(ey-cy,ex-cx)-Math.PI/2);c.fillStyle='#071c32b8';c.fillRect(-11,0,22,11);c.restore();text(c,dateText(),ex,ey+27,'#a1e9db',10);
 if(state.target){const g=groups.find(g=>g.name===state.target),a=eclipticLongitude(g.stars[0]),tx=ex+Math.cos(a)*R*.75,ty=ey-Math.sin(a)*R*.75;arrow(c,ex,ey,tx,ty,'#92ead6');text(c,'選んだ代表星の方向',Math.max(65,Math.min(w-65,tx)),Math.max(20,ty-12),'#b8f2df',9)}
 text(c,'星の方向は黄道面への投影。星までの距離は表していません。',cx,h-13,'#8ba7b8',w<400?8:9);
}
// Orthographic view of the northern hemisphere, oriented with the Sun's RA on the right.
// Sun declination and Tokyo latitude enter the illumination/observer geometry.
function earth(){
 const {c,w,h}=setupCanvas('earth'),x=43,y=h/2,r=31,s=sun(),d=rad(s.dec),H=rad(wrap(lst()-s.ra*15));
 for(let px=-r;px<r;px+=1)for(let py=-r;py<r;py+=1){const nx=(px+.5)/r,ny=-(py+.5)/r,z2=1-nx*nx-ny*ny;if(z2<0)continue;const illumination=nx*Math.cos(d)+Math.sqrt(z2)*Math.sin(d);c.fillStyle=illumination>0?'#65b5c3':'#18344e';c.fillRect(x+px,y+py,1.2,1.2)}
 c.beginPath();c.arc(x,y,r*Math.cos(latitude),0,TAU);c.setLineDash([2,3]);c.strokeStyle='#a6d3d280';c.stroke();c.setLineDash([]);circle(c,x,y,1.6,'#e5eff1');
 const px=x+r*Math.cos(latitude)*Math.cos(H),py=y-r*Math.cos(latitude)*Math.sin(H);circle(c,px,py,3.5,'#ee806a');arrow(c,x+r+7,y,x+r+32,y,'#dfb650');text(c,'太陽',w-17,y-12,'#9c813c',9);
 const alt=sunAltitude();$('daynight').textContent=alt>=0?'太陽の中心が地平線より上：昼です。':alt>=-18?'太陽は地平線より下ですが、まだ薄明の時間です。':'太陽高度が−18°より低い夜です。';
}
// Zenith-centred stereographic sky chart. One scale for both axes on every device.
function skyGeometry(w,h){return {cx:w/2,cy:h/2+8,r:Math.max(1,Math.min(w/2-30,h/2-34))}}
function project(p,w,h){const {cx,cy,r}=skyGeometry(w,h),a=rad(p.az-(state.direction==='south'?180:0)),rho=r*Math.tan(rad((90-p.alt)/2));return {x:cx+rho*Math.sin(a),y:cy+rho*Math.cos(a),visible:p.alt>=0&&p.alt<=90}}
function skyGrid(c,w,h){const {cx,cy,r}=skyGeometry(w,h);for(const alt of [0,30,60]){const radius=r*Math.tan(rad((90-alt)/2));c.beginPath();c.arc(cx,cy,radius,0,TAU);c.strokeStyle=alt===0?'#94c6bd80':'#ffffff12';c.lineWidth=alt===0?1.2:.7;c.setLineDash(alt===0?[]:[3,5]);c.stroke();c.setLineDash([]);if(alt)text(c,alt+'°',cx+radius*.7,cy-radius*.7,'#6f92a5',8)}
 const front=state.direction==='south'?'南':'北',back=state.direction==='south'?'北':'南',left=state.direction==='south'?'東':'西',right=state.direction==='south'?'西':'東';text(c,front,cx,cy+r+19,'#c4e9dc',11);text(c,back,cx,cy-r-10,'#c4e9dc',11);text(c,left,cx-r-15,cy+4,'#c4e9dc',11);text(c,right,cx+r+15,cy+4,'#c4e9dc',11);text(c,'真上',cx,cy-6,'#6b91a3',9);circle(c,cx,cy,1,'#809fac');
}
function canShowStars(day=state.day,time=state.time){return sunAltitude(day,time)<-6||$('virtual').checked}
function sky(){
 const {c,w,h}=setupCanvas('sky'),solar=sun(),solarAlt=sunAltitude(),light=solarAlt>=-6,show=canShowStars();
 const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,solarAlt>=0?'#204565':solarAlt>=-18?'#192e49':'#060f20');gradient.addColorStop(.65,solarAlt>=0?'#5e879f':solarAlt>=-18?'#2c4660':'#132b42');gradient.addColorStop(1,solarAlt>=0?'#7095aa':'#214553');c.fillStyle=gradient;c.fillRect(0,0,w,h);
 skyGrid(c,w,h);const {cx,cy,r}=skyGeometry(w,h);c.save();c.beginPath();c.arc(cx,cy,r,0,TAU);c.clip();
 const grouped=new Set(groups.flatMap(g=>g.hr));
 if(show)for(const s of STAR_DATA.stars){if(grouped.has(s.hr)||s.hr===424)continue;const p=project(starHorizontal(s),w,h);if(p.visible){const r=Math.max(.65,1.8-s.mag*.22);if(s.mag<2)stellarDot(c,p.x,p.y,r,s.mag,false,light);else circle(c,p.x,p.y,r,light?'#ffffff50':'#cddbe5aa')}}
 const comparison=observationKind()==='day'?{day:state.day,time:state.time+120}:{day:nextMonth(),time:state.time};
 if($('compare').checked&&canShowStars(comparison.day,comparison.time))drawGroups(c,w,h,comparison.day,comparison.time,true,sunAltitude(comparison.day,comparison.time)>=-6);
 if(show&&$('trail').checked){for(const g of groups){if(state.target&&g.name!==state.target)continue;for(const s of g.stars){let prev=null;for(let t=0;t<=120;t+=10){const p=project(starHorizontal(s,state.day,state.time+t),w,h);if(p.visible&&prev)line(c,prev.x,prev.y,p.x,p.y,'#eebd6980',1);prev=p.visible?p:null}}}}
 if(show){drawGroups(c,w,h,state.day,state.time,false,light);{const p=project(starHorizontal(byHR.get(424)),w,h);stellarDot(c,p.x,p.y,2.5,1.98,false,light);text(c,'北極星',p.x+8,p.y-8,'#ffe9a5',11,'left')}}
 {const pole=project({alt:deg(latitude),az:0},w,h);line(c,pole.x-4,pole.y,pole.x+4,pole.y,'#a9bfc7');line(c,pole.x,pole.y-4,pole.x,pole.y+4,'#a9bfc7');text(c,'天の北極',pole.x-9,pole.y+17,'#a9bfc7',9,'right')}
 const sp=project(horizontal(solar.ra,solar.dec),w,h);if(sp.visible){circle(c,sp.x,sp.y,9,'#ffd783');text(c,'太陽',sp.x,sp.y-16,'#fff1bf',11)}c.restore();
 if($('compare').checked)text(c,observationKind()==='day'?'金の輪：2時間後':`金の輪：${dateText(comparison.day,comparison.day>364)}`,w-12,20,'#f2ca85',10,'right');
 if(!show)text(c,'昼・明るい薄明：星の表示を省略',w/2,h/2+22,'#e7f1f9',11);else if(light)text(c,'昼・薄明の星は仮想表示',w/2,h-54,'#e7f1f9',11);
 $('skyStamp').textContent=`${dateText(state.day,true)} ${timeText()} JST`;
 const g=groups.find(g=>g.name===state.target);if(g){const p=starHorizontal(g.stars[0]),v=project(p,w,h);$('targetData').textContent=`代表星 HR ${g.hr[0]}：方位 ${p.az.toFixed(1)}°・幾何学的高度 ${p.alt.toFixed(1)}°`; $('targetInfo').textContent=`${g.name}：${p.alt<0?'今は地平線の下です。':!v.visible?'反対側の空にあります。方角を切り替えてみましょう。':!show?'この方向にありますが、昼・明るい薄明なので星を省略しています。':'ミント色の星を、宇宙と地上で追いかけよう。'}`;}else {$('targetInfo').textContent='星座カードか、星座メニューで選ぼう。';$('targetData').textContent='星座未選択';}
 $('visibilityInfo').textContent=`太陽高度 ${solarAlt.toFixed(1)}°。${solarAlt>=0?'昼':solarAlt>=-6?'市民薄明':solarAlt>=-12?'航海薄明':solarAlt>=-18?'天文薄明':'天文薄明が終わった夜'}。実際の星の見え方は明るさ・天候・光害などにも左右されます。`;
}
function drawGroups(c,w,h,day,time,ghost,light){
 for(const g of groups){const active=g.name===state.target,dim=state.target&&!active,points=g.stars.map(s=>project(starHorizontal(s,day,time),w,h));c.save();c.globalAlpha=(dim?.3:1)*(light?.4:1);
 if($('lines').checked)for(const [a,b] of g.edges){const p=points[a],q=points[b];if(p.visible&&q.visible)line(c,p.x,p.y,q.x,q.y,ghost?'#ffc878b0':active?'#69ded3':'#799aad80',active?1.6:1,ghost?[4,4]:[])}
 for(let i=0;i<points.length;i++){const p=points[i];if(!p.visible)continue;const r=Math.max(1,2.4-g.stars[i].mag*.3);if(ghost){c.beginPath();c.arc(p.x,p.y,r+1,0,TAU);c.strokeStyle='#ffc878';c.stroke();}else stellarDot(c,p.x,p.y,r,g.stars[i].mag,active,light)}
 if(!ghost&&(!state.target||active)){const p=points[0];if(p.visible)text(c,g.name.startsWith('秋の')?'秋の四辺形・ペガスス座':g.name.startsWith('北斗')?'北斗七星':g.name,Math.max(8,Math.min(w-135,p.x+9)),Math.max(38,p.y-11),active?'#9bf1df':'#abbecd',w<400?10:11,'left')}c.restore();
 }
}
function render(){
 $('date').value=state.day;$('time').value=state.time;$('dateLabel').textContent=dateText();$('timeLabel').textContent=timeText();const daily=state.mode==='day';
 $('dateControl').hidden=daily;$('timeControl').hidden=!daily;$('seasonChoices').hidden=daily;
 $('step').textContent=daily?'1時間進める →':'1か月進める →';$('step').disabled=daily?state.day===364&&state.time+60>=1440:nextMonth()>364;
 $('compareLabel').textContent=daily?'2時間後と比較':'1か月後と比較';$('viewTitle').textContent=(state.direction==='south'?'南':'北')+'を手前に · '+(state.target||'すべての星座');
 $('modeHint').textContent=daily?'時刻を進めると、星が動いて見える。':'同じ21時でも、季節が変わると星空が変わる。';
 orbit();earth();sky();
}
function stop(){state.playing=false;$('play').textContent='▶ 再生';$('play').setAttribute('aria-pressed','false')}
function setMode(mode){stop();state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('compare').checked=false;if(mode==='year')state.time=1260;render()}
function setDirection(dir){state.direction=dir;document.querySelectorAll('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===dir)));render()}
references.forEach(ref=>{const b=document.createElement('button');b.textContent=ref.season+' · '+(ref.label||ref.name);b.onclick=()=>{stop();state.day=ref.day;state.time=1260;state.target=ref.name;$('target').value=ref.name;setDirection('south')};$('seasonChoices').append(b)});
$('target').value=state.target;
groups.forEach(g=>{const o=document.createElement('option');o.value=g.name;o.textContent=g.name;$('target').append(o)});
$('date').oninput=e=>{stop();state.day=+e.target.value;render()};$('time').oninput=e=>{stop();state.time=+e.target.value;render()};$('target').onchange=e=>{state.target=e.target.value;render()};['lines','trail','compare','virtual'].forEach(id=>$(id).onchange=render);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>setDirection(b.dataset.direction));
$('step').onclick=()=>{stop();if(observationKind()==='day')advanceMinutes(60);else advanceDate();render()};$('play').setAttribute('aria-pressed','false');$('play').onclick=()=>{state.playing=!state.playing;$('play').textContent=state.playing?'Ⅱ 一時停止':'▶ 再生';$('play').setAttribute('aria-pressed',String(state.playing))};
$('reset').onclick=()=>{state.day=14;state.time=1140;state.target='オリオン座';$('target').value=state.target;$('lines').checked=true;$('trail').checked=false;$('compare').checked=false;$('virtual').checked=false;setDirection('south');setMode('day')};
$('target').value=state.target;$('spaceView').ontoggle=()=>render();
setInterval(()=>{if(!state.playing)return;if(observationKind()==='day')advanceMinutes(10);else{if(state.day>=364)stop();else state.day++}render()},180);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('resize',render);if(document.fonts)document.fonts.ready.then(render);render();
