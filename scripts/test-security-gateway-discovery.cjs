const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parseFlags, buildCanonicalMessage, makeSignedGatewayHeaders } = require("../services/security-gateway/agent.cjs");
const {
  isPrivateIpv4,
  isLocalHost,
  parseProbeMatch,
  buildProbeMessage,
} = require("../services/security-gateway/onvif-discovery.cjs");

function probe(xaddr = "http://192.168.1.20/onvif/device_service") {
  return [
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" ',
    'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" ',
    'xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">',
    "<s:Body><d:ProbeMatches><d:ProbeMatch>",
    "<wsa:EndpointReference><wsa:Address>urn:uuid:camera-001</wsa:Address></wsa:EndpointReference>",
    "<d:Types>dn:NetworkVideoTransmitter</d:Types>",
    "<d:Scopes>onvif://www.onvif.org/name/Camera%20Hall</d:Scopes>",
    "<d:XAddrs>", xaddr, "</d:XAddrs>",
    "</d:ProbeMatch></d:ProbeMatches></s:Body></s:Envelope>",
  ].join("");
}

test("ONVIF : accepte une réponse locale et ne renvoie que des métadonnées de découverte", () => {
  const result = parseProbeMatch(probe(), "192.168.1.25");
  assert.ok(result);
  assert.equal(result.deviceId, "urn:uuid:camera-001");
  assert.equal(result.sourceAddress, "192.168.1.25");
  assert.equal(result.endpoints[0], "http://192.168.1.20/onvif/device_service");
  assert.equal(result.types, "dn:NetworkVideoTransmitter");
});

test("ONVIF : rejette les sources publiques et les endpoints annoncés publics", () => {
  assert.equal(isPrivateIpv4("8.8.8.8"), false);
  assert.equal(parseProbeMatch(probe(), "8.8.8.8"), null);
  assert.equal(parseProbeMatch(probe("https://203.0.113.10/device"), "192.168.1.25"), null);
});

test("ONVIF : rejette URL avec identifiants, paramètres ou fragment", () => {
  assert.equal(parseProbeMatch(probe("http://user:pass@192.168.1.20/device"), "192.168.1.25"), null);
  assert.equal(parseProbeMatch(probe("http://192.168.1.20/device?token=x"), "192.168.1.25"), null);
  assert.equal(parseProbeMatch(probe("http://192.168.1.20/device#secret"), "192.168.1.25"), null);
});

test("ONVIF : plafonne le contenu et les hôtes locaux reconnus", () => {
  assert.equal(parseProbeMatch("x".repeat(17000), "192.168.1.25"), null);
  assert.equal(isLocalHost("192.168.0.5"), true);
  assert.equal(isLocalHost("camera-01.local"), true);
  assert.equal(isLocalHost("public.example.com"), false);
});

