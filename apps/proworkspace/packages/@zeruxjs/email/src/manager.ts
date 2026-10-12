import {randomUUID} from 'node:crypto';
import type {EmailAccount, EmailAddress, EmailManagerOptions, EmailMessage, EmailResult, SmtpAuth, TransportLike} from './types.js';
import {validateEmailAddress,validateMessage,validateSmtp,recipientList,addressString} from './validation.js';
import {createRecipientFilter} from './filters.js';
import {createTemplateRegistry} from './templates.js';
import {convertHtmlToEmail,plainTextFromHtml} from './html.js';
import {resolveAttachments} from './attachments.js';

function toTransportConfig(account:EmailAccount):Record<string,unknown>{
  const smtp=account.smtp!;
  const auth:SmtpAuth|undefined=smtp.auth;
  return {
    host:smtp.host,port:smtp.port,secure:smtp.secure??smtp.port===465,
    requireTLS:smtp.requireTLS??false,ignoreTLS:smtp.ignoreTLS??false,
    pool:smtp.pool??false,maxConnections:smtp.maxConnections??5,maxMessages:smtp.maxMessages??100,
    connectionTimeout:smtp.connectionTimeout??10000,greetingTimeout:smtp.greetingTimeout??10000,socketTimeout:smtp.socketTimeout??30000,
    tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,...smtp.tls},
    ...(auth?{auth:auth.type==='password'?{user:auth.user,pass:auth.pass}:{...auth,type:'OAuth2'}}:{}),
    ...(smtp.dkim?{dkim:{...smtp.dkim}}:{})
  };
}
function redactResult(value:{messageId?:string;accepted?:unknown[];rejected?:unknown[];response?:string},account:string):EmailResult {
  const asAddresses=(values?:unknown[])=>Array.isArray(values)?values.map(v=>String(v).slice(0,320)):[];
  return {account,messageId:value.messageId,accepted:asAddresses(value.accepted),rejected:asAddresses(value.rejected),response:value.response};
}
function unsubscribeHeaders(value:EmailMessage['listUnsubscribe']):Record<string,string>{
  if(!value)return {};
  const targets:string[]=[];
  if(value.url){const url=new URL(value.url);if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw new TypeError('HTTPS unsubscribe URL required');targets.push(`<${url.href}>`);}
  if(value.email){validateEmailAddress(value.email);targets.push(`<mailto:${value.email}>`);}
  if(!targets.length)throw new TypeError('Unsubscribe target required');
  return {'List-Unsubscribe':targets.join(', '),...(value.url?{'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:{})};
}
export interface EmailSendOptions {
  htmlMode?:'email'|'trusted';allowLocalAttachmentPaths?:boolean;
  /** Overrides per-message tracking for this send. false always disables all tracking. */
  tracking?:boolean|NonNullable<EmailMessage['tracking']>;
}
export function createEmailManager(options:EmailManagerOptions){
  if(!options?.accounts?.length)throw new TypeError('At least one email connection required');
  const accounts=new Map<string,EmailAccount>();
  for(const account of options.accounts){
    if(!/^[a-z][a-z0-9_-]{0,63}$/.test(account?.name)||accounts.has(account.name))throw new TypeError('Invalid or duplicate email account name');
    if(Boolean(account.smtp)===Boolean(account.transport))throw new TypeError('Choose SMTP settings or injected transport');
    if(account.smtp)validateSmtp(account.smtp);
    if(account.defaults?.from)validateEmailAddress(account.defaults.from);
    accounts.set(account.name,account);
  }
  const fallback=options.defaultAccount??options.accounts[0].name;
  if(!accounts.has(fallback))throw new Error('Unknown default email account');
  const limit=options.maxRecipients??100;
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new RangeError('Invalid recipient limit');
  const filter=createRecipientFilter(options.rules,options.suppressions);
  const templates=createTemplateRegistry();
  const created=new Map<string,Promise<TransportLike>>();
  const completed=new Map<string,{until:number;result:EmailResult}>();
  const pending=new Map<string,Promise<EmailResult>>();
  const maxKeys=options.maxIdempotencyKeys??2000,ttl=options.idempotencyTtlMs??5*60_000;
  if(!Number.isSafeInteger(maxKeys)||maxKeys<1||maxKeys>100000||!Number.isSafeInteger(ttl)||ttl<1||ttl>86_400_000)throw new RangeError('Invalid idempotency policy');
  let closed=false;
  async function transporter(name:string):Promise<TransportLike>{
    if(closed)throw new Error('Email manager closed');
    const account=accounts.get(name);if(!account)throw new Error(`Unknown email account: ${name}`);
    if(account.enabled===false)throw new Error(`Email account disabled: ${name}`);
    let current=created.get(name);
    if(!current){current=account.transport?Promise.resolve(account.transport):import('nodemailer').then(({default:nm})=>nm.createTransport(toTransportConfig(account)) as TransportLike);
      created.set(name,current);current.catch(()=>{if(created.get(name)===current)created.delete(name);});}
    return current;
  }
  async function doSend(message:EmailMessage,name:string,sendOpts:EmailSendOptions):Promise<EmailResult>{
    const account=accounts.get(name)!;
    const merged:EmailMessage={...account.defaults,...message,account:name};
    // Tracking may only be enabled explicitly on THIS send, never silently through account defaults.
    const policy=sendOpts.tracking===false?{enabled:false}:sendOpts.tracking===true?{enabled:true}:
      sendOpts.tracking?{...sendOpts.tracking}:
      message.tracking?{...message.tracking}:{enabled:false};
    merged.tracking={enabled:policy.enabled===true,opens:policy.opens,clicks:policy.clicks,downloads:policy.downloads,downloadLinks:policy.downloadLinks,campaign:policy.campaign};
    const trackingEnabled=merged.tracking.enabled===true;
    const marketing=message.purpose==='marketing';
    if(message.purpose!==undefined&&!['marketing','transactional'].includes(message.purpose))throw new TypeError('Invalid email purpose');
    // Account defaults may not silently turn transactional sends into marketing campaigns.
    merged.purpose=marketing?'marketing':'transactional';
    function warnTracking(error:unknown){try{options.onTrackingError?.(error);}catch{/* logging must not break delivery */}}

    if(merged.template){const render=templates.render(merged.template,merged.data);merged.subject=merged.subject||render.subject;merged.html=merged.html??render.html;merged.text=merged.text??render.text;}
    const {to,cc,bcc}=validateMessage(merged,Math.min(limit,account.maxRecipients??limit));
    if(!merged.from)throw new TypeError(`Email account ${name} requires a From address`);
    if(options.authorize&&!await options.authorize(merged,name))throw Object.assign(new Error('Email delivery not authorized'),{code:'EMAIL_FORBIDDEN'});
    for(const recipient of [...to,...cc,...bcc]){
      const evaluation=filter.evaluate(recipient,name);
      if(evaluation.rejected.length)throw Object.assign(new Error(`Recipient rejected: ${evaluation.rejected[0].reason}`),{code:'EMAIL_FILTERED'});
    }
    if(marketing){
      if(cc.length||bcc.length||to.length!==1)throw Object.assign(new Error('Marketing delivery requires exactly one To recipient and no Cc/Bcc'),{code:'EMAIL_MARKETING_RECIPIENTS'});
      if(!options.preferences)throw Object.assign(new Error('Marketing consent service unavailable'),{code:'EMAIL_CONSENT_UNAVAILABLE'});
      // Fail closed when the consent database cannot be read; do not deliver without consent.
      let subscribed=false;
      try{subscribed=await options.preferences.isSubscribed(to[0]);}
      catch{throw Object.assign(new Error('Marketing consent lookup unavailable'),{code:'EMAIL_CONSENT_UNAVAILABLE'});}
      if(!subscribed)throw Object.assign(new Error('Recipient has not opted into marketing'),{code:'EMAIL_CONSENT_REQUIRED'});
      if(options.marketingSuppression){
        let blocked;try{blocked=await options.marketingSuppression.isSuppressed(to[0]);}
        catch{throw Object.assign(new Error('Marketing suppression unavailable'),{code:'EMAIL_SUPPRESSION_UNAVAILABLE'});}
        if(typeof blocked!=='boolean')throw Object.assign(new Error('Invalid marketing suppression state'),{code:'EMAIL_SUPPRESSION_UNAVAILABLE'});
        if(blocked)throw Object.assign(new Error('Recipient suppressed from marketing'),{code:'EMAIL_SUPPRESSED'});
      }
      merged.listUnsubscribe={...merged.listUnsubscribe,url:options.preferences.makeUnsubscribeUrl(to[0])};
    }
    const headers={...merged.headers,...unsubscribeHeaders(merged.listUnsubscribe)};
    let renderedHtml=merged.html?(sendOpts.htmlMode==='trusted'?merged.html:await convertHtmlToEmail(merged.html)):undefined;
    const untrackedHtml=renderedHtml;
    // The tracking service is explicitly injected; no hidden analytics requests or tracking by default.
    const trackingId=randomUUID();
    if(renderedHtml&&trackingEnabled&&options.tracking){
      try{renderedHtml=await options.tracking.instrumentHtml(renderedHtml,{id:trackingId,account:name,message:merged});}
      catch(error){warnTracking(error);renderedHtml=untrackedHtml;}
    }
    const text=merged.text??(untrackedHtml?await plainTextFromHtml(untrackedHtml):undefined);
    const attachments=await resolveAttachments(merged.attachments,{files:options.files,maxAttachmentBytes:options.maxAttachmentBytes},sendOpts.allowLocalAttachmentPaths??false);
    const data:Record<string,unknown>={from:merged.from,to,cc,bcc,replyTo:merged.replyTo?recipientList(merged.replyTo):undefined,subject:merged.subject,html:renderedHtml,text,amp:merged.amp,headers,priority:merged.priority,attachments};
    const transport=await transporter(name);
    if(marketing){
      // Fresh pre-SMTP check protects against preference changes during HTML rendering.
      let allowed;try{allowed=await options.preferences!.isSubscribed(to[0]);}
      catch{throw Object.assign(new Error('Marketing consent unavailable'),{code:'EMAIL_CONSENT_UNAVAILABLE'});}
      if(!allowed)throw Object.assign(new Error('Marketing consent revoked'),{code:'EMAIL_CONSENT_REQUIRED'});
      if(options.marketingSuppression){
        let blocked;try{blocked=await options.marketingSuppression.isSuppressed(to[0]);}
        catch{throw Object.assign(new Error('Marketing suppression unavailable'),{code:'EMAIL_SUPPRESSION_UNAVAILABLE'});}
        if(typeof blocked!=='boolean')throw Object.assign(new Error('Invalid marketing suppression state'),{code:'EMAIL_SUPPRESSION_UNAVAILABLE'});
        if(blocked)throw Object.assign(new Error('Recipient suppressed from marketing'),{code:'EMAIL_SUPPRESSED'});
      }
    }
    const result=redactResult(await transport.sendMail(data),name);
    if(trackingEnabled&&options.tracking?.onSent){
      // Mail has been accepted. Telemetry failures must not trigger a duplicate send/retry.
      try{await options.tracking.onSent({id:trackingId,account:name,message:merged,result});}
      catch(error){warnTracking(error);}
    }
    return trackingEnabled&&options.tracking?{...result,trackingId}:result;
  }
  const manager={
    templates,filter,
    accounts(){return [...accounts.values()].map(({name,enabled,smtp})=>({name,enabled:enabled!==false,protocol:smtp?'smtp':'custom',host:smtp?.host,port:smtp?.port,secure:smtp?.secure}));},
    async verify(name=fallback){const transport=await transporter(name);return transport.verify?transport.verify():true;},
    async send(message:EmailMessage,sendOpts:EmailSendOptions={}):Promise<EmailResult>{
      if(closed)throw new Error('Email manager closed');
      const name=message.account??fallback;
      if(!accounts.has(name))throw new Error(`Unknown email account: ${name}`);
      const key=message.idempotencyKey?`${name}:${message.idempotencyKey}`:undefined;
      if(key){const prior=completed.get(key);if(prior&&prior.until>Date.now())return {...prior.result,skipped:true,reason:'idempotency replay'};
        const running=pending.get(key);if(running)return running;}
      const task=doSend(message,name,sendOpts);
      if(key){pending.set(key,task);task.then(result=>{
        for(const [old,item] of completed){if(item.until<=Date.now())completed.delete(old);}
        if(completed.size>=maxKeys)completed.delete(completed.keys().next().value!);
        completed.set(key,{until:Date.now()+ttl,result});
      },()=>{}).finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});}
      return task;
    },
    async sendBatch(messages:readonly EmailMessage[],settings:{concurrency?:number;continueOnError?:boolean}={}):Promise<({ok:true;result:EmailResult}|{ok:false;error:Error})[]>{
      const workers=settings.concurrency??3;
      if(!Number.isSafeInteger(workers)||workers<1||workers>20||messages.length>10000)throw new RangeError('Invalid batch size');
      const results:Array<{ok:true;result:EmailResult}|{ok:false;error:Error}>=new Array(messages.length);let index=0;
      await Promise.all(Array.from({length:Math.min(workers,messages.length)},async()=>{
        while(index<messages.length){const i=index++;try{results[i]={ok:true,result:await manager.send(messages[i])};}catch(e){results[i]={ok:false,error:e instanceof Error?e:new Error(String(e))};}}
      }));
      if(settings.continueOnError===false&&results.some(r=>!r.ok))throw new AggregateError(results.filter(r=>!r.ok).map(r=>(r as {ok:false;error:Error}).error),'Email batch delivery failed');
      return results;
    },
    async close(){if(closed)return;closed=true;const transports=await Promise.allSettled([...created.values()]);await Promise.all(transports.filter((r):r is PromiseFulfilledResult<TransportLike>=>r.status==='fulfilled').map(r=>r.value.close?.()));created.clear();pending.clear();completed.clear();}
  };
  return manager;
}
export type EmailManager=ReturnType<typeof createEmailManager>;
