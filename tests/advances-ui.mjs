// Production build, mocked APIs, no live data. PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/advances-ui.mjs
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3106','-H','127.0.0.1'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:3106/admin')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const advances=[],payments=[];
  await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let data={ok:true};
   if(path.endsWith('/login')) data={user:{id:'owner',name:'Luca',role:'owner'},session:{access_token:'test',expires_at:Date.now()/1000+3600}};
   else if(path.endsWith('/requests')||path.endsWith('/movements'))data={items:[]};
   else if(path.endsWith('/anticipazioni')){if(route.request().method()==='GET')data={advances,payments};else{const b=route.request().postDataJSON();if(b.action==='create')advances.push({id:b.id,kind:b.kind,person:b.person,date:b.date,amount_cents:2000,description:b.description});else payments.push({id:b.id,advance_id:b.advance_id,date:b.date,amount_cents:800,account:b.account});data={id:b.id}}}
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://127.0.0.1:3106/admin');await page.getByLabel('Nome utente',{exact:true}).fill('luca');await page.getByLabel('Password',{exact:true}).fill('PasswordPerTest123!');await page.getByRole('button',{name:'Entra nell’area soci'}).click();await page.getByRole('button',{name:'Contabilità',exact:true}).click();await page.setViewportSize({width,height:900});
  const panel=page.getByRole('region',{name:'Anticipazioni e rimborsi'});await panel.getByText('Nessuna anticipazione registrata.').waitFor();await panel.getByText('+ Registra anticipazione').click();await panel.getByLabel('Persona').fill('Presidente Test');await panel.getByLabel('Importo €').fill('20');await panel.getByLabel('Descrizione').fill('Apertura conto');await panel.getByRole('button',{name:'Registra anticipazione'}).click();await panel.getByText(/Da rimborsare 20,00/).waitFor();
  await panel.getByRole('button',{name:'Registra rimborso'}).click();await panel.getByLabel('Importo €').last().fill('8');await panel.getByRole('button',{name:'Registra rimborso'}).click();await panel.getByText(/Da rimborsare 12,00/).waitFor();assert.equal(advances.length,1);assert.equal(payments.length,1);assert.equal(payments[0].account,'cash');assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'overflow at '+width);await page.close();
 }
 console.log('PASS: creazione deposito e rimborso parziale desktop/mobile');
}finally{await browser?.close();server.kill()}
