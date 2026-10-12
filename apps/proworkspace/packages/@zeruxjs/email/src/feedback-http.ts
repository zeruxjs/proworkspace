import type {MarketingFeedback,createMarketingSuppressionService} from './suppression.js';
export interface MarketingFeedbackHttpOptions {
  /** Only route externally verified provider notifications here. Provider-specific signature schemes live in host callbacks. */
  verifySignature:(body:Uint8Array,headers:Headers)=>Promise<boolean>|boolean;
  parse:(body:Uint8Array,headers:Headers)=>Promise<MarketingFeedback[]>|MarketingFeedback[];
  suppression:ReturnType<typeof createMarketingSuppressionService>;
  path?:string;
  maxBodyBytes?:number;
  timeoutMs?:number;
}
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
/** Fail-closed authenticated POST endpoint; never trusts unsigned user-supplied bounce state. */
export function createMarketingFeedbackEndpoint(config:MarketingFeedbackHttpOptions){
  if(!config||typeof config.verifySignature!=='function'||typeof config.parse!=='function'||typeof config.suppression?.recordFeedback!=='function')throw new TypeError('Authenticated provider feedback callbacks required');
  const path=config.path??'/_email/feedback';
  if(!/^\/[A-Za-z0-9/_-]{2,120}$/.test(path)||path.includes('//')||path.endsWith('/')||path.includes('..'))throw new TypeError('Invalid provider feedback path');
  const maxBytes=config.maxBodyBytes??65_536,timeout=config.timeoutMs??5000;
  if(!Number.isSafeInteger(maxBytes)||maxBytes<256||maxBytes>262_144||!Number.isSafeInteger(timeout)||timeout<100||timeout>30_000)throw new RangeError('Invalid feedback request limit');
  const response=(status:number)=>new Response(null,{status,headers});
  async function handle(request:Request):Promise<Response>{
    if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,allow:'POST'}});
    const length=request.headers.get('content-length');
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))return response(413);
    if(!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type')??''))return response(415);
    const reader=request.body?.getReader();if(!reader)return response(400);
    let timedOut=false,oversize=false;const parts:Buffer[]=[];let bytes=0;
    const timer=setTimeout(()=>{timedOut=true;void reader.cancel().catch(()=>{});},timeout);timer.unref?.();
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
        if(bytes>maxBytes){oversize=true;await reader.cancel().catch(()=>{});break;}parts.push(Buffer.from(value));}
    }catch{return response(timedOut?408:400);}finally{clearTimeout(timer);reader.releaseLock();}
    if(timedOut)return response(408);if(oversize)return response(413);
    const raw=Buffer.concat(parts);
    let verified=false;
    try{verified=await config.verifySignature(raw,request.headers)===true;}catch{return response(401);}
    if(!verified)return response(401);
    let events:MarketingFeedback[];
    try{events=await config.parse(raw,request.headers);}catch{return response(400);}
    if(!Array.isArray(events)||events.length>100||events.some(e=>!e||typeof e!=='object'))return response(400);
    // A bounded provider delivery is replay-safe as long as IDs are in the dedupe window.
    for(const event of events){
      try{await config.suppression.recordFeedback(event);}catch{return response(503);}
    }
    return response(204);
  }
  return {path,handle,routes:()=>[{pattern:path,handler:handle}]};
}
