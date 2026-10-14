(()=>{
'use strict';
const $=id=>document.getElementById(id), TAU=Math.PI*2;
const canvas=$('plot'),context=canvas.getContext('2d',{alpha:false});
const stage=$('stage');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const defaultWheels=()=>[{r:110,f:1,phase:0},{r:45,f:-2,phase:0},{r:27,f:3,phase:0}];
const model={
 mode:'free',source:'manual',playing:false,t:0,speed:1,
 wheels:defaultWheels(),coeffs:[],selected:0,autoCount:0,closedPath:true,errorPixels:null,
 stroke:[],reference:[],showRings:true,showGrid:true,showForecast:true,showOriginal:true,
 drawing:false,drag:null,activePointerId:null,forecast:[],forecastDirty:true,
 width:0,height:0,dpr:1,scale:1,last:0,trail:[],error:null,
 perf:{fftCalls:0,forecastBuilds:0,frames:0,gridBuilds:0,ringPlans:0}
};
const wheelColor=['#a8e7e0','#e8d19b','#aabdeb','#eba9ad'];
const telemetryCache={};
function textIfChanged(id,value){
 const str=String(value);if(telemetryCache[id]===str)return;
 telemetryCache[id]=str;$(id).textContent=str;
}
function syncTelemetry(){
 const fitted=model.source==='fitted',drawing=model.mode==='draw';
 const label=drawing?(model.drawing?'ACQUIRING':'INPUT READY'):
   fitted?'RECONSTRUCTED':'MODEL READY';
 const error=fitted&&!drawing&&Number.isFinite(model.errorPixels)?model.errorPixels:null;
 textIfChanged('labState',label);
 textIfChanged('labHarmonics',model.wheels.length.toLocaleString('en-US',{minimumIntegerDigits:3}));
 textIfChanged('labError',error===null?'—':error.toFixed(1));
 textIfChanged('labPath',drawing?'INPUT':fitted?(model.closedPath?'LOOP':'RETURN'):'MODEL');
 textIfChanged('labSampleCount','INPUT / '+(model.reference.length||model.stroke.length));
 textIfChanged('labPlayback',drawing?(model.drawing?'CAPTURING':'STANDBY'):(model.playing?'RUNNING':'PAUSED'));
 const quality=error===null?'none':error<=3?'good':error<=8?'fair':'poor';
 if($('labError').dataset.quality!==quality)$('labError').dataset.quality=quality;
}
let measurementGrid=null;
function buildMeasurementGrid(){
 const minor=new Path2D(),major=new Path2D(),width=model.width,height=model.height;
 const centerX=width/2,centerY=height/2,step=width<500?76:width<850?64:56;
 for(let x=centerX%step;x<width;x+=step){
  const p=Math.round(x)+.5;minor.moveTo(p,0);minor.lineTo(p,height);
 }
 for(let y=centerY%step;y<height;y+=step){
  const p=Math.round(y)+.5;minor.moveTo(0,p);minor.lineTo(width,p);
 }
 major.moveTo(Math.round(centerX)+.5,0);major.lineTo(Math.round(centerX)+.5,height);
 major.moveTo(0,Math.round(centerY)+.5);major.lineTo(width,Math.round(centerY)+.5);
 measurementGrid={minor,major,step};model.perf.gridBuilds++;
}
function drawMeasurementGrid(ctx){
 if(!measurementGrid)buildMeasurementGrid();
 ctx.save();
 ctx.strokeStyle=model.mode==='draw'?'rgba(119,176,182,.035)':'rgba(119,176,182,.050)';
 ctx.lineWidth=1;ctx.stroke(measurementGrid.minor);
 ctx.strokeStyle=model.mode==='draw'?'rgba(130,206,201,.10)':'rgba(130,206,201,.16)';
 ctx.lineWidth=1;ctx.stroke(measurementGrid.major);
 const w=model.width,h=model.height,margin=14,arm=16;
 ctx.strokeStyle='rgba(143,199,195,.28)';ctx.lineWidth=1.1;ctx.beginPath();
 for(const [x,y,dx,dy] of [[margin,margin,1,1],[w-margin,margin,-1,1],
                           [margin,h-margin,1,-1],[w-margin,h-margin,-1,-1]]){
  ctx.moveTo(x,y+arm*dy);ctx.lineTo(x,y);ctx.lineTo(x+arm*dx,y);
 }
 ctx.stroke();
 if(w>750&&h>470){
  ctx.fillStyle='rgba(133,185,188,.56)';
  ctx.font='9px ui-monospace, monospace';
  ctx.fillText('OBSERVATION FIELD / XY',margin+18,margin+4);
  ctx.textAlign='right';ctx.fillText('SCALE / VIEWPORT',w-margin-18,h-margin-4);
 }
 ctx.restore();
}
let circlePlan={dirty:true,selected:-1,count:0,indices:[]};
function visibleCircleIndices(){
 const n=model.wheels.length;
 if(!circlePlan.dirty&&circlePlan.count===n&&circlePlan.selected===model.selected)return circlePlan.indices;
 let indices;
 if(n<=36){indices=Array.from({length:n},(_,i)=>i)}
 else{
  // Show strongest resonances plus the explicitly selected ring, always keeping
  // a recognizable circle chain without painting hundreds of overlapping rings.
  const indicesSet=new Set([0,1,2,model.selected,n-1]);
  const strongest=model.wheels.map((w,i)=>({i,energy:w.r*w.r}))
    .filter(x=>x.i>2&&x.i!==n-1)
    .sort((a,b)=>b.energy-a.energy).slice(0,25);
  for(const ring of strongest)indicesSet.add(ring.i);
  indices=[...indicesSet].filter(i=>i>=0&&i<n).sort((a,b)=>a-b);
 }
 circlePlan={dirty:false,selected:model.selected,count:n,indices};
 model.perf.ringPlans++;
 return indices;
}
function note(value){$('status').textContent=value}
function coordinate(x,y){return{x:(x-model.width/2)/model.scale,y:(y-model.height/2)/model.scale}}
function pixel(p){return{x:model.width/2+p.x*model.scale,y:model.height/2+p.y*model.scale}}
function wheelPosition(t,wheels=model.wheels){
 let x=0,y=0;
 for(const wheel of wheels){
  const a=TAU*wheel.f*t+wheel.phase;
  x+=wheel.r*Math.cos(a);y+=wheel.r*Math.sin(a);
 }
 return{x,y};
}
function wheelCenters(t){
 let x=0,y=0;
 const result=[];
 for(let i=0;i<model.wheels.length;i++){
  const w=model.wheels[i],a=TAU*w.f*t+w.phase;
  const nx=x+w.r*Math.cos(a),ny=y+w.r*Math.sin(a);
  result.push({index:i,cx:x,cy:y,x:nx,y:ny,r:w.r});
  x=nx;y=ny;
 }
 return result;
}
function nextWheel(i){return{r:Math.max(4,Math.round(45/(1+i*.23))),f:(i%2?-1:1)*(Math.floor(i/2)+1),phase:0}}
function setCount(value){
 const n=clamp(Math.floor(Number(value)||1),1,2048);
 if(model.source==='fitted'&&model.coeffs.length){
  // The complete FFT spectrum stays available; never synthesize unrelated circles.
  model.wheels=model.coeffs.slice(0,n).map(w=>({...w}));
 }else{
  while(model.wheels.length<n)model.wheels.push(nextWheel(model.wheels.length));
  model.wheels.length=n;
 }
 model.selected=clamp(model.selected,0,n-1);
 circlePlan.dirty=true;model.forecastDirty=true;model.trail=[];
 $('countInput').value=n;
 if(model.source==='fitted'){
  model.error=fitError(model.reference);model.errorPixels=model.error*model.scale;
  if(n!==model.autoCount)note('使用 '+n+' 個圓 · 最新重建誤差請看上方分析卡');
 }else if(n>128)note(n+' 圓模式 · 可在設定中隱藏圓周骨架以維持流暢');
 else note('目前 '+n+' 個圓周 · 可以直接拖曳端點');
 renderWheelEditor();
 render();
 return n;
}
function complexFFT(re,im){
 const n=re.length;
 // Radix-2 DFT with a negative exponential, inverse epicycles use positive rotation.
 for(let i=1,j=0;i<n;i++){
  let bit=n>>1;
  for(;j&bit;bit>>=1)j^=bit;
  j^=bit;
  if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}
 }
 for(let len=2;len<=n;len<<=1){
  const angle=-TAU/len,wr=Math.cos(angle),wi=Math.sin(angle);
  for(let i=0;i<n;i+=len){
   let ur=1,ui=0;
   for(let j=0;j<len/2;j++){
    const u=i+j,v=u+len/2;
    const vr=re[v]*ur-im[v]*ui,vi=re[v]*ui+im[v]*ur;
    re[v]=re[u]-vr;im[v]=im[u]-vi;
    re[u]+=vr;im[u]+=vi;
    const nr=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=nr;
   }
  }
 }
}
function resampleClosed(points,count){
 const source=points.map(p=>({x:p.x,y:p.y}));
 if(source.length<3)return[];
 // Closing the loop intentionally makes one full rotation periodic.
 const lengths=[],n=source.length;
 let total=0;
 for(let i=0;i<n;i++){
  const a=source[i],b=source[(i+1)%n],d=Math.hypot(b.x-a.x,b.y-a.y);
  lengths.push(d);total+=d;
 }
 if(total<10)return[];
 const sampled=[],step=total/count;
 let index=0,start=0;
 for(let i=0;i<count;i++){
  const at=i*step;
  while(index<n-1&&start+lengths[index]<at){start+=lengths[index];index++}
  const a=source[index],b=source[(index+1)%n];
  const t=lengths[index]?clamp((at-start)/lengths[index],0,1):0;
  sampled.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 }
 return sampled;
}
function pathIsClosed(points){
 const first=points[0],last=points[points.length-1];
 let length=0;
 for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 return Math.hypot(last.x-first.x,last.y-first.y)<=Math.max(10/model.scale,Math.min(30/model.scale,length*.02));
}
function fitPath(points,count){
 // Use all Fourier coefficients regardless of the initial UI circle count.
 // An open stroke is mirrored back to the start instead of joining endpoints
 // with a fake straight segment (one complete revolution = out and back).
 const size=2048,closed=pathIsClosed(points);
 const periodic=closed?points:points.concat(points.slice(1,-1).reverse());
 const samples=resampleClosed(periodic,size);
 if(samples.length!==size)return null;
 const re=samples.map(p=>p.x),im=samples.map(p=>p.y);
 complexFFT(re,im);
 const coefficients=[];
 for(let i=0;i<size;i++){
  const x=re[i]/size,y=im[i]/size;
  coefficients.push({r:Math.hypot(x,y),f:i>size/2?i-size:i,phase:Math.atan2(y,x)});
 }
 const base=coefficients.shift(); // DC term anchors the drawn path's center.
 coefficients.sort((a,b)=>b.r-a.r);
 model.perf.fftCalls++;
 return{coeffs:[base,...coefficients],samples,closed};
}
function fitError(samples){
 if(!samples.length)return null;
 const stride=Math.max(1,Math.ceil(samples.length/256));
 let sum=0,n=0;
 for(let i=0;i<samples.length;i+=stride){
  const p=wheelPosition(i/samples.length),q=samples[i];
  sum+=(p.x-q.x)**2+(p.y-q.y)**2;n++;
 }
 return Math.sqrt(sum/n);
}
function chooseCircleCount(coeffs,samples){
 // Parseval's identity gives exact sampled RMS residual for omitted harmonics.
 // Then check the maximum visual deviation so sharp corners aren't ignored.
 const target=2.0/model.scale,maxDeviation=7/model.scale;
 let energy=coeffs.slice(1).reduce((sum,c)=>sum+c.r*c.r,0);
 let n=1;
 while(n<Math.min(512,coeffs.length)){
  energy=Math.max(0,energy-coeffs[n].r**2);n++;
  if(n>=12&&Math.sqrt(energy)<=target)break;
 }
 while(n<Math.min(512,coeffs.length)){
  const wheels=coeffs.slice(0,n);
  let worst=0;
  for(let j=0;j<128;j++){
   const i=Math.floor(j*samples.length/128);
   const p=wheelPosition(i/samples.length,wheels),q=samples[i];
   worst=Math.max(worst,Math.hypot(p.x-q.x,p.y-q.y));
  }
  if(worst<=maxDeviation)break;
  n=Math.min(512,n+16);
 }
 return Math.max(12,n);
}
function generate(){
 if(model.stroke.length<3){note('請先在畫布上畫一條軌跡');return false}
 const result=fitPath(model.stroke,2048);
 if(!result){note('線條太短，請畫一條更完整的軌跡');return false}
 model.coeffs=result.coeffs;
 model.reference=result.samples;
 model.closedPath=result.closed;
 model.source='fitted';
 model.selected=1;
 circlePlan.dirty=true;
 model.autoCount=chooseCircleCount(result.coeffs,result.samples);
 model.t=0;model.trail=[];model.playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;model.last=0;
 model.mode='free';
 model.showForecast=false; // Solid animated stroke is the main result, not a pre-drawn golden outline.
 $('showForecast').checked=false;
 setCount(model.autoCount);
 model.error=fitError(model.reference);
 model.errorPixels=model.error*model.scale;
 model.trail=[wheelPosition(0)];
 $('generateBtn').textContent='重新生成圓周';
 syncMode();syncPlay();
 const label=model.closedPath?'循環描繪':'來回描繪';
 note('自動生成 '+model.autoCount+' 個圓 · 沿手繪線'+label+' · 查看上方即時誤差');
 $('canvasHint').textContent='金色端點沿著手繪路徑移動，並逐步畫出實線軌跡';
 render();
 return true;
}
function clearStroke(){
 model.stroke=[];model.reference=[];model.error=null;model.errorPixels=null;model.autoCount=0;
 model.trail=[];model.showForecast=true;$('showForecast').checked=true;model.forecastDirty=true;
 $('generateBtn').disabled=true;$('generateBtn').textContent='依手繪生成圓周';
 if(model.source==='fitted'){model.source='manual';model.coeffs=[];model.wheels=defaultWheels();$('countInput').value=3;renderWheelEditor()}
 $('canvasHint').textContent='在畫布上畫一條路徑，完成後按「依手繪生成圓周」';
 note('手繪路徑已清空');render();
}
function resetAll(){
 model.mode='free';model.source='manual';model.playing=false;model.t=0;
 model.speed=1;model.selected=0;model.stroke=[];model.reference=[];
 model.coeffs=[];model.wheels=defaultWheels();model.trail=[];model.error=null;model.errorPixels=null;model.autoCount=0;model.closedPath=true;model.showForecast=true;$('showForecast').checked=true;
 model.forecastDirty=true;circlePlan.dirty=true;model.drawing=false;model.drag=null;model.activePointerId=null;
 $('countInput').value=3;$('speedSlider').value=100;$('speedOut').textContent='1.0×';
 $('generateBtn').disabled=true;$('generateBtn').textContent='依手繪生成圓周';
 $('canvasHint').textContent='切換到「手繪軌跡」，在畫布上用手指或滑鼠畫線';
 syncMode();syncPlay();renderWheelEditor();note('調整圓周，觀察路徑');render();
}
function setMode(mode){
 if(mode!=='free'&&mode!=='draw')return;
 model.mode=mode;
 if(mode==='draw'){model.playing=false;model.drawing=false;model.drag=null;model.activePointerId=null;model.trail=[];note('用手指或滑鼠畫出你的軌跡')}
 else note(model.source==='fitted'?'可以微調重建後的圓周':'自由調整圓周，觀察即時路徑');
 $('canvasHint').textContent=mode==='draw'?'用手指或滑鼠畫線，放開就會自動生成並播放':model.source==='fitted'?'保留手繪線作為參考，調整圓周看差異':'可直接拖曳圓周端點，也能打開右上角設定';
 syncMode();syncPlay();render();
}
function syncMode(){
 $('freeMode').classList.toggle('current',model.mode==='free');
 $('drawMode').classList.toggle('current',model.mode==='draw');
 $('freeMode').setAttribute('aria-pressed',String(model.mode==='free'));
 $('drawMode').setAttribute('aria-pressed',String(model.mode==='draw'));
 $('generateBtn').disabled=model.stroke.length<3;
 document.querySelector('.workspace').dataset.mode=model.mode;
 canvas.style.cursor=model.mode==='draw'?'crosshair':'grab';
}
function syncPlay(){
 $('playText').textContent=model.playing?'暫停播放':'開始播放';
 $('playBtn').firstElementChild.textContent=model.playing?'Ⅱ':'▶';
 $('playBtn').setAttribute('aria-pressed',String(model.playing));
}
function togglePlay(){
 if(model.mode==='draw')setMode('free');
 model.playing=!model.playing;model.last=0;syncPlay();render();
}
function updateWheel(field,value){
 const w=model.wheels[model.selected];
 if(!w)return;
 if(field==='r')w.r=clamp(Number(value)||0,0,1000);
 if(field==='f')w.f=clamp(Math.round(Number(value)||0),-2048,2048);
 if(field==='phase')w.phase=clamp(Number(value)||0,-180,180)*Math.PI/180;
 if(model.source==='fitted'&&model.coeffs[model.selected]){
  model.coeffs[model.selected]={...w};
  model.error=fitError(model.reference);model.errorPixels=model.error*model.scale;
  note('圓周 '+(model.selected+1)+' 已校正 · 最新誤差已更新');
 }
 model.forecastDirty=true;model.trail=[];circlePlan.dirty=true;
 renderWheelEditor();render();
}
function renderWheelEditor(){
 const s=$('wheelSelect'),current=model.selected;
 s.replaceChildren();
 model.wheels.forEach((wheel,i)=>{
  const option=document.createElement('option');
  option.value=i;option.textContent='圓周 '+String(i+1).padStart(2,'0')+' · '+(wheel.f===0?'不旋轉':Math.abs(wheel.f)+'×'+(wheel.f<0?'逆':'順'));
  s.append(option);
 });
 s.value=String(clamp(current,0,model.wheels.length-1));
 const w=model.wheels[model.selected];if(!w)return;
 $('radius').value=Math.min(300,w.r);$('radiusNumber').value=Math.round(w.r);
 $('radiusOut').textContent=Math.round(w.r);
 $('frequency').value=w.f;
 const angle=Math.round(w.phase*180/Math.PI);
 $('phase').value=clamp(angle,-180,180);$('phaseOut').textContent=angle+'°';
}
function openSettings(visible){
 $('advancedPanel').hidden=!visible;
 $('settingsBtn').setAttribute('aria-expanded',String(visible));
 if(visible)renderWheelEditor();
}
function resize(){
 const b=stage.getBoundingClientRect();
 const w=b.width,h=b.height,dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(2400000/Math.max(1,w*h)));
 if(w<1||h<1)return;
 if(model.width===w&&model.height===h&&model.dpr===dpr)return;
 model.width=w;model.height=h;model.dpr=dpr;model.scale=Math.min(w/640,h/620);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 context.setTransform(dpr,0,0,dpr,0,0);
 if(model.source==='fitted'&&Number.isFinite(model.error))model.errorPixels=model.error*model.scale;
 model.forecastDirty=true;measurementGrid=null;buildMeasurementGrid();render();
}
function buildForecast(){
 if(!model.forecastDirty)return;
 const n=model.wheels.length>700?220:model.wheels.length>200?350:480;
 const points=[];
 // Sum in coefficient space, never infer geometry from the pixels.
 for(let i=0;i<=n;i++)points.push(pixel(wheelPosition(i/n)));
 model.forecast=points;model.forecastDirty=false;model.perf.forecastBuilds++;
}
function strokeLine(pts,color,width,dashed=false){
 if(pts.length<2)return;
 context.beginPath();context.moveTo(pts[0].x,pts[0].y);
 for(let i=1;i<pts.length;i++)context.lineTo(pts[i].x,pts[i].y);
 context.strokeStyle=color;context.lineWidth=width;
 context.setLineDash(dashed?[5,6]:[]);
 context.lineJoin='round';context.lineCap='round';context.stroke();context.setLineDash([]);
}
function render(){
 syncTelemetry();
 if(!model.width||!model.height)return;
 const ctx=context,w=model.width,h=model.height;
 ctx.fillStyle='#071522';ctx.fillRect(0,0,w,h);
 const radial=ctx.createRadialGradient(w*.51,h*.43,0,w*.51,h*.43,Math.max(w,h)*.72);
 radial.addColorStop(0,'rgba(29,62,83,.30)');radial.addColorStop(1,'rgba(7,18,30,0)');
 ctx.fillStyle=radial;ctx.fillRect(0,0,w,h);
 if(model.showGrid)drawMeasurementGrid(ctx);
 // Lightweight static reference axis; sparse enough to keep visual focus on the orbit.
 const center=pixel({x:0,y:0});
 ctx.strokeStyle='rgba(118,161,180,.10)';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(center.x-13,center.y);ctx.lineTo(center.x+13,center.y);
 ctx.moveTo(center.x,center.y-13);ctx.lineTo(center.x,center.y+13);ctx.stroke();
 const raw=(model.mode==='draw'?model.stroke:model.reference.length?model.reference:model.stroke);
 if(model.showOriginal&&raw.length>1)strokeLine(raw.map(pixel),'rgba(127,229,209,.63)',1.8,true);
 if(model.mode==='draw'){
  if(model.stroke.length>0){const p=pixel(model.stroke[model.stroke.length-1]);ctx.fillStyle='#b9f7ee';ctx.beginPath();ctx.arc(p.x,p.y,3.5,0,TAU);ctx.fill()}
  model.perf.frames++;return;
 }
 if(model.showForecast){buildForecast();strokeLine(model.forecast,'rgba(246,214,159,.52)',1.35,true)}
 if(model.trail.length>1){
  // The line is generated from the actual rotating endpoint, not painted from
  // the reference stroke. Its length grows as the orbit advances.
  strokeLine(model.trail.map(pixel),'rgba(244,226,190,.96)',2.8);
 }
 if(model.showRings){
  const circles=wheelCenters(model.t),many=circles.length>36;
  for(const i of visibleCircleIndices()){
   const c=circles[i],wheel=model.wheels[i],selected=i===model.selected;
   if(c.r<.25&&!selected)continue;
   const p=pixel({x:c.cx,y:c.cy}),end=pixel({x:c.x,y:c.y}),color=wheelColor[i%wheelColor.length];
   ctx.save();
   ctx.strokeStyle=color;ctx.fillStyle=color;
   ctx.globalAlpha=selected?1:many?.34:.57;
   ctx.lineWidth=selected?2.15:1.05;
   // Frequency zero is a DC translation, not a rotating circle.
   if(wheel.f!==0&&c.r>=.25){
    ctx.beginPath();ctx.arc(p.x,p.y,c.r*model.scale,0,TAU);ctx.stroke();
   }
   ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(end.x,end.y);ctx.stroke();
   if(selected||(!many&&circles.length<=20)){
    ctx.beginPath();ctx.arc(end.x,end.y,selected?5:2.5,0,TAU);ctx.fill();
   }
   ctx.restore();
  }
 }
 const position=pixel(wheelPosition(model.t));
 ctx.fillStyle='#f7e4b8';ctx.strokeStyle='#544a3b';ctx.lineWidth=2;
 ctx.shadowColor='rgba(255,225,174,.58)';ctx.shadowBlur=9;
 ctx.beginPath();ctx.arc(position.x,position.y,5,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.stroke();
 model.perf.frames++;
}
function advanceTrace(seconds){
 if(!model.playing||model.mode==='draw')return;
 const before=model.t,advance=clamp(seconds,0,.065)*model.speed/8;
 model.t=(before+advance)%1;
 if(model.t<before)model.trail=[wheelPosition(0)];
 // Draw from the rotating chain's endpoint, sampling between animation frames.
 const start=model.t<before?0:before;
 const steps=Math.max(1,Math.ceil((model.t-start)/.001));
 for(let k=1;k<=steps;k++)model.trail.push(wheelPosition(start+(model.t-start)*k/steps));
 if(model.trail.length>1800)model.trail.splice(0,model.trail.length-1800);
}
function frame(now){
 if(model.playing&&model.mode!=='draw'){
  if(model.last)advanceTrace((now-model.last)/1000);
  model.last=now;
 }else model.last=0;
 render();requestAnimationFrame(frame);
}
function pointerCoord(event){
 const b=canvas.getBoundingClientRect();
 return coordinate(event.clientX-b.left,event.clientY-b.top);
}
function appendStrokePoint(event){
 const p=pointerCoord(event),prev=model.stroke.at(-1);
 if(model.stroke.length>=12000)return;
 if(!prev||Math.hypot(prev.x-p.x,prev.y-p.y)>1.2/model.scale)model.stroke.push(p);
}
canvas.addEventListener('pointerdown',event=>{
 if(model.activePointerId!==null||event.pointerType==='touch'&&!event.isPrimary)return;
 if(event.pointerType==='mouse'&&event.button!==0)return;
 const p=pointerCoord(event);
 if(model.mode==='draw'){
  model.activePointerId=event.pointerId;
  model.stroke=[p];model.reference=[];model.error=null;model.errorPixels=null;model.drawing=true;
  $('generateBtn').disabled=true;note('正在採集手繪樣本…');
  canvas.setPointerCapture(event.pointerId);render();event.preventDefault();return;
 }
 const handles=wheelCenters(model.t);
 let selected=-1,best=Infinity;
 for(let i=handles.length-1;i>=0;i--){
  const h=handles[i],distance=Math.hypot(h.x-p.x,h.y-p.y)*model.scale;
  if(distance<best&&distance<(event.pointerType==='touch'?32:23)){best=distance;selected=i}
 }
 if(selected<0)return;
 model.activePointerId=event.pointerId;model.selected=selected;
 const h=handles[selected];model.drag={index:selected,cx:h.cx,cy:h.cy};
 model.playing=false;model.last=0;syncPlay();renderWheelEditor();
 canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';event.preventDefault();
});
canvas.addEventListener('pointermove',event=>{
 if(model.activePointerId===null||event.pointerId!==model.activePointerId)return;
 if(model.drawing){
  // Coalesced stylus/finger samples preserve detail when Safari batches moves.
  const samples=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():[];
  for(const sample of samples)appendStrokePoint(sample);
  appendStrokePoint(event);
  render();
 }else if(model.drag){
  const p=pointerCoord(event),c=model.drag,w=model.wheels[c.index];if(!w)return;
  w.r=clamp(Math.round(Math.hypot(p.x-c.cx,p.y-c.cy)),0,1000);
  if(model.source==='fitted'&&model.coeffs[c.index])model.coeffs[c.index]={...w};
  model.errorPixels=null;
  model.forecastDirty=true;model.trail=[];circlePlan.dirty=true;
  renderWheelEditor();render();
 }
 event.preventDefault();
});
function finishPointer(event,canceled=false){
 if(model.activePointerId===null||event.pointerId!==model.activePointerId)return;
 model.activePointerId=null;
 if(model.drawing){
  if(!canceled)appendStrokePoint(event);
  model.drawing=false;
  $('generateBtn').disabled=model.stroke.length<3;
  if(canceled){
   // Interrupted touch gestures should never analyze an incomplete sample.
   model.stroke=[];$('generateBtn').disabled=true;note('手繪已中斷，請重新描繪');
  }else if(model.stroke.length>=3)generate();
  else note('軌跡太短，請再畫一次');
 }
 if(model.drag){
  if(model.source==='fitted'&&model.reference.length){
   model.error=fitError(model.reference);model.errorPixels=model.error*model.scale;
   note('圓周 '+(model.drag.index+1)+' 已校正 · 最新誤差已更新');
  }
  model.drag=null;canvas.style.cursor='grab';
 }
 render();
}
canvas.addEventListener('pointerup',event=>finishPointer(event));
canvas.addEventListener('pointercancel',event=>finishPointer(event,true));
canvas.addEventListener('lostpointercapture',event=>finishPointer(event,true));
$('freeMode').addEventListener('click',()=>setMode('free'));
$('drawMode').addEventListener('click',()=>setMode('draw'));
$('playBtn').addEventListener('click',togglePlay);
$('generateBtn').addEventListener('click',generate);
$('clearBtn').addEventListener('click',clearStroke);
$('resetBtn').addEventListener('click',resetAll);
$('minusBtn').addEventListener('click',()=>setCount(model.wheels.length-1));
$('plusBtn').addEventListener('click',()=>setCount(model.wheels.length+1));
$('countInput').addEventListener('change',e=>setCount(e.target.value));
$('speedSlider').addEventListener('input',e=>{model.speed=Number(e.target.value)/100;$('speedOut').textContent=model.speed.toFixed(1)+'×'});
$('settingsBtn').addEventListener('click',()=>openSettings($('advancedPanel').hidden));
$('closeSettings').addEventListener('click',()=>openSettings(false));
$('wheelSelect').addEventListener('change',e=>{model.selected=Number(e.target.value);renderWheelEditor()});
$('radius').addEventListener('input',e=>updateWheel('r',e.target.value));
$('radiusNumber').addEventListener('change',e=>updateWheel('r',e.target.value));
$('frequency').addEventListener('change',e=>updateWheel('f',e.target.value));
$('phase').addEventListener('input',e=>updateWheel('phase',e.target.value));
$('showGrid').addEventListener('change',e=>{model.showGrid=e.target.checked;render()});
$('showRings').addEventListener('change',e=>{model.showRings=e.target.checked;render()});
$('showOriginal').addEventListener('change',e=>{model.showOriginal=e.target.checked;render()});
$('showForecast').addEventListener('change',e=>{model.showForecast=e.target.checked;render()});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('advancedPanel').hidden){openSettings(false);$('settingsBtn').focus();return}
 if(e.code==='Space'&&!['INPUT','BUTTON','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){
  e.preventDefault();togglePlay();
 }
});
const observer=new ResizeObserver(resize);observer.observe(stage);
window.addEventListener('pageshow',e=>{if(e.persisted)resize()});
window.__ORBIT_EXPERIMENT_DEBUG__={model,wheelPosition,resampleClosed,pathIsClosed,complexFFT,fitPath,chooseCircleCount,generate,setCount,setMode,resize,render,advanceTrace,syncTelemetry,visibleCircleIndices};
resize();renderWheelEditor();syncMode();syncPlay();requestAnimationFrame(frame);
})();