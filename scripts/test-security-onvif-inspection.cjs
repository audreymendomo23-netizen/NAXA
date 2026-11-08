
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { inspectOnvifDevice, validateTarget, MAX_SOAP_BYTES } =
  require("../services/security-gateway/onvif-inspection.cjs");

function envelope(body) {
  return '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>' +
    body + "</s:Body></s:Envelope>";
}
function response(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/soap+xml; charset=utf-8" },
  });
}

test("ONVIF : identifie le modèle et les capacités sans demander de flux", async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (requests.length === 1) {
      return response(envelope(
        "<tds:GetDeviceInformationResponse>" +
        "<tds:Manufacturer>Hikvision</tds:Manufacturer>" +
        "<tds:Model>DS-2CD Demo</tds:Model>" +
        "<tds:FirmwareVersion>V5.7</tds:FirmwareVersion>" +
        "</tds:GetDeviceInformationResponse>"
      ));
    }
    return response(envelope(
      "<tds:GetCapabilitiesResponse><tds:Capabilities>" +
      "<tt:Media/><tt:Events/><tt:PTZ/><tt:Imaging/>" +
      "</tds:Capabilities></tds:GetCapabilitiesResponse>"
    ));
  };
  const result = await inspectOnvifDevice({
    endpoint: "http://192.168.1.20/onvif/device_service",
    sourceAddress: "192.168.1.20",
    fetchImpl,
  });
  assert.equal(result.status, "inspected");
  assert.equal(result.device.manufacturer, "Hikvision");
  assert.equal(result.device.model, "DS-2CD Demo");
  assert.equal(result.device.firmwareVersion, "V5.7");
  assert.equal(result.capabilities.media, true);
  assert.equal(result.capabilities.events, true);
  assert.equal(result.capabilities.ptz, true);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.redirect, "error");
    assert.equal(request.init.headers.Authorization, undefined);
    assert.doesNotMatch(request.init.body, /GetStreamUri|GetProfiles|rtsp:\/\//i);
  }
  assert.equal(result.credentialsSent, false);
  assert.equal(result.streamOpened, false);
});

test("ONVIF : une demande d'identifiants n'est jamais contournée", async () => {
  let calls = 0;
  const result = await inspectOnvifDevice({
    endpoint: "http://192.168.1.21/onvif/device_service",
    sourceAddress: "192.168.1.21",
    fetchImpl: async () => { calls += 1; return response("", 401); },
  });
  assert.equal(result.status, "requires_credentials");
  assert.equal(result.httpStatus, 401);
  assert.equal(calls, 1);
  assert.equal(result.credentialsSent, false);
});

test("ONVIF : refuse les endpoints publics, différents de la source ou avec identifiants", () => {
  assert.throws(() => validateTarget("https://camera.example.com/onvif/device_service", "192.168.1.22"));
  assert.throws(() => validateTarget("http://192.168.1.23/onvif/device_service", "192.168.1.22"));
  assert.throws(() => validateTarget("http://user:pass@192.168.1.22/onvif/device_service", "192.168.1.22"));
});

test("ONVIF : un appareil sans service média n'est pas présenté comme prêt pour le live", async () => {
  const fetchImpl = async (url, init) => {
    if (/GetDeviceInformation/.test(init.body)) {
      return response(envelope(
        "<tds:GetDeviceInformationResponse><tds:Manufacturer>CamCo</tds:Manufacturer>" +
        "<tds:Model>DoorSensor</tds:Model></tds:GetDeviceInformationResponse>"
      ));
    }
    return response(envelope("<tds:GetCapabilitiesResponse><tt:Events/></tds:GetCapabilitiesResponse>"));
  };
  const result = await inspectOnvifDevice({
    endpoint: "http://10.0.0.22/onvif/device_service",
    sourceAddress: "10.0.0.22",
    fetchImpl,
  });
  assert.equal(result.status, "onvif_without_media");
  assert.equal(result.capabilities.media, false);
  assert.equal(result.streamOpened, false);
});

test("ONVIF : plafonne les réponses et neutralise les erreurs réseau", async () => {
  const result = await inspectOnvifDevice({
    endpoint: "http://172.16.0.9/onvif/device_service",
    sourceAddress: "172.16.0.9",
    fetchImpl: async () => response("x".repeat(MAX_SOAP_BYTES + 1)),
  });
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "response_too_large");
  assert.equal(result.streamOpened, false);
});

test("Passerelle : la commande inspect impose la confirmation locale et reste sans transmission", () => {
  const agent = fs.readFileSync(path.join(__dirname, "../services/security-gateway/agent.cjs"), "utf8");
  assert.match(agent, /if \(command === "inspect"\) return inspect\(args\)/);
  assert.match(agent, /--confirm-local-network/);
  assert.match(agent, /Le diagnostic ONVIF ne transmet aucune donnée/);
  assert.match(agent, /inspectOnvifDevice/);
});
