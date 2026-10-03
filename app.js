const SUPABASE_URL="https://sxoffjtlzpucqhuzutwg.supabase.co";
const SUPABASE_KEY="sb_publishable_40e-4_QgAuqbGZlNo9V-lw_3v26ZB_B";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let user=null,profile=null,activeShift=null,timerInt=null,formMode=null;

const $=id=>document.getElementById(id);
const toast=m=>{const t=$("toast");t.textContent=m;t.style.display="block";setTimeout(()=>t.style.display="none",3000)};
const isCommand=()=>["command","administrator"].includes(profile?.permission_level);

async function loadSession(){
 const {data}=await db.auth.getSession(); user=data.session?.user||null;
 if(user) await enterApp(); else showAuth();
}
function showAuth(){$("authView").classList.remove("hidden");$("appView").classList.add("hidden");$("logoutBtn").classList.add("hidden")}
async function enterApp(){
 $("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");
 const {data,error}=await db.from("personnel").select("*").eq("id",user.id).single();
 if(error){toast(error.message);return} profile=data; renderProfile(); await loadShift();
}
function renderProfile(){
 $("profileName").textContent=profile.display_name;
 $("profileCallsign").textContent=profile.callsign||"Pending Callsign";
 $("profileRank").textContent=profile.rank;
 $("profilePermission").textContent=profile.permission_level.toUpperCase();
 $("statusLamp").textContent=profile.duty_status;
 $("commandBtn").classList.toggle("hidden",!isCommand());
}
async function loadShift(){
 const {data}=await db.from("shifts").select("*").eq("trooper_id",user.id).is("clock_out",null).order("clock_in",{ascending:false}).limit(1);
 activeShift=data?.[0]||null; renderShift();
}
function renderShift(){
 $("clockInBtn").disabled=!!activeShift;$("clockOutBtn").disabled=!activeShift;
 document.querySelectorAll("[data-status]").forEach(b=>b.disabled=!activeShift);
 $("shiftHint").textContent=activeShift?"On duty — select your current status.":"Clock in to enable duty statuses.";
 clearInterval(timerInt);
 if(!activeShift){$("timer").textContent="00:00:00";return}
 const tick=()=>{let s=Math.max(0,Math.floor((Date.now()-new Date(activeShift.clock_in))/1000));$("timer").textContent=[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,"0")).join(":")};tick();timerInt=setInterval(tick,1000)
}
$("loginBtn").onclick=async()=>{const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error)return toast(error.message);user=data.user;await enterApp()};
$("showSignupBtn").onclick=()=> $("signupBox").classList.toggle("hidden");
$("signupBtn").onclick=async()=>{
 const name=$("displayName").value.trim(); if(!name)return toast("Enter your display name.");
 const {data,error}=await db.auth.signUp({email:$("email").value.trim(),password:$("password").value,options:{data:{display_name:name}}});
 if(error)return toast(error.message); toast(data.session?"Account created.":"Account created. Check your email if confirmation is enabled.");
 if(data.session){user=data.user;setTimeout(enterApp,500)}
};
$("logoutBtn").onclick=async()=>{await db.auth.signOut();user=profile=activeShift=null;clearInterval(timerInt);showAuth()};
$("clockInBtn").onclick=async()=>{const {data,error}=await db.from("shifts").insert({trooper_id:user.id}).select().single();if(error)return toast(error.message);activeShift=data;await setStatus("10-8");renderShift();toast("Clocked in.")};
$("clockOutBtn").onclick=async()=>{if(!activeShift)return;const {error}=await db.from("shifts").update({clock_out:new Date().toISOString()}).eq("id",activeShift.id);if(error)return toast(error.message);activeShift=null;await setStatus("10-7");renderShift();toast("Clocked out.")};
async function setStatus(s){
 if(!activeShift && s!=="10-7") return toast("Clock in before changing duty status.");
 const {error}=await db.rpc("set_my_duty_status",{p_status:s});
 if(error) return toast(error.message);
 profile.duty_status=s;
 $("statusLamp").textContent=s;
 toast(`Status updated: ${s}`);
}
document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>setStatus(b.dataset.status));

document.querySelectorAll("[data-report]").forEach(b=>b.onclick=()=>openForm("report",b.dataset.report));
$("trainingBtn").onclick=()=>openForm("request","Training Request");
$("leaveBtn").onclick=()=>openForm("request","Leave Request");
function openForm(mode,title){formMode={mode,title};$("formTitle").textContent=title;$("reportFields").classList.toggle("hidden",mode!=="report");$("details").value="";$("formCard").classList.remove("hidden");$("formCard").scrollIntoView({behavior:"smooth"})}
$("closeForm").onclick=()=> $("formCard").classList.add("hidden");
$("submitForm").onclick=async()=>{
 const details=$("details").value.trim();if(!details)return toast("Details are required.");
 let error;
 if(formMode.mode==="report")({error}=await db.from("reports").insert({trooper_id:user.id,report_type:formMode.title,location:$("reportLocation").value.trim()||null,subject:$("reportSubject").value.trim()||null,narrative:details}));
 else ({error}=await db.from("requests").insert({trooper_id:user.id,request_type:formMode.title,details}));
 if(error)return toast(error.message);$("formCard").classList.add("hidden");toast(formMode.mode==="report"?"Report submitted for Command review.":"Request submitted.");
};
$("commandBtn").onclick=async()=>{$("commandCard").classList.remove("hidden");await loadPending();$("commandCard").scrollIntoView({behavior:"smooth"})};
$("closeCommand").onclick=()=> $("commandCard").classList.add("hidden");
async function loadPending(){
 const {data,error}=await db.from("reports").select("id,report_type,location,subject,narrative,created_at").eq("review_status","pending").order("created_at");
 if(error){$("pendingReports").textContent=error.message;return}
 $("pendingReports").innerHTML=data.length?"":"No pending reports.";
 data.forEach(r=>{const d=document.createElement("div");d.className="report-item";d.innerHTML=`<strong>${escapeHtml(r.report_type)} #${r.id}</strong><small>${escapeHtml(r.location||"No location")} • ${new Date(r.created_at).toLocaleString()}</small><p>${escapeHtml(r.narrative)}</p><div class="cmd-actions"><button data-a="approve">Approve</button><button data-a="return">Return</button><button data-a="reject">Reject</button></div>`;d.querySelector('[data-a="approve"]').onclick=()=>review(r.id,"approve");d.querySelector('[data-a="return"]').onclick=()=>review(r.id,"return");d.querySelector('[data-a="reject"]').onclick=()=>review(r.id,"reject");$("pendingReports").appendChild(d)})
}
async function review(id,a){
 let error,data;
 if(a==="approve")({data,error}=await db.rpc("approve_report",{p_report_id:id}));
 else {const notes=prompt("Command notes (required):");if(!notes)return;({error}=await db.rpc(a==="return"?"return_report":"reject_report",{p_report_id:id,p_notes:notes}))}
 if(error)return toast(error.message);toast(a==="approve"?`Approved — ${data}`:`Report ${a}ed.`);await loadPending()
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
loadSession();