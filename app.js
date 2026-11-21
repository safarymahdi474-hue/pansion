const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const pageNames={home:"نمای کلی",groups:"گروه‌های من",focus:"تمرکز",stats:"آمار مطالعه",settings:"تنظیمات"};
function go(page){$$(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));$$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#pageTitle").textContent=pageNames[page]||"نمای کلی";$("#sidebar").classList.remove("open")}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2500)}
const todayText=new Intl.DateTimeFormat("fa-IR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());$("#today").textContent=todayText;

const media=window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(mode){const actual=mode==="system"?(media.matches?"dark":"light"):mode;document.body.dataset.theme=actual;localStorage.setItem("pansion-theme-choice",mode);$$(".theme-option").forEach(b=>b.classList.toggle("selected",b.dataset.theme===mode))}
let themeChoice=localStorage.getItem("pansion-theme-choice")||"dark";applyTheme(themeChoice);
$$(".theme-option").forEach(b=>b.addEventListener("click",()=>applyTheme(b.dataset.theme)));
$("#quickTheme").addEventListener("click",()=>applyTheme(document.body.dataset.theme==="dark"?"light":"dark"));
media.addEventListener?.("change",()=>{if((localStorage.getItem("pansion-theme-choice")||"dark")==="system")applyTheme("system")});

const toFa=n=>String(n).padStart(2,"0").replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d]);
let elapsed=0, interval=null, startedAt=0, running=false;
function renderTimer(){const mins=Math.floor(elapsed/60),secs=elapsed%60;const value=toFa(mins)+":"+toFa(secs);$("#timer").textContent=value;$("#timer2").textContent=value;$("#todayTotal").textContent=toFa(Math.floor(elapsed/3600))+":"+toFa(Math.floor(elapsed%3600/60))+":"+toFa(elapsed%60);$("#timerState").textContent=running?"در حال تمرکز":"آماده‌ای؟";$("#timerState2").textContent=running?"در حال تمرکز":"آماده شروع";const deg=Math.min(360,(elapsed%1500)/1500*360);$("#timerRing").style.background=`conic-gradient(var(--accent) ${deg}deg,var(--surface3) ${deg}deg)`;$("#timerRing2").style.background=`conic-gradient(var(--accent) ${deg}deg,var(--surface3) ${deg}deg)`;["pauseTimer","pauseTimer2"].forEach(id=>$("#"+id).disabled=!running);["startTimer","startTimer2"].forEach(id=>$("#"+id).disabled=running);["resetTimer","resetTimer2"].forEach(id=>$("#"+id).disabled=elapsed===0&&!running)}
function start(){if(running)return;running=true;startedAt=Date.now()-elapsed*1000;interval=setInterval(()=>{elapsed=Math.floor((Date.now()-startedAt)/1000);renderTimer()},500);renderTimer()}
function pause(){if(!running)return;elapsed=Math.floor((Date.now()-startedAt)/1000);running=false;clearInterval(interval);renderTimer()}
function finish(){pause();if(elapsed>0){toast("جلسه در این نمونه پایان یافت؛ هنوز در حساب ابری ذخیره نمی‌شود.")}elapsed=0;renderTimer()}
["startTimer","startTimer2"].forEach(id=>$("#"+id).addEventListener("click",start));
["pauseTimer","pauseTimer2"].forEach(id=>$("#"+id).addEventListener("click",pause));
["resetTimer","resetTimer2"].forEach(id=>$("#"+id).addEventListener("click",finish));
renderTimer();

let groups=[];try{groups=JSON.parse(localStorage.getItem("pansion-groups")||"[]")}catch{groups=[]}
function renderGroups(){const list=$("#groupsList");list.innerHTML="";groups.forEach(g=>{const card=document.createElement("article");card.className="group-item";const info=document.createElement("div");const name=document.createElement("b");name.textContent=g.name;const meta=document.createElement("small");meta.textContent="ساخته‌شده در همین مرورگر";info.append(name,meta);const access=document.createElement("span");access.className="group-access";access.textContent=g.access==="public"?"عمومی · محلی":"خصوصی · محلی";card.append(info,access);list.append(card)});$("#groupsEmpty").hidden=groups.length>0;$("#groupCount").textContent=toFa(groups.length)}
function openModal(){$("#groupModal").hidden=false;$("#groupName").focus()}
function closeModal(){$("#groupModal").hidden=true;$("#groupForm").reset()}
["createGroup","createGroupEmpty","createGroupHome"].forEach(id=>$("#"+id).addEventListener("click",openModal));
$("#closeModal").addEventListener("click",closeModal);$("#cancelModal").addEventListener("click",closeModal);
$("#groupModal").addEventListener("click",e=>{if(e.target===$("#groupModal"))closeModal()});
$("#groupForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#groupName").value.trim();if(!name)return;groups.push({name,access:$("#groupAccess").value});localStorage.setItem("pansion-groups",JSON.stringify(groups));renderGroups();closeModal();go("groups");toast("گروه در همین مرورگر ایجاد شد.")});
renderGroups();
