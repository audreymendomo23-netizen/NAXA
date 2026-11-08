"use strict";

const dgram = require("node:dgram");
const net = require("node:net");
const crypto = require("node:crypto");

const MULTICAST_ADDRESS = "239.255.255.250";
const MULTICAST_PORT = 3702;
const MAX_PACKET_BYTES = 16384;

function isPrivateIpv4(value) {
  if (net.isIP(value) !== 4) return false;
  const parts = value.split(".").map(Number);
  const [a, b] = parts;
  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254);
}

function isLocalHost(value) {
  const host = String(value || "").replace(/^\[|\]$/g, "").toLowerCase();
  const version = net.isIP(host);
  if (version === 4) return isPrivateIpv4(host);
  if (version === 6) {
    return host === "::1" || /^f[cd]/i.test(host) || /^fe[89ab]/i.test(host);
  }
  return host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    /^[a-z0-9-]{1,63}$/.test(host);
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanText(value, maxLength) {
  return decodeXmlEntities(value)
    .replace(/[\u0000-\u001f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function extractTag(xml, localName) {
  const pattern = new RegExp(
    "<(?:(?:[A-Za-z_][\\w.-]*):)?" + localName +
      "\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?" +
      localName + "\\s*>",
    "i"
  );
  const match = pattern.exec(xml);
  return match ? match[1].trim() : "";
}

function parseProbeMatch(xml, sourceAddress) {
  if (typeof xml !== "string" || Buffer.byteLength(xml, "utf8") > MAX_PACKET_BYTES) return null;
  if (!isPrivateIpv4(sourceAddress)) return null;
  if (!/<(?:[A-Za-z_][\w.-]*:)?ProbeMatch(?:\s|>)/i.test(xml)) return null;

  const endpointBlock = extractTag(xml, "EndpointReference");
  const deviceId = cleanText(extractTag(endpointBlock, "Address"), 160);
  const types = cleanText(extractTag(xml, "Types"), 512);
  const scopes = cleanText(extractTag(xml, "Scopes"), 1024);
  const rawXAddrs = cleanText(extractTag(xml, "XAddrs"), 2048);
  const endpoints = [];

  for (const candidate of rawXAddrs.split(/\s+/).filter(Boolean).slice(0, 4)) {
    try {
      const url = new URL(candidate);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username || url.password || url.search || url.hash ||
        url.href.length > 512 || url.pathname.length > 256 ||
        !isLocalHost(url.hostname)
      ) continue;
      const safeEndpoint = url.protocol + "//" + url.host + url.pathname;
      if (!endpoints.includes(safeEndpoint)) endpoints.push(safeEndpoint);
    } catch {
      // Une adresse annoncée qui n'est pas une URL exploitable est ignorée.
    }
  }

  if (endpoints.length === 0) return null;
  return {
    deviceId: deviceId || null,
    sourceAddress,
    types,
    scopes,
    endpoints,
  };
}

function buildProbeMessage() {
  const messageId = "urn:uuid:" + crypto.randomUUID();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" ',
    'xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" ',
    'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" ',
    'xmlns:dn="http://www.onvif.org/ver10/network/wsdl">',
    "<e:Header>",
    "<w:MessageID>", messageId, "</w:MessageID>",
    "<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>",
    "<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>",
    "</e:Header>",
    "<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body>",
    "</e:Envelope>",
  ].join("");
}

function discoverOnvifCameras(options = {}) {
  const timeoutMs = Number(options.timeoutMs === undefined ? 3500 : options.timeoutMs);
  const maxDevices = Number(options.maxDevices === undefined ? 64 : options.maxDevices);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 8000) {
    throw new TypeError("timeoutMs doit être compris entre 1000 et 8000.");
  }
  if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 64) {
    throw new TypeError("maxDevices doit être compris entre 1 et 64.");
  }

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const discovered = new Map();
    let timer = null;
    let finished = false;

    const finish = (error) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      try { socket.close(); } catch {}
      if (error) reject(error);
      else resolve(Array.from(discovered.values()));
    };

    socket.on("error", finish);
    socket.on("message", (message, remote) => {
      if (finished || message.length > MAX_PACKET_BYTES || !isPrivateIpv4(remote.address)) return;
      const parsed = parseProbeMatch(message.toString("utf8"), remote.address);
      if (!parsed) return;
      const identity = parsed.deviceId || parsed.endpoints.join("|");
      if (!discovered.has(identity) && discovered.size >= maxDevices) return;
      discovered.set(identity, parsed);
    });

    socket.bind(0, "0.0.0.0", () => {
      try {
        socket.setMulticastTTL(1);
        const packet = Buffer.from(buildProbeMessage(), "utf8");
        timer = setTimeout(() => finish(), timeoutMs);
        socket.send(packet, 0, packet.length, MULTICAST_PORT, MULTICAST_ADDRESS, (error) => {
          if (error) finish(error);
        });
      } catch (error) {
        finish(error);
      }
    });
  });
}

module.exports = {
  isPrivateIpv4,
  isLocalHost,
  parseProbeMatch,
  buildProbeMessage,
  discoverOnvifCameras,
};
