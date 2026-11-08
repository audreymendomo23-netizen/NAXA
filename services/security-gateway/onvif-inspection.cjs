
"use strict";
const { isPrivateIpv4 } = require("./onvif-discovery.cjs");
const MAX_SOAP_BYTES = 32768;
const DEVICE_INFO_ACTION = "http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation";
const CAPABILITIES_ACTION = "http://www.onvif.org/ver10/device/wsdl/GetCapabilities";

function validateTarget(endpoint, sourceAddress) {
  if (!isPrivateIpv4(sourceAddress)) throw new TypeError("sourceAddress doit être une adresse IPv4 privée.");
  let url;
  try { url = new URL(endpoint); } catch { throw new TypeError("Endpoint ONVIF invalide."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.hostname !== sourceAddress ||
      url.href.length > 512 || url.pathname.length > 256) {
    throw new TypeError("L'endpoint doit viser exactement l'adresse IPv4 privée détectée, sans identifiants, paramètres ni fragment.");
  }
  return url;
}

function soapEnvelope(operation) {
  const body = operation === "GetDeviceInformation"
    ? "<tds:GetDeviceInformation/>"
    : "<tds:GetCapabilities><tds:Category>All</tds:Category></tds:GetCapabilities>";
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" ',
    'xmlns:tds="http://www.onvif.org/ver10/device/wsdl">',
    "<s:Body>", body, "</s:Body></s:Envelope>",
  ].join("");
}

function hasSoapEnvelope(xml) {
  return typeof xml === "string" && !/<!DOCTYPE|<!ENTITY/i.test(xml) &&
    /<(?:[A-Za-z_][\w.-]*:)?Envelope(?:\s|>)/i.test(xml);
}

function extractText(xml, localName, maxLength = 120) {
  const pattern = new RegExp(
    "<(?:(?:[A-Za-z_][\\w.-]*):)?" + localName +
    "\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?" + localName + "\\s*>",
    "i"
  );
  const match = pattern.exec(xml);
  if (!match) return null;
  return match[1].replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ")
    .trim().slice(0, maxLength) || null;
}

function hasElement(xml, localName) {
  return new RegExp("<(?:(?:[A-Za-z_][\\w.-]*):)?" + localName + "(?=[\\s/>])", "i").test(xml);
}

function extractElement(xml, localName) {
  const pattern = new RegExp("<(?:(?:[A-Za-z_][\\w.-]*):)?" + localName +
    "\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?" + localName + "\\s*>", "i");
  const match = pattern.exec(xml);
  return match ? match[1] : null;
}

function extractServiceXAddr(xml, serviceName, sourceAddress) {
  const service = extractElement(xml, serviceName);
  if (!service) return null;
  const address = extractText(service, "XAddr", 512);
  if (!address) return null;
  try { return validateTarget(address, sourceAddress).href; }
  catch { return null; }
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers && response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOAP_BYTES) {
    const error = new Error("Réponse ONVIF trop volumineuse.");
    error.code = "RESPONSE_TOO_LARGE";
    throw error;
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_SOAP_BYTES) {
      const error = new Error("Réponse ONVIF trop volumineuse.");
      error.code = "RESPONSE_TOO_LARGE";
      throw error;
    }
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > MAX_SOAP_BYTES) {
      try { await reader.cancel(); } catch {}
      const error = new Error("Réponse ONVIF trop volumineuse.");
      error.code = "RESPONSE_TOO_LARGE";
      throw error;
    }
    chunks.push(Buffer.from(part.value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function requestSoap({ endpoint, action, operation, timeoutMs, fetchImpl }) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": 'application/soap+xml; charset=utf-8; action="' + action + '"',
      "Accept": "application/soap+xml, application/xml, text/xml",
      "Cache-Control": "no-store",
    },
    body: soapEnvelope(operation),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
    redirect: "error",
  });
  if (response.redirected) return { ok: false, status: 0, reason: "redirect_refused" };
  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: response.status, reason: "credentials_required" };
  }
  if (!response.ok) return { ok: false, status: response.status, reason: "http_error" };
  const xml = await readBoundedBody(response);
  if (!hasSoapEnvelope(xml)) return { ok: false, status: response.status, reason: "invalid_soap" };
  return { ok: true, status: response.status, xml };
}