test("ONVIF : la sonde utilise WS-Discovery et ne contient aucun secret caméra", () => {
  const packet = buildProbeMessage();
  assert.match(packet, /239\.255\.255\.250|NetworkVideoTransmitter/);
  assert.match(packet, /ws-discovery|schemas\.xmlsoap\.org\/ws\/2005\/04\/discovery/i);
  assert.doesNotMatch(packet, /password|authorization|rtsp:\/\//i);
});

test("agent : découverte seulement sur commande explicite et confirmation réseau local", () => {
  const source = fs.readFileSync(path.join(__dirname, "../services/security-gateway/agent.cjs"), "utf8");
  assert.match(source, /command === "discover"/);
  assert.match(source, /--confirm-local-network/);
  assert.match(source, /discoverOnvifCameras/);
  const discovery = fs.readFileSync(path.join(__dirname, "../services/security-gateway/onvif-discovery.cjs"), "utf8");
  assert.match(discovery, /239\.255\.255\.250/);
});


test("agent : --confirm-local-network active le bon drapeau sans activer token-stdin", () => {
  const discoveryFlags = parseFlags(["--confirm-local-network", "--timeout-ms", "3500"]);
  assert.equal(discoveryFlags["confirm-local-network"], true);
  assert.equal(discoveryFlags["token-stdin"], undefined);
  assert.equal(discoveryFlags["timeout-ms"], "3500");
  const enrollFlags = parseFlags(["--token-stdin"]);
  assert.equal(enrollFlags["token-stdin"], true);
  assert.equal(enrollFlags["confirm-local-network"], undefined);
});


test("agent : rapport de découverte signé Ed25519 et lié au corps exact", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const gatewayId = "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20";
  const rawBody = JSON.stringify({ agentVersion: "0.1.0", devices: [] });
  const nowMs = 1794092400000;
  const nonce = crypto.randomBytes(24).toString("base64url");
  const headers = makeSignedGatewayHeaders({ gatewayId, privateKey: pair.privateKey, rawBody, nowMs, nonce });
  const canonical = buildCanonicalMessage(gatewayId, headers["X-NAXA-Timestamp"], nonce, rawBody);
  assert.equal(crypto.verify(null, canonical, pair.publicKey, Buffer.from(headers["X-NAXA-Signature"], "base64url")), true);
  assert.equal(crypto.verify(null, buildCanonicalMessage(gatewayId, headers["X-NAXA-Timestamp"], nonce, rawBody + " "), pair.publicKey, Buffer.from(headers["X-NAXA-Signature"], "base64url")), false);
});

test("agent : --submit est indépendant de --token-stdin et --confirm-local-network", () => {
  const flags = parseFlags(["--confirm-local-network", "--submit", "--timeout-ms", "3500"]);
  assert.equal(flags["confirm-local-network"], true);
  assert.equal(flags.submit, true);
  assert.equal(flags["token-stdin"], undefined);
  const enroll = parseFlags(["--token-stdin"]);
  assert.equal(enroll["token-stdin"], true);
  assert.equal(enroll.submit, undefined);
});

test("API : réception ONVIF authentifiée, anti-rejeu et candidat non activé", () => {
  const route = fs.readFileSync(path.join(__dirname, "../src/app/api/security/gateway/discoveries/route.ts"), "utf8");
  assert.match(route, /createPublicKey/);
  assert.match(route, /verify\(null/);
  assert.match(route, /naxa_security_gateway_request_nonces/);
  assert.match(route, /naxa_security_camera_discovery_candidates/);
  assert.match(route, /eq\("discovery_key", device\.discovery_key\)/);
  assert.match(route, /Ne jamais réinitialiser status, camera_id ou reviewed_by/);
  assert.match(route, /\.update\(candidateValues\)/);
  assert.match(route, /status: "pending"/);
  assert.doesNotMatch(route, /\.upsert\(/);
  assert.match(route, /isPrivateIpv4/);
  assert.match(route, /reviewRequired: true/);
  assert.doesNotMatch(route, /fetch\s*\(/);
  assert.doesNotMatch(route, /\.from\(["']naxa_security_cameras["']\)/);
});

test("Promoteur : validation explicite du candidat avant création caméra", () => {
  const actions = fs.readFileSync(path.join(__dirname, "../src/app/pharmacie/promoteur/actions.ts"), "utf8");
  const component = fs.readFileSync(path.join(__dirname, "../src/components/pharmacie/PromoteurSecuriteIntelligente.tsx"), "utf8");
  assert.match(actions, /function examinerCameraDecouverte/);
  assert.match(actions, /activeLinkIds\.has\(candidate\.pharmacie_id\)/);
  assert.match(actions, /candidate\.status !== "pending"/);
  assert.match(actions, /status: "registered"/);
  assert.match(actions, /connection_status: "discovered"/);
  assert.match(actions, /resource_type: "camera"/);
  assert.match(component, /Valider et ajouter/);
  assert.match(component, /Ignorer/);
  assert.match(component, /examinerCameraDecouverte/);
});
