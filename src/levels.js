/* ORBIT // CODE — versioned 18-mission data (static, no network/API).
 * This file is the canonical source of published mission parameters.
 * Do not add generated candidates without review and independent geometry QA.
 * Loaded before the main inline game IIFE on GitHub Pages.
 */
(function(root){
'use strict';
const PI=Math.PI,TAU=PI*2,BASE=TAU/8;
const levels=[
 {start:[{r:90,d:1}],name:'第一次接觸',desc:'一個圓，就能畫出一條穩定的軌道。',tip:'試著將半徑調到約 138；圓太小就碰不到訊號。',max:17,refs:[{r:138,d:1}],times:[1.8,5.2],radius:21,hazards:[]},
 {start:[{r:130,d:1}],name:'內外雙環',desc:'利用兩個不同半徑的圓，在內外距離之間穿梭。',tip:'只有一個圓通常無法同時掃過不同半徑的訊號。多加一個圓看看。',max:25,refs:[{r:130,d:1},{r:68,d:-1}],times:[2.2,6.5,10.7],radius:20,hazards:[]},
 {start:[{r:128,d:1},{r:88,d:1}],name:'方向的秘密',desc:'只用兩個圓，改變旋轉方向就能畫出新的交點。',tip:'每層轉速是固定的，試著切換第二個圓的方向，觀察路線差異。',max:27,refs:[{r:128,d:-1},{r:88,d:1}],times:[2.6,6.2,11.4],radius:19,hazards:[]},
 {start:[{r:112,d:1},{r:78,d:-1}],name:'三重共鳴',desc:'三個圓已是上限，調整半徑與方向，碰到任意四個訊號即可。',tip:'圓的數量、半徑與旋轉方向會共同決定軌跡的形狀。',max:30,refs:[{r:112,d:1},{r:78,d:-1},{r:50,d:1}],times:[3,6,9,12],radius:18,hazards:[]},
 {start:[{r:120,d:1},{r:86,d:1},{r:45,d:1}],name:'紅色禁區',desc:'最多三個圓，收集所有訊號並避開紅色危險區。',tip:'撞到紅色障礙會累計碰撞次數，但不會中止探索。留意調整後的預測軌跡。',max:34,refs:[{r:120,d:1},{r:86,d:-1},{r:45,d:1}],times:[3,7.5,13,20],radius:18,hazards:[{x:-200,y:60,r:18},{x:195,y:-75,r:17}]},
 {start:[{r:112,d:1},{r:72,d:1},{r:58,d:1}],name:'最終和聲',desc:'只用三個圓，避開三處危險區，碰觸四個物資訊號。',tip:'最後一關不靠加圓數：三層半徑與兩處逆轉的組合才是關鍵。',max:38,refs:[{r:112,d:1},{r:72,d:-1},{r:58,d:-1}],times:[2.4,7.1,12.4,19.3],radius:17,hazards:[{x:-142,y:0,r:18},{x:155,y:95,r:18},{x:0,y:-165,r:16}]}
 ];

const PLANET_SIZE=6;
const planets=[{"name":"艾瑞斯","title":"初始殖民地","short":"ORIGIN","tone":"origin","description":"熟悉圓周、方向與補給站，建立第一條航線。"},{"name":"霜環星","title":"冰晶外環","short":"FROST","tone":"frost","description":"穿越極光與冰層，探索更複雜的反向軌道。"},{"name":"赤曜星","title":"赤色星海","short":"EMBER","tone":"ember","description":"深入熾熱星雲，在高風險軌道之間完成最後的補給。"}];
levels.push(
 {name:"冰層呼吸",desc:"追逐三道冰層訊號，學會掌握外圍半徑。",tip:"試試單環半徑約 145；遠處的補給站都在相同圓周上。",start:[ {r:95,d:1} ],refs:[ {r:145,d:1} ],times:[1.5,3.9,6.2],max:28,radius:18,hazards:[],captureRadius:9},
 {name:"晶體雙軌",desc:"冰晶訊號交錯出現在兩層軌道。",tip:"增加第二個圓，逆轉其方向，讓內外軌道互相呼應。",start:[ {r:128,d:1}, {r:72,d:1} ],refs:[ {r:128,d:1}, {r:72,d:-1} ],times:[1.1,3.4,5.8,7.2],max:28,radius:18,hazards:[],captureRadius:9},
 {name:"逆潮之海",desc:"極地潮汐會把順時針的預測路線帶往錯誤方向。",tip:"讓兩層圓都逆轉，注意紅色禁區提示。",start:[ {r:115,d:1}, {r:88,d:1} ],refs:[ {r:115,d:-1}, {r:88,d:-1} ],times:[1.9,4.4,6.8],max:28,radius:18,hazards:[{x:-160,y:55,r:15}],captureRadius:9},
 {name:"碎冰三環",desc:"三層軌道可同時接上分散的四個補給站。",tip:"補上第三圓，讓第二圓逆轉，觀察星形軌道。",start:[ {r:108,d:1}, {r:84,d:1} ],refs:[ {r:108,d:1}, {r:84,d:-1}, {r:52,d:1} ],times:[1.4,3.6,5.9,7.6],max:32,radius:18,hazards:[{x:-130,y:85,r:15}],captureRadius:9},
 {name:"極光迴旋",desc:"極光帶裡的訊號需要連續轉向才能接收。",tip:"使用三層圓、交替旋轉方向，留意兩處危險區。",start:[ {r:120,d:1}, {r:72,d:1}, {r:62,d:1} ],refs:[ {r:120,d:-1}, {r:72,d:1}, {r:62,d:-1} ],times:[1.2,2.8,5,7.3],max:32,radius:18,hazards:[{x:-160,y:55,r:15},{x:20,y:175,r:15}],captureRadius:9},
 {name:"冰冠傳輸",desc:"冰冠中央的最後四座補給站正等待連線。",tip:"三層圓的外側方向與兩層內環相反，才能繞過禁區。",start:[ {r:132,d:1}, {r:78,d:1}, {r:43,d:1} ],refs:[ {r:132,d:1}, {r:78,d:-1}, {r:43,d:-1} ],times:[0.9,2.5,4.9,6.9],max:32,radius:18,hazards:[{x:-130,y:-95,r:15},{x:20,y:85,r:15}],captureRadius:9},
 {name:"燃燒邊界",desc:"靠近赤曜星時，航道首先必須穿過發亮的邊界。",tip:"一正一逆的雙圓可以在熱浪間畫出開口。",start:[ {r:128,d:1}, {r:67,d:1} ],refs:[ {r:138,d:-1}, {r:67,d:1} ],times:[1.3,3.5,6.2],max:36,radius:18,hazards:[{x:50,y:115,r:15}],captureRadius:8},
 {name:"紅環共振",desc:"三層頻率在紅色光環下產生新的交會點。",tip:"讓第二層圓逆轉，再用小半徑第三圓連起補給站。",start:[ {r:110,d:1}, {r:91,d:1} ],refs:[ {r:110,d:1}, {r:91,d:-1}, {r:39,d:1} ],times:[0.8,2.4,5.2,7.4],max:36,radius:18,hazards:[{x:200,y:-65,r:15}],captureRadius:8},
 {name:"逆焰航線",desc:"燃燒的尾流會放大方向選擇的差異。",tip:"外環和第三環逆轉，中環正轉，避開兩顆導航地雷。",start:[ {r:121,d:1}, {r:74,d:1}, {r:54,d:1} ],refs:[ {r:121,d:-1}, {r:74,d:1}, {r:54,d:-1} ],times:[1.2,3.3,5.8,7.5],max:36,radius:18,hazards:[{x:200,y:-95,r:15},{x:-130,y:175,r:15}],captureRadius:8},
 {name:"日冕旋渦",desc:"日冕下有四個分散的補給站，必須調整三圓的節奏。",tip:"兩層內環相反方向旋轉，形成密集但有規律的航道。",start:[ {r:100,d:1}, {r:95,d:1}, {r:56,d:1} ],refs:[ {r:100,d:1}, {r:95,d:-1}, {r:56,d:-1} ],times:[1.7,3.8,5.4,7.4],max:40,radius:18,hazards:[{x:140,y:-35,r:15},{x:20,y:-155,r:15}],captureRadius:8},
 {name:"熔星折返",desc:"赤色星流中的三處禁區包圍了補給站。",tip:"三層圓各自調整半徑；最外層逆轉，中層也逆轉。",start:[ {r:132,d:1}, {r:64,d:1}, {r:55,d:1} ],refs:[ {r:132,d:-1}, {r:64,d:-1}, {r:55,d:1} ],times:[0.9,2.6,4.7,6.5],max:40,radius:18,hazards:[{x:50,y:-185,r:15},{x:110,y:25,r:15},{x:-100,y:115,r:15}],captureRadius:8},
 {name:"終極星圖",desc:"最後的四道訊號，將三顆星球的航路連成完整星圖。",tip:"讓後兩層圓逆轉、外環正轉，完成最後的航道。",start:[ {r:115,d:1}, {r:76,d:1}, {r:62,d:1} ],refs:[ {r:115,d:1}, {r:76,d:-1}, {r:62,d:-1} ],times:[1,2.7,4.3,6.6],max:40,radius:18,hazards:[{x:-130,y:-185,r:15},{x:-130,y:-95,r:15},{x:20,y:-155,r:15}],captureRadius:8}
);
function trajectoryAt(t,wheels){let x=0,y=0;wheels.forEach((w,i)=>{const a=t*BASE*(i+1)*w.d;x+=w.r*Math.cos(a);y+=w.r*Math.sin(a)});return{x,y}}
for(const [i,l] of levels.entries()){l.goals=l.times.map(t=>trajectoryAt(t,l.refs));l.captureRadius=l.captureRadius??[10,9,9,8,8,8][i];}
root.ORBIT_LEVEL_DATA={levels,planets,PLANET_SIZE};
})(window);
