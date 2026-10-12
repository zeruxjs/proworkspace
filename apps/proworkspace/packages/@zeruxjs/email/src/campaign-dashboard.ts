import type {CampaignPlanner,CampaignDefinition} from './campaigns.js';
export interface CampaignDashboardOptions {
  planner:CampaignPlanner;
  authorize:(request:Request)=>unknown|Promise<unknown>;
  verifyCsrf:(request:Request,principal:unknown)=>boolean|Promise<boolean>;
  csrfToken:(request:Request,principal:unknown)=>string|Promise<string>;
  /** Mandatory per-campaign access check (tenant and role separation). */
  authorizeCampaign:(principal:unknown,id:string,action:string)=>boolean|Promise<boolean>;
  prefix?:string;publicOrigin?:string;
}
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY','x-content-type-options':'nosniff','vary':'Cookie',
  'content-security-policy':"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
const html=(body:string,type='text/html; charset=utf-8')=>new Response(body,{headers:{...headers,'content-type':type}});
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function body(request:Request):Promise<Record<string,unknown>>{
  if(!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type')??''))throw new TypeError('JSON body required');
  const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>12_288))throw new RangeError('Body too large');
  const reader=request.body?.getReader();if(!reader)throw new TypeError('Body required');
  const chunks:Buffer[]=[];let size=0,timeout=false;
  const timer=setTimeout(()=>{timeout=true;void reader.cancel().catch(()=>{});},5000);timer.unref?.();
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12_288){await reader.cancel().catch(()=>{});throw new RangeError('Body too large');}chunks.push(Buffer.from(value));}}
  finally{clearTimeout(timer);reader.releaseLock();}
  if(timeout)throw new Error('Body timed out');
  const decoded=JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))throw new TypeError('Invalid JSON');
  return decoded as Record<string,unknown>;
}
const js=String.raw`'use strict';
const root=document.currentScript.dataset.root;const csrf=document.querySelector('meta[name="csrf"]')?.content;
const $=id=>document.getElementById(id);const note=(s)=>{$('status').textContent=s};
const show=(rec)=>{$('record').textContent=JSON.stringify(rec,null,2)};
async function call(op,method='GET',payload){const url=root+'/api'+(method==='GET'?'?id='+encodeURIComponent($('id').value):'');const r=await fetch(url,{method,credentials:'same-origin',headers:payload?{'content-type':'application/json','x-csrf-token':csrf}:{},body:payload?JSON.stringify({action:op,...payload}):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
$('load').onclick=async()=>{try{show(await call('', 'GET'));note('Loaded')}catch(e){note(e.message)}};
$('create').onclick=async()=>{try{const id=$('id').value;show(await call('create','POST',{id,name:$('name').value,sendAt:Date.parse($('time').value),segment:$('segment').value?JSON.parse($('segment').value):undefined,tracking:$('track').checked?{enabled:true,opens:$('opens').checked,clicks:$('clicks').checked}:undefined}));note('Draft created')}catch(e){note(e.message)}};
for(const op of ['schedule','pause','resume','cancel'])$(op).onclick=async()=>{try{show(await call(op,'POST',{id:$('id').value}));note(op+' completed')}catch(e){note(e.message)}};
`;
const css='body{font:16px system-ui,sans-serif;max-width:850px;margin:auto;padding:25px;color:#17202b;background:#f8fafc}main{display:grid;gap:15px}section{background:white;border:1px solid #d7dfe6;border-radius:10px;padding:18px}label{display:block;margin:8px 0}input{min-width:210px;padding:8px;margin-left:12px}button{padding:9px;margin:4px;cursor:pointer}pre{max-height:400px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}#status{min-height:20px}';
/** Optional session-authenticated campaign console. No default auth or public route. */
export function createCampaignDashboard(options:CampaignDashboardOptions){
  if(!options||!options.planner||typeof options.authorize!=='function'||typeof options.verifyCsrf!=='function'||typeof options.csrfToken!=='function'||typeof options.authorizeCampaign!=='function')throw new TypeError('Campaign dashboard requires session auth, scoped permissions and CSRF');
  const prefix=options.prefix??'/_email/campaigns';
  if(!/^\/[A-Za-z0-9/_-]{2,100}$/.test(prefix)||prefix.includes('//')||prefix.endsWith('/')||prefix.includes('..'))throw new TypeError('Invalid campaign dashboard prefix');
  let origin:string|undefined;
  if(options.publicOrigin){const u=new URL(options.publicOrigin);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new TypeError('Invalid public origin');origin=u.origin;}
  async function handle(request:Request):Promise<Response>{
    if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
    let principal:unknown;
    try{principal=await options.authorize(request);}catch{return json({error:'Forbidden'},403);}
    if(principal===true||principal===false||principal===null||principal===undefined)return json({error:'Forbidden'},403);
    const u=new URL(request.url);const suffix=u.pathname.slice(prefix.length);
    if(suffix===''&&request.method==='GET'){
      let token;try{token=await options.csrfToken(request,principal);}catch{return json({error:'Forbidden'},403);}
      if(typeof token!=='string'||token.length<16||token.length>512)return json({error:'Forbidden'},403);
      return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="csrf" content="${escape(token)}"><link rel="stylesheet" href="${prefix}/app.css"><title>Zerux Email Campaigns</title></head><body><main><h1>Campaign administration</h1><p>Recipient data and email bodies are stored outside the queue. Planning requires explicitly scheduled campaigns.</p><section><label>Campaign ID <input id="id" maxlength="96" required></label><button id="load">Load</button><label>Name <input id="name" maxlength="120"></label><label>Send at (local time) <input id="time" type="datetime-local"></label><label>Audience segment (JSON, optional) <textarea id="segment" rows="3" cols="55" placeholder='{"all":[{"field":"region","operator":"eq","value":"AU"}]}'></textarea></label><label><input type="checkbox" id="track"> Track activity (independently opt-in)</label><label><input type="checkbox" id="opens"> Opens</label><label><input type="checkbox" id="clicks"> Clicks</label><button id="create">Create draft</button></section><section><h2>Control</h2><button id="schedule">Schedule</button><button id="pause">Pause</button><button id="resume">Resume</button><button id="cancel">Cancel</button></section><p role="status" id="status"></p><section><h2>Checkpoint</h2><pre id="record"></pre></section></main><script defer data-root="${prefix}" src="${prefix}/app.js"></script></body></html>`);
    }
    if(suffix==='/app.js'&&request.method==='GET')return html(js,'text/javascript; charset=utf-8');
    if(suffix==='/app.css'&&request.method==='GET')return html(css,'text/css; charset=utf-8');
    if(suffix!=='/api')return json({error:'Not found'},404);
    if(request.method==='GET'){
      const id=u.searchParams.get('id')??'';
      if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(id))return json({error:'Invalid campaign'},400);
      try{if(await options.authorizeCampaign(principal,id,'read')!==true)return json({error:'Forbidden'},403);}catch{return json({error:'Forbidden'},403);}
      try{const value=await options.planner.get(id);return value?json(publicState(value)):json({error:'Not found'},404);}catch{return json({error:'Campaign store unavailable'},503);}
    }
    if(request.headers.get('origin')!==(origin??u.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Invalid origin'},403);
    try{if(await options.verifyCsrf(request,principal)!==true)return json({error:'Forbidden'},403);}catch{return json({error:'Forbidden'},403);}
    let input;try{input=await body(request);}catch{return json({error:'Invalid request'},400);}
    const id=input.id;
    if(typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(id))return json({error:'Invalid campaign ID'},400);
    try{if(await options.authorizeCampaign(principal,id,String(input.action))!==true)return json({error:'Forbidden'},403);}catch{return json({error:'Forbidden'},403);}
    try{
      if(input.action==='create'){
        const def:CampaignDefinition={id,name:input.name as string,sendAt:input.sendAt as number,segment:input.segment as CampaignDefinition['segment'],tracking:input.tracking as CampaignDefinition['tracking']};
        return json(publicState(await options.planner.create(def)),201);
      }
      if(['schedule','pause','resume','cancel'].includes(String(input.action)))return json(publicState(await options.planner.command(id,input.action as 'schedule'|'pause'|'resume'|'cancel')));
      return json({error:'Unknown action'},400);
    }catch{return json({error:'Campaign transition failed'},409);}
  }
  return {prefix,handle,routes:()=>[{pattern:prefix,handler:handle},{pattern:`${prefix}/api`,handler:handle},{pattern:`${prefix}/app.js`,handler:handle},{pattern:`${prefix}/app.css`,handler:handle}]};
}
function publicState(s:Awaited<ReturnType<CampaignPlanner['get']>>){
  if(!s)return null;
  // Never return recipient identities, live lease tokens or message IDs to the web client.
  const {lease,pending,tracking,segment,cursor,...safe}=s;
  return {...safe,pendingCount:pending.length,leased:!!lease,cursorPresent:cursor!==null,segmentConditions:(segment?.all?.length??0)+(segment?.any?.length??0),trackingEnabled:tracking?.enabled===true};
}
