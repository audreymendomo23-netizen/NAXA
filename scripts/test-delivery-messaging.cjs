const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const test=require("node:test");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const sql=read("supabase/migrations/20261107153000_delivery_mission_messaging.sql");
const locationSql=read("supabase/migrations/20261107093806_delivery_mission_bidirectional_location_sharing.sql");
const missions=read("supabase/migrations/20261107152000_delivery_courier_cash_status_read_model.sql");
const chat=read("src/components/DeliveryMissionChat.tsx");
const courier=read("src/components/pharmacie/LivreurWorkspaceClient.tsx");
const clientTracking=read("src/components/SuiviLivraison.tsx");

test("le numéro Client n'est renvoyé qu'au Livreur auquel la mission est attribuée",()=>{
  assert.match(missions,/'telephone',case when m\.livreur_id=v_uid then r\.telephone_livraison else null end/);
  assert.match(courier,/m\.telephone\s*\?\s*<a href=\{"tel:"\+m\.telephone\}/);
  assert.match(courier,/viewer="livreur"/);
});

test("la lecture de la messagerie est réservée au Client propriétaire ou au Livreur attribué",()=>{
  assert.match(sql,/v_uid<>v_m\.client_id/);
  assert.match(sql,/v_uid is distinct from v_m\.livreur_id/);
  assert.match(sql,/public\.naxa_business_function\(v_uid\)<>'livreur'/);
  assert.match(sql,/if v_m\.livreur_id is null then[\s\S]*?'available',false/);
});

test("l'écriture de texte est limitée aux deux participants et aux missions actives",()=>{
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

test("les deux participants peuvent envoyer une position GPS privée dans la mission",()=>{
  assert.match(locationSql,/message_type text not null default 'text'/);
  assert.match(locationSql,/latitude between -90 and 90/);
  assert.match(locationSql,/longitude between -180 and 180/);
  assert.match(locationSql,/v_uid=v_m\.client_id/);
  assert.match(locationSql,/v_uid=v_m\.livreur_id and public\.naxa_business_function\(v_uid\)='livreur'/);
  assert.match(locationSql,/v_m\.statut not in \('accepted','picked_up','arrived'\)/);
  assert.match(locationSql,/revoke all on function public\.naxa_delivery_send_location[\s\S]*?from public,anon/);
  assert.match(locationSql,/grant execute on function public\.naxa_delivery_send_location[\s\S]*?to authenticated/);
  assert.match(locationSql,/'latitude',msg\.latitude/);
  assert.match(locationSql,/'longitude',msg\.longitude/);
  assert.match(locationSql,/Une position a été partagée dans votre conversation de livraison/);
});

test("le Client et le Livreur peuvent partager leur position et ouvrir celle reçue sur une carte",()=>{
  assert.match(courier,/href=\{"tel:"\+m\.telephone\}/);
  assert.match(courier,/DeliveryMissionChat reservationId=\{m\.reservation_id\} viewer="livreur"/);
  assert.match(clientTracking,/DeliveryMissionChat reservationId=\{reservationId\} viewer="client"/);
  assert.match(chat,/navigator\.geolocation\.getCurrentPosition/);
  assert.match(chat,/naxa_delivery_send_location/);
  assert.match(chat,/Voir la position sur la carte/);
  assert.match(chat,/openstreetmap\.org/);
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

process.stdout.write("Contrat de messagerie privée et de partage bidirectionnel de position Client-Livreur vérifié.\\n");
