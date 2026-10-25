// WA_TEST_BUILD=/tmp/wa-build NODE_PATH=$PWD/node_modules node --test tests/whatsapp-api.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url), build=process.env.WA_TEST_BUILD;
const {windowOpen,verifySignature,webhookEvents,replyText}=require(build+"/lib/whatsapp.js");
const inbox=require(build+"/app/api/associazione/whatsapp/route.js");
const webhook=require(build+"/app/api/whatsapp/webhook/route.js");
const original=global.fetch;
after(()=>{global.fetch=original;});
const actor="00000000-0000-0000-0000-000000000001", conversation="00000000-0000-0000-0000-000000000002", requestId="00000000-0000-0000-0000-000000000003";
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:"https://test.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"anon",SUPABASE_SERVICE_ROLE_KEY:"secret",
  ADMIN_ALLOWED_EMAIL:"owner@example.org",WHATSAPP_ACCESS_TOKEN:"meta-secret",WHATSAPP_PHONE_NUMBER_ID:"1234",WHATSAPP_BUSINESS_ACCOUNT_ID:"5678",
  WHATSAPP_GRAPH_VERSION:"v25.0",WHATSAPP_APP_SECRET:"webhook-secret",WHATSAPP_VERIFY_TOKEN:"verify-secret",WHATSAPP_SEND_ENABLED:"true"});
