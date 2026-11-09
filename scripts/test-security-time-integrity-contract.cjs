const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const gateway=fs.readFileSync(path.join(root,"src/app/api/security/gateway/time-integrity/route.ts"),"utf8");
const promoter=fs.readFileSync(path.join(root,"src/app/api/security/time-integrity/route.ts"),"utf8");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261109040000_security_gateway_time_integrity.sql"),"utf8");
const agent=fs.readFileSync(path.join(root,"services/security-gateway/agent.cjs"),"utf8");
const ntp=fs.readFileSync(path.join(root,"services/security-gateway/time-integrity.cjs"),"utf8");
test("lot 14 : ingestion NTP signée et installation pilote contrôlée",()=>{
 assert.ok(gateway.includes("authenticateSignedSecurityGateway"));assert.ok(gateway.includes("pilot_active"));
 assert.ok(gateway.includes("legal_review_status"));assert.ok(gateway.includes("naxa_security_record_gateway_time_sample"));
 assert.ok(agent.includes("/api/security/gateway/time-integrity"));assert.ok(agent.includes("NAXA_NTP_SERVER"));
});
test("lot 14 : historique privé, RPC invoker, grants et audit",()=>{
 assert.ok(migration.includes("FORCE ROW LEVEL SECURITY"));assert.match(migration,/security invoker/i);
 assert.match(migration,/set search_path=''/i);assert.match(migration,/revoke all on function[\s\S]*from public,anon,authenticated/i);
 assert.match(migration,/grant execute on function[\s\S]*to service_role/i);assert.ok(migration.includes("naxa_security_access_audit"));
});
test("lot 14 : lecture Promoteur scoppée aux pharmacies actives",()=>{
 assert.ok(promoter.includes("loadPromoteurAccess"));assert.ok(promoter.includes("activeLinkIds"));
 assert.ok(promoter.includes("naxa_security_gateway_time_samples"));
});
test("lot 14 : SNTP signalé comme mesure passerelle et non heure caméra certifiée",()=>{
 assert.ok(ntp.includes("Origine de réponse NTP incohérente"));assert.ok(ntp.includes("roundTripMs"));
 assert.ok(agent.includes("gatewayClockOffsetMs"));
});
