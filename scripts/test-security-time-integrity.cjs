const test=require("node:test");
const assert=require("node:assert/strict");
const dgram=require("node:dgram");
const {validateNtpServer,writeNtpTimestamp,queryNtpTime,classifyClockSample}=require("../services/security-gateway/time-integrity.cjs");
function listen(s){return new Promise(resolve=>s.bind(0,"127.0.0.1",resolve));}
test("lot 14 : serveur NTP et seuil de dérive",()=>{
 assert.equal(validateNtpServer("time.example.net"),"time.example.net");
 assert.throws(()=>validateNtpServer("https://example.net"));
 assert.throws(()=>validateNtpServer("bad host"));
 assert.equal(classifyClockSample({offsetMs:500,roundTripMs:800}),"synchronized");
 assert.equal(classifyClockSample({offsetMs:1001,roundTripMs:20}),"warning");
 assert.equal(classifyClockSample({offsetMs:0,roundTripMs:1501}),"warning");
 assert.throws(()=>classifyClockSample({offsetMs:NaN,roundTripMs:3}));
});
test("lot 14 : offset SNTP calculé avec réponse UDP simulée et origine vérifiée",async()=>{
 const server=dgram.createSocket("udp4");await listen(server);
 try{
  const port=server.address().port;
  server.on("message",(req,remote)=>{
   const res=Buffer.alloc(48);res[0]=0x24;res[1]=2;req.copy(res,24,40,48);
   const received=Date.now()+5000;writeNtpTimestamp(res,32,received);writeNtpTimestamp(res,40,received+2);
   server.send(res,remote.port,remote.address);
  });
  const sample=await queryNtpTime({server:"127.0.0.1",port,timeoutMs:1500});
  assert.equal(sample.stratum,2);assert.ok(sample.offsetMs>=4500&&sample.offsetMs<=5500,"offset="+sample.offsetMs);
  assert.ok(sample.roundTripMs<=500);assert.ok(Number.isFinite(Date.parse(sample.measuredAt)));
 }finally{server.close();}
});
test("lot 14 : originate timestamp incohérent rejeté",async()=>{
 const server=dgram.createSocket("udp4");await listen(server);
 try{
  const port=server.address().port;
  server.on("message",(_req,remote)=>{
   const res=Buffer.alloc(48);res[0]=0x24;res[1]=2;
   writeNtpTimestamp(res,32,Date.now());writeNtpTimestamp(res,40,Date.now()+1);
   server.send(res,remote.port,remote.address);
  });
  await assert.rejects(queryNtpTime({server:"127.0.0.1",port,timeoutMs:1000}),/Origine/);
 }finally{server.close();}
});