function mapNetworkFailure(error) {
  if (error && error.code === "RESPONSE_TOO_LARGE") return "response_too_large";
  if (error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return "network_error";
}

async function inspectOnvifDevice(options = {}) {
  const endpoint = validateTarget(options.endpoint, options.sourceAddress);
  const timeoutMs = Number(options.timeoutMs === undefined ? 4000 : options.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 10000) {
    throw new TypeError("timeoutMs doit être compris entre 1000 et 10000.");
  }
  const fetchImpl = options.fetchImpl || fetch;
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl invalide.");
  const base = {
    protocol: "onvif",
    endpointHost: endpoint.hostname,
    credentialsSent: false,
    streamOpened: false,
  };
  let device = { manufacturer: null, model: null, firmwareVersion: null };
  try {
    const info = await requestSoap({
      endpoint: endpoint.href, action: DEVICE_INFO_ACTION, operation: "GetDeviceInformation",
      timeoutMs, fetchImpl,
    });
    if (!info.ok) {
      if (info.reason === "credentials_required") {
        return { ...base, status: "requires_credentials", httpStatus: info.status, device };
      }
      return {
        ...base, status: info.reason === "invalid_soap" ? "not_onvif" : "unavailable",
        httpStatus: info.status, reason: info.reason, device,
      };
    }
    device = {
      manufacturer: extractText(info.xml, "Manufacturer"),
      model: extractText(info.xml, "Model"),
      firmwareVersion: extractText(info.xml, "FirmwareVersion"),
    };
    if (!device.manufacturer && !device.model) return { ...base, status: "not_onvif", device };

    const capabilitiesResponse = await requestSoap({
      endpoint: endpoint.href, action: CAPABILITIES_ACTION, operation: "GetCapabilities",
      timeoutMs, fetchImpl,
    });
    if (!capabilitiesResponse.ok) {
      if (capabilitiesResponse.reason === "credentials_required") {
        return { ...base, status: "requires_credentials", httpStatus: capabilitiesResponse.status, device };
      }
      return {
        ...base, status: capabilitiesResponse.reason === "invalid_soap" ? "not_onvif" : "unavailable",
        httpStatus: capabilitiesResponse.status, reason: capabilitiesResponse.reason, device,
      };
    }
    const xml = capabilitiesResponse.xml;
    const eventsAdvertised = hasElement(xml, "Events");
    const eventsEndpoint = extractServiceXAddr(xml, "Events", options.sourceAddress);
    const capabilities = {
      media: hasElement(xml, "Media"),
      events: hasElement(xml, "Events"),
      ptz: hasElement(xml, "PTZ"),
      imaging: hasElement(xml, "Imaging"),
      deviceIo: hasElement(xml, "DeviceIO"),
      analytics: hasElement(xml, "Analytics"),
    };
    return {
      ...base,
      status: capabilities.media ? "inspected" : "onvif_without_media",
      device,
      capabilities,
      eventsEndpoint,
      eventsEndpointStatus: !eventsAdvertised ? "not_advertised" : eventsEndpoint ? "local_endpoint_available" : "endpoint_missing_or_non_local",
      note: capabilities.media
        ? "Service média ONVIF annoncé ; les identifiants, profils vidéo et flux RTSP restent à tester séparément."
        : "Aucun service média ONVIF détecté dans GetCapabilities ; ne pas déclarer la caméra prête pour le live.",
    };
  } catch (error) {
    return { ...base, status: "unavailable", reason: mapNetworkFailure(error), device };
  }
}

module.exports = {
  MAX_SOAP_BYTES, DEVICE_INFO_ACTION, CAPABILITIES_ACTION, validateTarget,
  soapEnvelope, extractText, extractServiceXAddr, hasElement, inspectOnvifDevice,
};
