const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const pageNames={dashboard:"داشبورد",groups:"گروه‌های من",room:"اتاق مطالعه",chat:"گفت‌وگوی گروهی",reports:"گزارش‌ها",profile:"پروفایل",settings:"تنظیمات"};
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function go(page){$$(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#crumbTitle").textContent=pageNames[page]||"داشبورد";$("#sidebar").classList.remove("open");}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
function setTheme(){document.body.classList.toggle("dark");localStorage.setItem("pansion-theme",document.body.classList.contains("dark")?"dark":"light")}
if(localStorage.getItem("pansion-theme")==="dark")document.body.classList.add("dark");
$("#themeBtn").onclick=setTheme;$("#themeBtn2").onclick=setTheme;
$("#today").textContent=new Intl.DateTimeFormat("fa-IR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
let seconds=0,interval=null,sessions=0,grace=15;
const fmt=n=>{let h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":").replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d])};
function updateTimer(){let v=fmt(seconds);$("#timer").textContent=v;$("#todayStudy").textContent=v;$("#reportTotal").textContent=v}
function run(){if(interval)return;interval=setInterval(()=>{seconds++;updateTimer()},1000);$("#timerStatus").textContent="در حال مطالعه";$(".pulse").classList.add("active");$("#startTimer").disabled=true;$("#pauseTimer").disabled=false;$("#finishTimer").disabled=false;$("#timerNote").textContent="جلسه در حال ثبت زمان است."}
function pause(){clearInterval(interval);interval=null;$("#timerStatus").textContent="متوقف شده";$(".pulse").classList.remove("active");$("#startTimer").disabled=false;$("#startTimer").textContent="ادامه مطالعه";$("#pauseTimer").disabled=true;$("#timerNote").textContent="تایمر متوقف شد؛ با زدن ادامه مطالعه، زمان‌گیری از سر گرفته می‌شود."}
$("#startTimer").onclick=run;$("#pauseTimer").onclick=pause;
$("#finishTimer").onclick=()=>{if(seconds===0){toast("هنوز زمانی ثبت نشده.");return}pause();sessions++;$("#reportSessions").textContent=String(sessions).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d]);$("#startTimer").textContent="شروع مطالعه";$("#timerStatus").textContent="جلسه پایان یافت";$("#timerNote").textContent="جلسه نمایشی پایان یافت. زمان در همین مرورگر باقی می‌ماند.";toast("جلسه مطالعه پایان یافت.");};
let stream=null;
$("#cameraBtn").onclick=async()=>{try{stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});$("#video").srcObject=stream;$("#video").style.display="block";$(".camera-placeholder").style.display="none";$("#cameraState").textContent="فعال";$("#cameraBtn").disabled=true;$("#cameraOff").disabled=false;toast("دوربین فعال شد. تشخیص خودکار هنوز فعال نیست.");}catch(e){toast("دسترسی دوربین ممکن نشد؛ مجوز مرورگر را بررسی کن.")}};
function stopCamera(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;$("#video").srcObject=null;$("#video").style.display="none";$(".camera-placeholder").style.display="grid";$("#cameraState").textContent="خاموش";$("#cameraBtn").disabled=false;$("#cameraOff").disabled=true}
$("#cameraOff").onclick=stopCamera;window.addEventListener("beforeunload",stopCamera);
$("#graceSelect").onchange=e=>{grace=Number(e.target.value);toast("زمان انتظار روی "+grace+" ثانیه تنظیم شد.")};
$("#createGroup").onclick=()=>{const name=prompt("نام گروه جدید را وارد کن:");if(!name||!name.trim())return;const card=document.createElement("article");card.className="group-card";card.dataset.type="private";card.innerHTML='<div class="card-top"><div class="group-symbol violet">گ</div><span class="tag private">خصوصی</span></div><h3></h3><p>گروه تازه ساخته‌شده در نسخه نمایشی.</p><div class="card-meta">♧ ۱ عضو <span>◉ ۱ نفر فعال</span></div><button class="outline-btn" data-go="room">مشاهده اتاق</button>';card.querySelector("h3").textContent=name.trim();$("#groupsGrid").append(card);card.querySelector("[data-go]").onclick=()=>go("room");toast("گروه در نسخه نمایشی ساخته شد.")};
$("#groupSearch").oninput=filterGroups;$("#groupFilter").onchange=filterGroups;
function filterGroups(){let q=$("#groupSearch").value.trim();let f=$("#groupFilter").value;$$(".group-card").forEach(c=>c.style.display=(c.textContent.includes(q)&&(f==="all"||c.dataset.type===f))?"":"none")}
$("#chatForm").onsubmit=e=>{e.preventDefault();let val=$("#chatInput").value.trim();if(!val)return;let m=document.createElement("div");m.className="message mine";let av=document.createElement("span");av.className="member-avatar a2";av.textContent="م";let body=document.createElement("div"),b=document.createElement("b"),p=document.createElement("p"),sm=document.createElement("small");b.textContent="شما";p.textContent=val;sm.textContent=new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(new Date());body.append(b,p,sm);m.append(av,body);$("#messages").append(m);$("#chatInput").value="";$("#messages").scrollTop=$("#messages").scrollHeight};
updateTimer();$("#reportSessions").textContent="۰";
