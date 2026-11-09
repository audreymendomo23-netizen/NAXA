"use strict";
const dgram = require("node:dgram");
const NTP_EPOCH_SECONDS = 2208988800;
const NTP_EPOCH_MS = NTP_EPOCH_SECONDS * 1000;
function validateNtpServer(server) {
  if (typeof server !== "string" || server.length < 1 || server.length > 253 ||
    !/^[A-Za-z0-9.-]+$/.test(server) || server.startsWith(".") || server.endsWith(".")) throw new Error("Serveur NTP invalide.");
  return server;
}
function writeNtpTimestamp(packet, offset, unixMs) {
  if (!Buffer.isBuffer(packet) || offset < 0 || offset + 8 > packet.length || !Number.isFinite(unixMs) || unixMs < 0) throw new Error("Timestamp NTP invalide.");
  const ms = unixMs + NTP_EPOCH_MS;
  packet.writeUInt32BE(Math.floor(ms / 1000) >>> 0, offset);
  packet.writeUInt32BE(Math.floor((ms % 1000) * 0x100000000 / 1000) >>> 0, offset + 4);
}
function readNtpTimestamp(packet, offset) {
  if (!Buffer.isBuffer(packet) || packet.length < offset + 8) throw new Error("Réponse NTP tronquée.");
  const sec = packet.readUInt32BE(offset), frac = packet.readUInt32BE(offset + 4);
  if (sec === 0 && frac === 0) throw new Error("Horodatage NTP nul.");
  return (sec - NTP_EPOCH_SECONDS) * 1000 + frac * 1000 / 0x100000000;
}
function queryNtpTime({ server, port = 123, timeoutMs = 3000, now = Date.now, createSocket = () => dgram.createSocket("udp4") } = {}) {
  validateNtpServer(server);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 10000) throw new Error("Paramètres NTP invalides.");
  return new Promise((resolve, reject) => {
    const socket = createSocket(), req = Buffer.alloc(48), sentAt = now();
    req[0] = 0x23; // LI=0, VN=4, Mode=client.
    writeNtpTimestamp(req, 40, sentAt);
    let done = false;
    const timer = setTimeout(() => finish(new Error("Délai NTP dépassé.")), timeoutMs);
    if (timer.unref) timer.unref();
    function finish(error, value) {
      if (done) return;
      done = true; clearTimeout(timer);
      try { socket.close(); } catch {}
      if (error) reject(error); else resolve(value);
    }
    socket.once("error", (error) => finish(new Error("Échec NTP : " + (error.code || "NETWORK"))));
    socket.once("message", (res) => {
      const receivedAt = now();
      try {
        if (!Buffer.isBuffer(res) || res.length < 48) throw new Error("Réponse NTP tronquée.");
        const leap = (res[0] >> 6) & 3, version = (res[0] >> 3) & 7, mode = res[0] & 7, stratum = res[1];
        if (leap === 3 || ![3,4].includes(version) || ![4,5].includes(mode) || stratum < 1 || stratum > 15) throw new Error("Serveur NTP non synchronisé.");
        if (!res.subarray(24,32).equals(req.subarray(40,48))) throw new Error("Origine de réponse NTP incohérente.");
        const t2 = readNtpTimestamp(res,32), t3 = readNtpTimestamp(res,40);
        if (t3 < t2 || receivedAt < sentAt) throw new Error("Chronologie NTP incohérente.");
        const offsetMs = Math.round(((t2-sentAt)+(t3-receivedAt))/2);
        const roundTripMs = Math.max(0,Math.round((receivedAt-sentAt)-(t3-t2)));
        if (!Number.isSafeInteger(offsetMs) || Math.abs(offsetMs)>86400000 || !Number.isSafeInteger(roundTripMs) || roundTripMs>10000) throw new Error("Mesure NTP hors limites.");
        finish(null,{server,stratum,offsetMs,roundTripMs,measuredAt:new Date(receivedAt+offsetMs).toISOString(),deviceTimeAtSample:new Date(receivedAt).toISOString()});
      } catch (e) { finish(e instanceof Error?e:new Error("Réponse NTP invalide.")); }
    });
    try { socket.send(req,port,server,(error)=>{if(error)finish(new Error("Échec d'envoi NTP : "+(error.code||"NETWORK")));}); }
    catch { finish(new Error("Échec démarrage NTP.")); }
  });
}
function classifyClockSample({offsetMs,roundTripMs}) {
  if (!Number.isSafeInteger(offsetMs)||!Number.isSafeInteger(roundTripMs)||roundTripMs<0) throw new Error("Mesure temporelle invalide.");
  return Math.abs(offsetMs)<=1000&&roundTripMs<=1500?"synchronized":"warning";
}
module.exports={validateNtpServer,writeNtpTimestamp,readNtpTimestamp,queryNtpTime,classifyClockSample};
