const KEY="smokeless_v1";
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

const defaultState={
  settings:{baseline:10,reduction:1,quitDate:"",prices:[13,25]},
  logs:[], cravings:{started:0,resisted:0,history:[]}, theme:"dark"
};
let state=load();
let timerId=null;
let gapTimerId=null;
let selectedCost=13;

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY));
    if(!x)return structuredClone(defaultState);
    const migrated={...defaultState,...x,settings:{...defaultState.settings,...x.settings},cravings:{...defaultState.cravings,...x.cravings}};
    if(!Array.isArray(migrated.settings.prices)){
      const old=Number(migrated.settings.price);
      migrated.settings.prices=Number.isFinite(old)&&old>0?[13,old]:[13,25];
    }
    migrated.logs=(migrated.logs||[]).map(l=>({...l,cost:Number(l.cost)||13}));
    return migrated;
  }catch{return structuredClone(defaultState)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function pad(n){return String(n).padStart(2,"0")}
function dateKey(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function fmtTime(ts){return new Date(ts).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}
function fmtDate(k){return new Date(k+"T12:00:00").toLocaleDateString([], {day:"numeric",month:"short"})}
function dayLogs(k=dateKey()){return state.logs.filter(x=>dateKey(new Date(x.ts))===k)}
function targetFor(k=dateKey()){
  const base=Number(state.settings.baseline)||10, red=Number(state.settings.reduction)||1;
  if(!state.settings.baseline)return base;
  const start=state.logs.length?dateKey(new Date(Math.min(...state.logs.map(x=>x.ts)))):dateKey();
  const days=Math.max(0,Math.floor((new Date(k+"T12:00:00")-new Date(start+"T12:00:00"))/86400000));
  const target=Math.max(0,base-days*red);
  if(state.settings.quitDate){
    const q=new Date(state.settings.quitDate+"T12:00:00"), now=new Date(k+"T12:00:00");
    if(now>=q)return 0;
  }
  return Math.max(0,Math.ceil(target));
}
function formatDuration(ms){
  if(!Number.isFinite(ms)||ms<0)return "—";
  const min=Math.floor(ms/60000), h=Math.floor(min/60);
  return h?`${h}h ${min%60}m`:`${min}m`;
}
function render(){
  document.body.classList.toggle("light",state.theme==="light");
  renderDailyThought();
  renderHome(); renderStats(); renderSettings();
}
const DAILY_THOUGHTS=[
  ["Delay, don't deny.","When a cigarette feels automatic, wait 5 minutes before deciding. A delay is already a win."],
  ["Protect your longest gap.","When you notice you've gone longer than usual, try to beat that interval by another 5–10 minutes."],
  ["Break the loop.","If you normally smoke after food, change what happens immediately afterward: walk, brush your teeth, or make a drink."],
  ["Don't compensate.","A lighter day doesn't need to be repaid tomorrow. Keep moving forward from where you are."],
  ["Name the trigger.","Before lighting up, ask: “What am I actually responding to?” Stress, boredom and habit can feel like the same craving."],
  ["Add a little friction.","Keep cigarettes somewhere less convenient. Even a few extra steps can interrupt an automatic decision."],
  ["One cigarette isn't the day.","If you smoke one you didn't plan to, log it and continue. The next decision still counts."],
  ["Cravings peak and pass.","You don't have to make a craving disappear. Give it time to rise, change and come back down."],
  ["Fewer is progress.","You don't need a perfect day for reduction to work. Every cigarette you don't smoke is one less."],
  ["Beat yesterday by a little.","Try extending just one interval today. Ten extra minutes is useful practice."],
  ["Change the scenery.","If a particular place always leads to smoking, spend the first few craving minutes somewhere else."],
  ["Make the next one a decision.","Before smoking, pause long enough to choose rather than letting the routine choose for you."],
  ["Track the wins you don't see.","A resisted craving and a longer gap are progress even if the cigarette count looks similar."],
  ["Don't chase a perfect streak.","The goal is to build more control, not to punish yourself for slipping."],
  ["Use the app before the cigarette.","If you can, hit the craving timer first. Give yourself five minutes between the urge and the decision."]
];
function renderDailyThought(){
  const dayNumber=Math.floor((new Date().setHours(0,0,0,0)-new Date("2026-01-01T00:00:00"))/86400000);
  const [title,tip]=DAILY_THOUGHTS[((dayNumber%DAILY_THOUGHTS.length)+DAILY_THOUGHTS.length)%DAILY_THOUGHTS.length];
  $("#dailyThought").textContent=title;
  $("#dailyTip").textContent=tip;
}

function renderHome(){
  const logs=dayLogs(), target=targetFor();
  $("#todayCount").textContent=logs.length;
  $("#todayTarget").textContent=`/ ${target}`;
  const pct=target===0?(logs.length?100:0):Math.min(100,logs.length/target*100);
  $("#progressBar").style.width=pct+"%";
  const pill=$("#statusPill");
  if(target===0) {pill.textContent=logs.length?"Over quit target":"Quit day";pill.style.color=logs.length?"#ff9a9a":"var(--accent2)";}
  else if(logs.length<target){pill.textContent=`${target-logs.length} left`;pill.style.color="";}
  else {pill.textContent=logs.length===target?"At target":"Over target";pill.style.color=logs.length>target?"#ff9a9a":"";}
  if(logs.length){
    const last=logs.at(-1);
    $("#lastSmoke").textContent=`Last: ${fmtTime(last.ts)}`;
    if(logs.length>1) $("#intervalText").textContent=`Previous gap: ${formatDuration(logs.at(-1).ts-logs.at(-2).ts)}`;
    else $("#intervalText").textContent="Gap: 0m";
  }else{$("#lastSmoke").textContent="No cigarettes logged today";$("#intervalText").textContent="—"}
  startGapTimer();
  $("#streak").textContent=streak()+" days";
  $("#longestGap").textContent=formatDuration(longestGap());
  const list=$("#todayList"); list.innerHTML="";
  if(!logs.length){list.innerHTML='<div class="muted" style="font-size:13px;padding:8px 0">Nothing logged yet. That’s the point — keep it going.</div>'}
  logs.slice().reverse().forEach((x,i)=>{
    const row=document.createElement("div");row.className="log-row";
    row.innerHTML=`<div class="log-left"><span class="dot"></span><div><b>${fmtTime(x.ts)}</b><div class="muted">${x.trigger||"No trigger recorded"}</div></div></div><div class="log-detail">₹${x.cost||"—"} · Craving ${x.intensity||"—"}/5</div>`;
    row.onclick=()=>alert(`${new Date(x.ts).toLocaleString()}
Trigger: ${x.trigger||"—"}
Cost: ₹${x.cost||"—"}
Craving: ${x.intensity||"—"}/5${x.note?`
Note: ${x.note}`:""}`);
    list.appendChild(row);
  });
}
function streak(){
  // A streak requires a day to have actually been tracked.
  // Never count untracked/empty days as successful days.
  let n=0, d=new Date(); d.setHours(12,0,0,0);
  while(true){
    const k=dateKey(d), logs=dayLogs(k);
    if(!logs.length) break;
    if(logs.length<=targetFor(k)){ n++; d.setDate(d.getDate()-1); }
    else break;
  }
  return n;
}
function startGapTimer(){
  clearInterval(gapTimerId);
  const all=state.logs.slice().sort((a,b)=>a.ts-b.ts);
  const last=all.at(-1);
  const el=$("#longestGap");
  if(!last){el.textContent="—";return;}
  const tick=()=>{
    const live=Date.now()-last.ts;
    const historical=longestGap();
    el.textContent=formatDuration(Math.max(live,historical));
  };
  tick();
  gapTimerId=setInterval(tick,1000);
}
function longestGap(){
  const a=state.logs.slice().sort((x,y)=>x.ts-y.ts); let max=0;
  for(let i=1;i<a.length;i++)max=Math.max(max,a[i].ts-a[i-1].ts);
  return max;
}
function renderStats(){
  const days=lastDays(14), max=Math.max(1,...days.map(x=>x.count));
  $("#chart").innerHTML=days.map(x=>`<div class="bar-col"><span class="bar-value">${x.count}</span><div class="bar" style="height:${Math.max(2,x.count/max*145)}px"></div><span class="bar-label">${x.label}</span></div>`).join("");
  $("#totalLogged").textContent=state.logs.length;
  if(state.logs.length){
    const first=Math.min(...state.logs.map(x=>x.ts)), daysSince=Math.max(1,Math.ceil((Date.now()-first)/86400000)+1);
    $("#avgDaily").textContent=(state.logs.length/daysSince).toFixed(1);
  }else $("#avgDaily").textContent="0";
  $("#resisted").textContent=state.cravings.resisted||0;
  $("#avoided").textContent=estimateAvoided();
  const spent=state.logs.reduce((sum,x)=>sum+(Number(x.cost)||13),0);
  const c13=state.logs.filter(x=>Number(x.cost)===13).length;
  const c25=state.logs.filter(x=>Number(x.cost)===25).length;
  $("#costSummary").innerHTML=`<div class="history-row"><span>Total spent</span><b>₹${spent.toFixed(2)}</b></div><div class="history-row"><span>₹13 cigarettes</span><span>${c13}</span></div><div class="history-row"><span>₹25 cigarettes</span><span>${c25}</span></div>`;
  const counts={};state.logs.forEach(x=>{if(x.trigger)counts[x.trigger]=(counts[x.trigger]||0)+1});
  const arr=Object.entries(counts).sort((a,b)=>b[1]-a[1]), total=Math.max(1,state.logs.length);
  $("#triggers").innerHTML=arr.length?arr.slice(0,8).map(([k,v])=>`<div class="trigger-row"><span>${k}</span><div class="trigger-track"><div style="width:${v/Math.max(...arr.map(a=>a[1]))*100}%"></div></div><b>${v}</b></div>`).join(""):'<span class="muted">No trigger data yet.</span>';
  const hist=state.logs.slice().sort((a,b)=>b.ts-a.ts).slice(0,12);
  $("#history").innerHTML=hist.length?hist.map(x=>`<div class="history-row"><span>${fmtDate(dateKey(new Date(x.ts)))} · ${fmtTime(x.ts)}</span><span>${x.trigger||"—"}</span></div>`).join(""):'<span class="muted">No history yet.</span>';
}
function lastDays(n){
  const out=[];for(let i=n-1;i>=0;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);const k=dateKey(d);out.push({key:k,count:dayLogs(k).length,label:d.toLocaleDateString([], {weekday:"short"}).slice(0,2)})}return out;
}
function estimateAvoided(){
  const base=Number(state.settings.baseline)||0;if(!base||!state.logs.length)return 0;
  const first=Math.min(...state.logs.map(x=>x.ts)), days=Math.max(1,Math.ceil((Date.now()-first)/86400000)+1);
  return Math.max(0,Math.round(base*days-state.logs.length));
}
function renderSettings(){
  $("#baseline").value=state.settings.baseline;
  $("#reduction").value=state.settings.reduction;
  $("#quitDate").value=state.settings.quitDate||"";
  $("#price13").value=(state.settings.prices||[13,25])[0] ?? 13;
  $("#price25").value=(state.settings.prices||[13,25])[1] ?? 25;
}
function openModal(){
  $("#modal").classList.remove("hidden"); $("#trigger").value="";$("#intensity").value=3;
  $("#intensityValue").textContent=3;$("#note").value="";
  const prices=state.settings.prices||[13,25];
  selectedCost=prices[0]||13;
  updateCostButtons();
}
function closeModal(){$("#modal").classList.add("hidden")}
function addSmoke(extra={}){
  state.logs.push({ts:Date.now(),trigger:extra.trigger||"",intensity:Number(extra.intensity||3),note:extra.note||"",cost:Number(extra.cost||selectedCost)||13});
  state.logs.sort((a,b)=>a.ts-b.ts);save();render();closeModal();
}
function startCraving(){
  state.cravings.started=(state.cravings.started||0)+1;state.cravings.history.push({ts:Date.now(),result:"started"});save();
  $("#cravingIdle").classList.add("hidden");$("#cravingActive").classList.remove("hidden");
  let end=Date.now()+300000;
  const tick=()=>{const left=Math.max(0,end-Date.now()),s=Math.ceil(left/1000),m=Math.floor(s/60),sec=s%60;$("#timer").textContent=`${m}:${pad(sec)}`;if(left<=0){clearInterval(timerId);$("#timer").textContent="0:00";} };
  clearInterval(timerId);tick();timerId=setInterval(tick,250);
}
function finishCraving(resisted){
  clearInterval(timerId);
  if(resisted)state.cravings.resisted=(state.cravings.resisted||0)+1;
  state.cravings.history.push({ts:Date.now(),result:resisted?"resisted":"smoked"});save();
  $("#cravingActive").classList.add("hidden");$("#cravingIdle").classList.remove("hidden");render();
  if(!resisted)openModal();
}
function exportFile(name,content,type){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportJson(){exportFile("smokeless-backup.json",JSON.stringify(state,null,2),"application/json")}
function csvEscape(v){return `"${String(v??"").replaceAll('"','""')}"`}
function exportCsv(){
  const rows=[["timestamp","date","time","cost","trigger","craving_intensity","note"]];
  state.logs.forEach(x=>rows.push([new Date(x.ts).toISOString(),dateKey(new Date(x.ts)),fmtTime(x.ts),x.cost,x.trigger,x.intensity,x.note]));
  exportFile("smokeless-cigarettes.csv",rows.map(r=>r.map(csvEscape).join(",")).join("\n"),"text/csv")
}
$("#smokedBtn").onclick=openModal;
$("#closeModal").onclick=closeModal;
$(".modal-backdrop").onclick=closeModal;
$("#saveSmoke").onclick=()=>addSmoke({trigger:$("#trigger").value,intensity:$("#intensity").value,note:$("#note").value.trim(),cost:selectedCost});
$("#cost13").onclick=()=>{selectedCost=Number((state.settings.prices||[13,25])[0]||13);updateCostButtons()};
$("#cost25").onclick=()=>{selectedCost=Number((state.settings.prices||[13,25])[1]||25);updateCostButtons()};
function updateCostButtons(){
  const [a,b]=state.settings.prices||[13,25];
  $("#cost13").textContent=`₹${a}`; $("#cost25").textContent=`₹${b}`;
  $("#cost13").style.borderColor=selectedCost===a?"var(--accent)":"";
  $("#cost25").style.borderColor=selectedCost===b?"var(--accent)":"";
}
$("#intensity").oninput=e=>$("#intensityValue").textContent=e.target.value;
$("#cravingBtn").onclick=startCraving;
$("#cravingSmoked").onclick=()=>finishCraving(false);
$("#cravingResisted").onclick=()=>finishCraving(true);
$("#themeBtn").onclick=()=>{state.theme=state.theme==="dark"?"light":"dark";save();render()};
$("#saveSettings").onclick=()=>{
  state.settings.baseline=Math.max(1,Number($("#baseline").value)||10);
  state.settings.reduction=Number($("#reduction").value)||1;
  state.settings.quitDate=$("#quitDate").value;
  state.settings.prices=[
    Math.max(0,Number($("#price13").value)||13),
    Math.max(0,Number($("#price25").value)||25)
  ];
  save();render();alert("Plan saved.");
};
$("#exportJson").onclick=exportJson;$("#exportCsv").onclick=exportCsv;
$("#importJson").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const x=JSON.parse(await f.text());if(!x.logs||!x.settings)throw Error();state=x;save();render();alert("Backup imported.");}catch{alert("That file doesn't look like a SmokeLess backup.")}e.target.value="";
};
$("#clearData").onclick=()=>{if(confirm("Delete all SmokeLess data from this browser? Export a backup first if you need it.")){localStorage.removeItem(KEY);state=structuredClone(defaultState);save();render()}};
$$(".nav-btn").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$$(".back-home").forEach(b=>b.onclick=()=>showTab("home"));
function showTab(tab){
  $("#statsTab").classList.toggle("hidden",tab!=="stats");$("#settingsTab").classList.toggle("hidden",tab!=="settings");
  document.querySelector(".app-shell").classList.toggle("hidden",tab!=="home");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  window.scrollTo(0,0);
}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
render();
