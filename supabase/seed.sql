insert into pharmacies(id,nom,quartier,adresse,lat,lng,de_garde,stock_updated_at)values
('00000000-0000-0000-0000-000000000001','Pharmacie Démo Centre','Centre-ville','Démo',3.8667,11.5167,true,now()),
('00000000-0000-0000-0000-000000000002','Pharmacie Démo Mvan','Mvan','Démo',3.8190,11.5170,false,now()),
('00000000-0000-0000-0000-000000000003','Pharmacie Démo Biyem-Assi','Biyem-Assi','Démo',3.8300,11.4900,false,now());
insert into pharmacie_privee(pharmacie_id,whatsapp,code_marchand)values
('00000000-0000-0000-0000-000000000001','237600000001','000001'),('00000000-0000-0000-0000-000000000002','237600000002','000002'),('00000000-0000-0000-0000-000000000003','237600000003','000003');
insert into produits(nom,dci,dosage,forme)values('Doliprane','Paracétamol','500 mg','comprimé'),('Efferalgan','Paracétamol','500 mg','comprimé'),('Amoxicilline','Amoxicilline','500 mg','gélule');
insert into stocks(pharmacie_id,produit_id,prix,quantite)select ph.id,pr.id,1000+(random()*800)::int,3+(random()*20)::int from pharmacies ph cross join produits pr;