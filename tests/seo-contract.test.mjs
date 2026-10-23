import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const load=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Sitemap: /partecipa presente e informative noindex escluse",()=>{
 const sitemap=load("app/sitemap.ts");
 const legal=load("lib/legal.ts");
 assert.match(sitemap,/\/partecipa/,"La pagina pubblica /partecipa deve essere in sitemap");
 assert.match(sitemap,/page\.indexable\s*!==\s*false/,"Le pagine legali non indicizzabili devono essere filtrate");
 assert.match(legal,/href:\s*"\/informativa-contatti"[\s\S]*?indexable:\s*false/,"L'informativa di contatto non va proposta per l'indicizzazione");
 assert.match(load("app/informativa-contatti/page.tsx"),/index:\s*false/,"L'informativa mantiene noindex");
});
test("Aree riservate: noindex leggibile, API private escluse dai crawler",()=>{
 const robots=load("app/robots.ts");
 const admin=load("app/admin/layout.tsx");
 const member=load("app/area-soci/layout.tsx");
 assert.doesNotMatch(robots,/^\s*"\/admin",\s*$/m);
 assert.doesNotMatch(robots,/^\s*"\/area-soci",\s*$/m);
 assert.match(robots,/\/api\/admin/);
 assert.match(robots,/\/api\/associazione/);
 assert.match(robots,/\/api\/accesso/);
 assert.match(admin,/index:\s*false/);
 assert.match(member,/index:\s*false/);
});
test("Le pagine pubbliche hanno canonical coerenti",()=>{
 const home=load("app/page.tsx");
 const participate=load("app/partecipa/page.tsx");
 const cookie=load("app/cookie-policy/page.tsx");
 assert.match(home,/alternates:\s*\{\s*canonical:\s*"\/"/);
 assert.match(participate,/alternates:\s*\{\s*canonical:\s*"\/partecipa"/);
 assert.match(cookie,/alternates:\s*\{\s*canonical:\s*"\/cookie-policy"/);
});
