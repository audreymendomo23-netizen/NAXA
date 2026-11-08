const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {
  SOAP_LIMIT,ACTION_PULL,validateSubscriptionEndpoint,buildUsernameToken,
  buildSoapEnvelope,createPullPointSubscription,parseNotificationMessages,
  runPullPointCollector,writeOnvifEventConfigs,readOnvifEventConfigs
}=require("../services/security-gateway/onvif-events.cjs");

function envelope(body){return '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>'+body+"</s:Body></s:Envelope>";}
function response(body,status=200){return new Response(body,{status,headers:{"content-type":"application/soap+xml; charset=utf-8"}});}

test("WS-Security UsernameToken : digest basé sur nonce brut, Created et mot de passe",()=>{
  const nonce=Buffer.from("00112233445566778899aabbccddeeff","hex");
  const created="2026-11-08T04:00:00.000Z",password="cameraSecret";
  const expected=crypto.createHash("sha1").update(Buffer.concat([nonce,Buffer.from(created),Buffer.from(password)])).digest("base64");
  const token=buildUsernameToken("operator",password,{nonce,created});
  assert.equal(token.digest,expected);
  assert.equal(token.nonce,nonce.toString("base64"));
  assert.doesNotMatch(token.header,/cameraSecret/);
  assert.match(token.header,/#PasswordDigest/);
});

test("SOAP Pull-Point : action, To, UsernameToken et timeout borné",()=>{
  const xml=buildSoapEnvelope({
    to:"http://192.168.1.20/onvif/events",action:ACTION_PULL,username:"operator",password:"secret",
    body:"<tev:PullMessages><tev:Timeout>PT5S</tev:Timeout><tev:MessageLimit>10</tev:MessageLimit></tev:PullMessages>",
    nonce:Buffer.alloc(16,1),created:"2026-11-08T04:00:00.000Z"
  });
  assert.match(xml,/PullMessagesRequest/);
  assert.match(xml,/http:\/\/192\.168\.1\.20\/onvif\/events/);
  assert.match(xml,/PT5S/);
  assert.doesNotMatch(xml,/<wsse:Password[^>]*>secret</);
});

test("SubscriptionReference : même IPv4 privée obligatoire, query id accepté",()=>{
  assert.equal(validateSubscriptionEndpoint("http://192.168.1.20/Subscription?Idx=4","192.168.1.20").search,"?Idx=4");
  assert.throws(()=>validateSubscriptionEndpoint("http://192.168.1.21/Subscription","192.168.1.20"));
  assert.throws(()=>validateSubscriptionEndpoint("https://events.attacker.example/Subscription","192.168.1.20"));
  assert.throws(()=>validateSubscriptionEndpoint("http://operator:secret@192.168.1.20/Subscription","192.168.1.20"));
});

test("CreatePullPointSubscription : extrait le SubscriptionReference local",async()=>{
  const result=await createPullPointSubscription({
    endpoint:"http://192.168.1.20/onvif/events",sourceAddress:"192.168.1.20",username:"admin",password:"secret",
    fetchImpl:async(url,init)=>{
      assert.equal(url,"http://192.168.1.20/onvif/events");
      assert.equal(init.redirect,"error");
      assert.match(init.body,/CreatePullPointSubscription/);
      return response(envelope("<tev:CreatePullPointSubscriptionResponse><tev:SubscriptionReference><wsa:Address>http://192.168.1.20/Subscription?Idx=0</wsa:Address></tev:SubscriptionReference></tev:CreatePullPointSubscriptionResponse>"));
    }
  });
  assert.equal(result.endpoint,"http://192.168.1.20/Subscription?Idx=0");
});

test("NotificationMessage : classification limitée et IsMotion=false ignoré",()=>{
  const xml=envelope(
    '<wsnt:NotificationMessage><wsnt:Topic>tns1:RuleEngine/CellMotionDetector/Motion</wsnt:Topic><wsnt:Message><tt:Message UtcTime="2026-11-08T04:00:00Z"><tt:Data><tt:SimpleItem Name="IsMotion" Value="true"/></tt:Data></tt:Message></wsnt:NotificationMessage>'+
    '<wsnt:NotificationMessage><wsnt:Topic>tns1:RuleEngine/LineDetector/Crossed</wsnt:Topic><wsnt:Message><tt:Message UtcTime="2026-11-08T04:00:01Z"/></wsnt:Message></wsnt:NotificationMessage>'+
    '<wsnt:NotificationMessage><wsnt:Topic>tns1:Device/Tamper</wsnt:Topic><wsnt:Message><tt:Message UtcTime="2026-11-08T04:00:02Z"/></wsnt:Message></wsnt:NotificationMessage>'+
    '<wsnt:NotificationMessage><wsnt:Topic>tns1:RuleEngine/CellMotionDetector/Motion</wsnt:Topic><wsnt:Message><tt:Message UtcTime="2026-11-08T04:00:03Z"><tt:Data><tt:SimpleItem Name="IsMotion" Value="false"/></tt:Data></tt:Message></wsnt:NotificationMessage>'
  );
  const events=parseNotificationMessages(xml);
  assert.deepEqual(events.map(e=>e.eventType),["motion","line_crossing","camera_tamper"]);
  assert.equal(events[0].sourceType,"onvif");
  assert.equal(events[0].metadata.event_code,"tns1:RuleEngine/CellMotionDetector/Motion");
});

test("notification XML : DTD/XXE et dépassement de taille refusés",()=>{
  assert.throws(()=>parseNotificationMessages('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'+envelope("&xxe;")));
  assert.throws(()=>parseNotificationMessages("x".repeat(SOAP_LIMIT+1)));
});

test("identifiants ONVIF : AES-256-GCM et fichiers 0600",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"naxa-onvif-events-"));
  try{
    const item={cameraId:"a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20",sourceAddress:"192.168.1.20",endpoint:"http://192.168.1.20/onvif/events",username:"admin",password:"CameraSecret987"};
    writeOnvifEventConfigs(dir,[item]);
    assert.equal(fs.readFileSync(path.join(dir,"onvif-events.enc"),"utf8").includes("CameraSecret987"),false);
    assert.equal(readOnvifEventConfigs(dir)[0].password,"CameraSecret987");
    if(process.platform!=="win32"){
      assert.equal(fs.statSync(path.join(dir,"onvif-events.enc")).mode&0o777,0o600);
      assert.equal(fs.statSync(path.join(dir,"camera-streams.key")).mode&0o777,0o600);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("poller Pull-Point : Create, PullMessages puis Unsubscribe",async()=>{
  const calls=[],controller=new AbortController();
  const subscription=envelope("<tev:CreatePullPointSubscriptionResponse><tev:SubscriptionReference><wsa:Address>http://192.168.1.20/Subscription?Id=1</wsa:Address></tev:SubscriptionReference></tev:CreatePullPointSubscriptionResponse>");
  const notification=envelope('<wsnt:NotificationMessage><wsnt:Topic>tns1:RuleEngine/CellMotionDetector/Motion</wsnt:Topic><wsnt:Message><tt:Message UtcTime="2026-11-08T04:00:00Z"><tt:Data><tt:SimpleItem Name="IsMotion" Value="true"/></tt:Data></tt:Message></wsnt:NotificationMessage>');
  await runPullPointCollector({
    cameraId:"a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20",sourceAddress:"192.168.1.20",
    endpoint:"http://192.168.1.20/onvif/events",username:"operator",password:"secret",
    signal:controller.signal,
    onEvent:async e=>{calls.push("event:"+e.eventType);controller.abort();},
    fetchImpl:async(url,init)=>{
      if(/events$/.test(url)){calls.push("create");return response(subscription);}
      if(init.body.includes("PullMessages")){calls.push("pull");return response(notification);}
      calls.push("unsubscribe");return response(envelope("<wsnt:UnsubscribeResponse/>"));
    }
  });
  assert.ok(calls.includes("create"));
  assert.ok(calls.includes("pull"));
  assert.ok(calls.includes("event:motion"));
  assert.ok(calls.includes("unsubscribe"));
});