let calls=[],owner=true,grant=false,expired=false,duplicate=false,network=false,rejected=false;
function mock() {
  calls=[];owner=true;grant=false;expired=false;duplicate=false;network=false;rejected=false;
  global.fetch=async(url,init={})=>{
    url=String(url);calls.push({url,init});
    if(url.endsWith("/auth/v1/user"))return Response.json({id:actor,email:owner?"owner@example.org":"member@example.org"});
    if(url.includes("association_members?"))return Response.json([{name:"Operatore",role:"member",active:true,activated_at:"2026-10-01"}]);
    if(url.includes("wa_operators?"))return Response.json(grant?[{user_id:actor,enabled:true}]:[]);
    if(url.includes("wa_conversations?"))return Response.json([{id:conversation,last_inbound_at:new Date(Date.now()-(expired?86400001:60000)).toISOString()}]);
    if(url.includes("/rpc/wa_reserve"))return Response.json(duplicate?{error:"Richiesta già registrata"}:{ok:true,wa_id:"393331234567"});
    if(url.includes("/rpc/wa_"))return Response.json(null);
    if(url.startsWith("https://graph.facebook.com/")) {
      if(network)throw new Error("timeout");
      return rejected?Response.json({error:{code:131047}},{status:400}):Response.json({messages:[{id:"wamid.out"}]});
    }
    throw new Error("Unexpected URL "+url);
  };
}
const req=(body,token=true)=>new Request("https://example.org/api/associazione/whatsapp",{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer test"}:{})},...(body?{body:JSON.stringify(body)}:{})});
const send={action:"send",conversation_id:conversation,request_id:requestId,text:"Ciao, grazie per averci scritto."};
const payload=(phone="1234",account="5678")=>({object:"whatsapp_business_account",entry:[{id:account,changes:[{field:"messages",value:{metadata:{phone_number_id:phone},contacts:[{wa_id:"393331234567",profile:{name:"Famiglia"}}],messages:[{id:"wamid.in",from:"393331234567",timestamp:String(Math.floor(Date.now()/1000)),type:"text",text:{body:"Ciao"}}]}}]}]});
test("finestra esatta, firma sul corpo originale e testo",()=>{
  const now=Date.now();
  assert.equal(windowOpen(new Date(now-86399999).toISOString(),now),true);
  for(const time of [null,"invalid",new Date(now-86400000).toISOString(),new Date(now+1000).toISOString()])assert.equal(windowOpen(time,now),false);
  const raw=Buffer.from('{"test":1}'),sig="sha256="+createHmac("sha256","secret").update(raw).digest("hex");
  assert.equal(verifySignature(raw,sig,"secret"),true);
  assert.equal(verifySignature(Buffer.from('{"test":2}'),sig,"secret"),false);
  assert.equal(verifySignature(raw,"sha256=123","secret"),false);
  assert.equal(replyText("  ciao  "),"ciao");
  for(const text of [""," ".repeat(3),"a".repeat(4097),"ciao\u0000"])assert.throws(()=>replyText(text));
});
test("webhook accetta soltanto numero e account configurati, conserva media e filtra timestamp futuri",()=>{
  assert.equal(webhookEvents(payload(),"1234","5678").incoming.length,1);
  assert.equal(webhookEvents(payload("999"),"1234","5678").incoming.length,0);
  assert.equal(webhookEvents(payload("1234","999"),"1234","5678").incoming.length,0);
  const data=payload();const message=data.entry[0].changes[0].value.messages[0];
  message.type="audio";message.audio={id:"media-1",mime_type:"audio/ogg"};
  assert.equal(webhookEvents(data,"1234","5678").incoming[0].media_id,"media-1");
  message.timestamp=String(Math.floor(Date.now()/1000)+1000);
  assert.equal(webhookEvents(data,"1234","5678").incoming.length,0);
});
test("accessi: nessun token o socio senza permesso non leggono né inviano",async()=>{
  mock();assert.equal((await inbox.GET(req(null,false))).status,401);assert.equal(calls.length,0);
  owner=false;assert.equal((await inbox.GET(req())).status,403);
  assert.equal((await inbox.POST(req(send))).status,403);
  assert.equal(calls.some(c=>c.url.includes("wa_conversations")||c.url.includes("graph.facebook")),false);
});
test("permesso WhatsApp indipendente dalla contabilità; gestione operatori solo owner",async()=>{
  mock();owner=false;grant=true;
  assert.equal((await inbox.POST(req(send))).status,200);
  const response=await inbox.POST(req({action:"operator",user_id:actor,enabled:true}));
  assert.equal(response.status,403);
});
test("invio disattivato, finestra scaduta e duplicati impediscono chiamate Meta",async()=>{
  mock();process.env.WHATSAPP_SEND_ENABLED="false";
  assert.equal((await inbox.POST(req(send))).status,503);
  process.env.WHATSAPP_SEND_ENABLED="true";expired=true;
  assert.equal((await inbox.POST(req(send))).status,409);
  expired=false;duplicate=true;
  assert.equal((await inbox.POST(req(send))).status,409);
  assert.equal(calls.some(c=>c.url.startsWith("https://graph.facebook.com/")),false);
});
test("invio: destinatario derivato dal DB e nessun template o invio arbitrario",async()=>{
  mock();
  assert.equal((await inbox.POST(req({...send,to:"numero arbitrario",type:"template"}))).status,200);
  const call=calls.find(c=>c.url.startsWith("https://graph.facebook.com/")),body=JSON.parse(call.init.body);
  assert.equal(body.to,"393331234567");assert.equal(body.type,"text");
  assert.equal(body.biz_opaque_callback_data,requestId);
  const delivery=calls.find(c=>c.url.includes("/rpc/wa_delivery"));
  assert.equal(JSON.parse(delivery.init.body).p_state,"accepted");
});
test("timeout: esito incerto persistito; rifiuto esplicito Meta: fallito",async()=>{
  mock();network=true;assert.equal((await inbox.POST(req(send))).status,503);
  assert.equal(JSON.parse(calls.find(c=>c.url.includes("wa_delivery")).init.body).p_state,"unknown");
  assert.equal(calls.filter(c=>c.url.startsWith("https://graph.facebook.com/")).length,1);
  mock();rejected=true;assert.equal((await inbox.POST(req(send))).status,503);
  assert.equal(JSON.parse(calls.find(c=>c.url.includes("wa_delivery")).init.body).p_state,"failed");
});
test("verifica Meta: challenge, firma obbligatoria e persistenza prima dell’ack",async()=>{
  mock();
  const verify=url=>webhook.GET(new Request(url));
  assert.equal((await verify("https://example.org/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=no")).status,403);
  assert.equal(await (await verify("https://example.org/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=123")).text(),"123");
  const raw=JSON.stringify(payload()),sig="sha256="+createHmac("sha256","webhook-secret").update(raw).digest("hex");
  const request=signature=>new Request("https://example.org/api/whatsapp/webhook",{method:"POST",body:raw,headers:{"x-hub-signature-256":signature}});
  assert.equal((await webhook.POST(request("invalid"))).status,401);assert.equal(calls.length,0);
  assert.equal((await webhook.POST(request(sig))).status,200);assert.equal(calls.filter(c=>c.url.includes("wa_receive")).length,1);
  global.fetch=async()=>{throw new Error("database offline");};
  assert.equal((await webhook.POST(request(sig))).status,503);
});
