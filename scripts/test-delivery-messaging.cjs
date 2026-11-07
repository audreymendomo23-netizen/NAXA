const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const test=require("node:test");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const sql=read("supabase/migrations/20261107153000_delivery_mission_messaging.sql");
const missions=read("supabase/migrations/20261107152000_delivery_courier_cash_status_read_model.sql");
const chat=read("src/components/DeliveryMissionChat.tsx");
const courier=read("src/components/pharmacie/LivreurWorkspaceClient.tsx");
const clientTracking=read("src/components/SuiviLivraison.tsx");

test("le numéro Client n'est renvoyé qu'au Livreur auquel la mission est attribuée",()=>{
  assert.match(missions,/'telephone',case when m\.livreur_id=v_uid then r\.telephone_livraison else null end/);
  assert.match(courier,/m\.telephone\s*\?\s*<a href=\{\"tel:\"\+m\.telephone\}/);
  assert.match(courier,/viewer=\"livreur\"/);
});

test("la lecture de la messagerie est réservée au Client propriétaire ou au Livreur attribué",()=>{
  assert.match(sql,/v_uid<>v_m\.client_id/);
  assert.match(sql,/v_uid is distinct from v_m\.livreur_id/);
  assert.match(sql,/public\.naxa_business_function\(v_uid\)<>'livreur'/);
  assert.match(sql,/if v_m\.livreur_id is null then[\s\S]*?'available',false/);
});

test("l'écriture est limitée aux missions acceptées/en cours et aux deux participants",()=>{
  assert.match(sql,/v_m\.statut not in \('accepted','picked_up','arrived'\)/);
  assert.match(sql,/if v_uid=v_m\.client_id then/);
  assert.match(sql,/elsif v_uid=v_m\.livreur_id and public\.naxa_business_function\(v_uid\)='livreur' then/);
  assert.match(sql,/length\(v_body\)>1000/);
  assert.match(sql,/>=12 then[\s\S]*?patienter/);
});

test("les messages sont isolés en base et déclenchent une notification à l'autre participant",()=>{
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.naxa_delivery_mission_messages from public,anon,authenticated/);
  assert.match(sql,/insert into public\.notifications/);
  assert.match(sql,/grant execute on function public\.naxa_delivery_list_messages\(uuid\) to authenticated/);
  assert.match(sql,/grant execute on function public\.naxa_delivery_send_message\(uuid,text\) to authenticated/);
});

test("les deux applications exposent l'appel et la messagerie NAXA",()=>{
  assert.match(courier,/href=\{\"tel:\"\+m\.telephone\}/);
  assert.match(courier,/DeliveryMissionChat reservationId=\{m\.reservation_id\} viewer=\"livreur\"/);
  assert.match(clientTracking,/DeliveryMissionChat reservationId=\{reservationId\} viewer=\"client\"/);
  assert.match(chat,/naxa_delivery_list_messages/);
  assert.match(chat,/naxa_delivery_send_message/);
  assert.match(chat,/setInterval\(\(\)\s*=>\s*void load\(\),5000\)/);
});

test("les composants de messagerie TSX sont syntaxiquement valides",()=>{
  for(const file of [
    "src/components/DeliveryMissionChat.tsx",
    "src/components/SuiviLivraison.tsx",
    "src/components/pharmacie/LivreurWorkspaceClient.tsx"
  ]){
    const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length,0,file+": "+parsed.parseDiagnostics.map(d=>d.messageText).join("; "));
  }
});

process.stdout.write("Contrat d'appel et messagerie privée Client-Livreur vérifié.\\n");
