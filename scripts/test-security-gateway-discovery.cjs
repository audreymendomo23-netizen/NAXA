const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
