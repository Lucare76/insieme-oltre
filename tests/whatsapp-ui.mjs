// WA_CHROMIUM_MODULE=/path/to/@sparticuz/chromium/build/index.js WA_PLAYWRIGHT=/path/to/playwright/index.mjs node tests/whatsapp-ui.mjs
import assert from "node:assert/strict";
const { chromium } = await import(process.env.WA_PLAYWRIGHT || "playwright");
const portable = process.env.WA_CHROMIUM_MODULE ? (await import(process.env.WA_CHROMIUM_MODULE)).default : null;
const browser = await chromium.launch(process.env.WA_BROWSER ? { executablePath: process.env.WA_BROWSER, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"], headless: true } : portable ? { executablePath: await portable.executablePath(), args: portable.args, headless: true } : { headless: true });
const base=process.env.WA_UI_URL || "http://127.0.0.1:3101";
const actor="00000000-0000-0000-0000-000000000001", chat="00000000-0000-0000-0000-000000000002";
try {
  for(const viewport of [{width:390,height:844},{width:1280,height:900}]) {
    const page=await browser.newPage({viewport});
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    let assigned=false,version=1,sendCount=0;
    const incoming={id:"00000000-0000-0000-0000-000000000005",conversation_id:chat,direction:"in",body:"Buongiorno! Vorrei conoscere le attività di Insieme Oltre.",type:"text",sent_at:new Date().toISOString(),created_at:new Date().toISOString(),state:"received"};
    const messages=[incoming];
    await page.addInitScript(({actor})=>{
      localStorage.setItem("insieme_oltre_admin_session",JSON.stringify({access_token:"test",refresh_token:"refresh",expires_at:Date.now()/1000+3600,started_at:Date.now()}));
      localStorage.setItem("insieme_oltre_admin_session_times",JSON.stringify({loginAt:Date.now(),lastActivityAt:Date.now()}));
    },{actor});
    await page.route("**/api/**",async route=>{
      const req=route.request(),url=new URL(req.url());let body={};
      if(req.method()==="POST")body=req.postDataJSON();
      let data={};
      if(url.pathname.endsWith("/me"))data={user:{id:actor,name:"Luca",role:"owner"}};
      else if(url.pathname.endsWith("/requests"))data={items:[]};
      else if(url.pathname.endsWith("/whatsapp")) {
        if(req.method()==="POST") {
          if(body.action==="manage"){assigned=body.status==="assigned";version++;}
          if(body.action==="send"){sendCount++;messages.push({id:body.request_id,conversation_id:chat,direction:"out",body:body.text,type:"text",state:"accepted",sent_at:new Date().toISOString(),created_at:new Date().toISOString()});}
          data={ok:true};
        } else if(url.searchParams.get("view")==="access")data={allowed:true};
        else if(url.searchParams.get("view")==="operators")data={members:[{user_id:"00000000-0000-0000-0000-000000000003",name:"Operatore esempio",active:true,activated_at:"2026-10-01"}],grants:[]};
        else if(url.searchParams.has("conversation"))data={items:messages,has_more:false};
        else data={conversations:[{id:chat,wa_id:"393331234567",contact_name:"Maria",last_inbound_at:new Date(Date.now()-60000).toISOString(),last_message_at:new Date().toISOString(),last_preview:incoming.body,unread_count:1,status:assigned?"assigned":"open",assigned_to:assigned?actor:null,version}],
          usage:{reserved:sendCount,delivered:0,uncertain:0},limit:950,connected:true,send_enabled:true,user_id:actor,has_more:false};
      }
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    });
    await page.goto(base+"/admin");
    await page.getByRole("button",{name:"WhatsApp",exact:true}).click();
    await page.getByRole("button",{name:/Maria/}).waitFor();
    await page.screenshot({path:"../tmp/whatsapp-list-"+viewport.width+".png",fullPage:true});
    await page.getByRole("button",{name:/Maria/}).click();
    await page.getByRole("log").getByText(incoming.body,{exact:true}).waitFor();
    assert.equal(await page.getByLabel("La tua risposta").isDisabled(),true);
    await page.getByRole("button",{name:"Prendi in gestione",exact:true}).click();
    await page.getByLabel("La tua risposta").fill("Ciao Maria, grazie per averci scritto! Ti raccontiamo volentieri il nostro progetto.");
    await page.getByRole("button",{name:"Invia risposta",exact:true}).dblclick();
    await page.getByRole("log").getByText("Accettato da Meta",{exact:false}).waitFor();
    assert.equal(sendCount,1,"il doppio clic non deve duplicare l’invio");
    assert.equal(await page.getByLabel("La tua risposta").inputValue(),"");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"nessun overflow orizzontale");
    await page.screenshot({path:"../tmp/whatsapp-chat-"+viewport.width+".png",fullPage:true});
    if(viewport.width<700) await page.getByRole("button",{name:"Torna alle conversazioni"}).click();
    await page.getByRole("button",{name:"Operatori",exact:true}).click();
    await page.getByLabel("Operatore esempio").waitFor();
    assert.deepEqual(errors,[]);
    await page.close();
  }
  const page=await browser.newPage();
  await page.goto(base+"/");
  assert.equal(await page.getByRole("link",{name:/Scrivici su WhatsApp/}).count(),0,"CTA nascosta senza attivazione e numero");
  await page.close();
  console.log("UI mobile/desktop, presa in carico, invio senza duplicati e CTA disattivata: OK");
} finally { await browser.close(); }
