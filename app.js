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
$("clockOutBtn").onclick=async()=>{
 if(!activeShift)return;
 const {error}=await db.rpc("clock_out");
 if(error)return toast(error.message);
 activeShift=null;
 profile.duty_status="10-7";
 $("statusLamp").textContent="10-7";
 renderShift();
 toast("Clocked out securely.");
};
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
document.querySelectorAll("[data-cmdtab]").forEach(b=>b.onclick=async()=>{
 document.querySelectorAll(".cmdtab").forEach(x=>x.classList.remove("active")); b.classList.add("active");
 document.querySelectorAll(".cmdpane").forEach(x=>x.classList.add("hidden"));
 const t=b.dataset.cmdtab; $("cmd"+t[0].toUpperCase()+t.slice(1)).classList.remove("hidden");
 if(t==="personnel") await loadPersonnel();
 if(t==="shifts") await loadCommandShifts();
 if(t==="requests") await loadRequests();
 if(t==="audit") await loadAudit();
});
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

async function loadPersonnel(){
 const {data,error}=await db.from("personnel").select("*").order("rank");
 if(error){$("personnelList").textContent=error.message;return}
 $("personnelList").innerHTML="";
 data.forEach(p=>{
  const d=document.createElement("div"); d.className="person-card";
  d.innerHTML=`<div class="person-top"><div><h3>${escapeHtml(p.display_name)}</h3><span class="tag">${escapeHtml(p.callsign||"NO CALLSIGN")}</span><span class="tag">${escapeHtml(p.rank)}</span></div><span class="mini">${escapeHtml(p.account_status)}</span></div>
  <div class="person-grid">
  <input data-f="callsign" value="${escapeHtml(p.callsign||"")}" placeholder="Callsign">
  <button data-save="callsign">Save Callsign</button>
  <input data-f="rank" value="${escapeHtml(p.rank||"")}" placeholder="Rank">
  <input data-f="division" value="${escapeHtml(p.division||"")}" placeholder="Division">
  <button data-save="rank" class="gold">Save Rank / Division</button>
  <select data-f="permission">
    ${["trooper","supervisor","command","administrator"].map(x=>`<option value="${x}" ${p.permission_level===x?"selected":""}>${x.toUpperCase()}</option>`).join("")}
  </select>
  <button data-save="permission">Save Permission</button>
  <select data-f="status">
    ${["active","inactive","suspended"].map(x=>`<option value="${x}" ${p.account_status===x?"selected":""}>${x.toUpperCase()}</option>`).join("")}
  </select>
  <button data-save="status" class="danger">Save Account Status</button>
</div>`;
  d.querySelector('[data-save="callsign"]').onclick=async()=>{const v=d.querySelector('[data-f="callsign"]').value;const {error}=await db.rpc("set_callsign",{p_user_id:p.id,p_callsign:v});if(error)return toast(error.message);toast("Callsign updated.");await loadPersonnel()};
  d.querySelector('[data-save="rank"]').onclick=async()=>{const r=d.querySelector('[data-f="rank"]').value,v=d.querySelector('[data-f="division"]').value;const {error}=await db.rpc("set_rank_division",{p_user_id:p.id,p_rank:r,p_division:v});if(error)return toast(error.message);toast("Rank/division updated.");await loadPersonnel()};
  d.querySelector('[data-save="permission"]').onclick=async()=>{
   const v=d.querySelector('[data-f="permission"]').value;
   if(p.id===user.id && v!=="administrator" && !confirm("This changes your own administrator permission. Continue?")) return;
   const {error}=await db.rpc("set_permission",{p_user_id:p.id,p_permission:v});
   if(error)return toast(error.message); toast("Permission updated."); await loadPersonnel();
  };
  d.querySelector('[data-save="status"]').onclick=async()=>{
   const v=d.querySelector('[data-f="status"]').value;
   if(p.id===user.id && v!=="active" && !confirm("This changes your own account status and may remove Command access. Continue?")) return;
   const {error}=await db.rpc("set_account_status",{p_user_id:p.id,p_status:v});
   if(error)return toast(error.message); toast("Account status updated."); await loadPersonnel();
  };
  $("personnelList").appendChild(d)
 })
}
async function loadCommandShifts(){
 const {data,error}=await db.from("shifts").select("id,trooper_id,clock_in,clock_out,corrected").order("clock_in",{ascending:false}).limit(50);
 if(error){$("shiftList").textContent=error.message;return}
 $("shiftList").innerHTML=data.length?"":"No shifts recorded.";
 data.forEach(s=>{const d=document.createElement("div");d.className="history-card";const who=s.trooper_id===user.id?profile.display_name:s.trooper_id.slice(0,8);d.innerHTML=`<strong>${escapeHtml(who)}</strong><br><small>IN: ${new Date(s.clock_in).toLocaleString()}<br>OUT: ${s.clock_out?new Date(s.clock_out).toLocaleString():"ACTIVE"}${s.corrected?" • CORRECTED":""}</small>`;$("shiftList").appendChild(d)})
}
async function loadRequests(){
 const {data,error}=await db.from("requests").select("*").order("created_at",{ascending:false}).limit(50);
 if(error){$("requestList").textContent=error.message;return}
 $("requestList").innerHTML=data.length?"":"No requests.";
 data.forEach(r=>{
 const d=document.createElement("div"); d.className="history-card";
 d.innerHTML=`<strong>${escapeHtml(r.request_type)}</strong> <span class="tag">${escapeHtml(r.status)}</span><p>${escapeHtml(r.details)}</p><small>${new Date(r.created_at).toLocaleString()}</small>`;
 if(r.status==="pending"){
  const actions=document.createElement("div"); actions.className="cmd-actions";
  const approve=document.createElement("button"); approve.textContent="Approve";
  const reject=document.createElement("button"); reject.textContent="Reject";
  approve.onclick=async()=>{const {error}=await db.rpc("approve_request",{p_request_id:r.id});if(error)return toast(error.message);toast("Request approved.");await loadRequests()};
  reject.onclick=async()=>{const notes=prompt("Command notes (required):");if(!notes)return;const {error}=await db.rpc("reject_request",{p_request_id:r.id,p_notes:notes});if(error)return toast(error.message);toast("Request rejected.");await loadRequests()};
  actions.append(approve,reject); d.appendChild(actions);
 }
 $("requestList").appendChild(d)
})
}
async function loadAudit(){
 const {data,error}=await db.from("audit_log").select("*").order("created_at",{ascending:false}).limit(50);
 if(error){$("auditList").textContent=error.message;return}
 $("auditList").innerHTML=data.length?"":"No audit entries.";
 data.forEach(a=>{const d=document.createElement("div");d.className="history-card";d.innerHTML=`<strong>${escapeHtml(a.action)}</strong><br><small>${escapeHtml(a.target_type||"system")} • ${new Date(a.created_at).toLocaleString()}</small>`;$("auditList").appendChild(d)})
}

loadSession();