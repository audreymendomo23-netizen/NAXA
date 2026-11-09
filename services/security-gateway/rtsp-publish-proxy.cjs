"use strict";

const net = require("node:net");
const tls = require("node:tls");

const MAX_CONTROL_MESSAGE = 1024 * 1024;

function splitRtspFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer[offset] === 0x24) {
      if (buffer.length - offset < 4) break;
      const length = buffer.readUInt16BE(offset + 2);
      const total = 4 + length;
      if (buffer.length - offset < total) break;
      frames.push({ interleaved: true, raw: buffer.subarray(offset, offset + total) });
      offset += total;
      continue;
    }
    const boundary = buffer.indexOf("\r\n\r\n", offset);
    if (boundary < 0) break;
    const header = buffer.subarray(offset, boundary + 4).toString("latin1");
    const match = /(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i.exec(header);
    const bodyLength = match ? Number(match[1]) : 0;
    if (!Number.isSafeInteger(bodyLength) || bodyLength < 0 || bodyLength > MAX_CONTROL_MESSAGE) {
      throw new Error("RTSP control message size invalid.");
    }
    const total = boundary + 4 - offset + bodyLength;
    if (buffer.length - offset < total) break;
    frames.push({ interleaved: false, raw: buffer.subarray(offset, offset + total) });
    offset += total;
  }
  return { frames, remainder: buffer.subarray(offset) };
}

function normalizePath(candidate, remotePath) {
  let url;
  try { url = new URL(candidate); } catch { return null; }
  const normalized = url.pathname.replace(/\/$/, "");
  if (normalized !== remotePath && !normalized.startsWith(remotePath + "/")) return null;
  return url.pathname + url.search;
}

function rewriteClientRequest(raw, { remoteBase, remotePath, authorization }) {
  const text = raw.toString("latin1");
  const boundary = text.indexOf("\r\n\r\n");
  if (boundary < 0) throw new Error("Malformed RTSP request.");
  const header = text.slice(0, boundary);
  const body = raw.subarray(boundary + 4);
  const lines = header.split("\r\n");
  const first = /^(\S+)\s+(\S+)\s+(RTSP\/1\.0)$/.exec(lines[0]);
  if (!first) throw new Error("Unsupported RTSP request line.");
  const method = first[1];
  const uri = first[2];
  let requestPath;
  if (uri === "*") requestPath = remotePath;
  else if (/^rtsp:\/\//i.test(uri) || /^rtsps:\/\//i.test(uri)) {
    requestPath = normalizePath(uri, remotePath);
  } else {
    requestPath = uri.startsWith("/") ? uri : "/" + uri;
    if (!requestPath.startsWith(remotePath) ||
      (requestPath !== remotePath && !requestPath.startsWith(remotePath + "/"))) return null;
  }
  if (!requestPath) return null;
  const mappedUri = remoteBase + requestPath;
  const rewritten = [method + " " + mappedUri + " RTSP/1.0"];
  let authorizationWritten = false;
  for (const line of lines.slice(1)) {
    if (/^Authorization:/i.test(line)) {
      rewritten.push("Authorization: " + authorization);
      authorizationWritten = true;
    } else if (/^Host:/i.test(line)) {
      rewritten.push("Host: " + remoteBase.replace(/^rtsps?:\\/\\//i, ""));
    } else {
      rewritten.push(line);
    }
  }
  if (!authorizationWritten) rewritten.splice(1, 0, "Authorization: " + authorization);
  return Buffer.concat([Buffer.from(rewritten.join("\r\n") + "\r\n\r\n", "latin1"), body]);
}

function rewriteServerResponse(raw, { remoteBase, localBase }) {
  const text = raw.toString("latin1");
  const boundary = text.indexOf("\r\n\r\n");
  if (boundary < 0) throw new Error("Malformed RTSP response.");
  let header = text.slice(0, boundary);
  let body = text.slice(boundary + 4);
  header = header.split(remoteBase).join(localBase);
  body = body.split(remoteBase).join(localBase);
  const contentLength = Buffer.byteLength(body, "latin1");
  if (/Content-Length:/i.test(header)) {
    header = header.replace(/(Content-Length:\s*)\d+/i, "$1" + contentLength);
  }
  return Buffer.from(header + "\r\n\r\n" + body, "latin1");
}

function createRtspPublishProxy(publishUrl, options = {}) {
  const target = new URL(publishUrl);
  if (target.protocol !== "rtsps:" || !target.username || !target.password ||
    !/^\/naxa\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(target.pathname) ||
    target.search || target.hash) {
    throw new Error("Ticket publisher RTSPS invalide.");
  }
  const username = decodeURIComponent(target.username);
  let password = decodeURIComponent(target.password);
  let authorization = "Basic " + Buffer.from(username + ":" + password, "utf8").toString("base64");
  const remoteBase = target.origin;
  const remotePath = target.pathname;
  const serverFactory = options.serverFactory || net.createServer;
  const tlsConnect = options.tlsConnect || tls.connect;
  const sockets = new Set();
  let localUrl = null;
  let localBase = null;
  let closed = false;
  let connectedClients = 0;

  const server = serverFactory((client) => {
    connectedClients += 1;
    if (connectedClients > 1) {
      client.destroy();
      return;
    }
    sockets.add(client);
    const upstream = tlsConnect({
      host: target.hostname,
      port: Number(target.port || 8322),
      servername: target.hostname,
      rejectUnauthorized: true,
    });
    sockets.add(upstream);
    let clientBuffer = Buffer.alloc(0);
    let serverBuffer = Buffer.alloc(0);
    const pendingClientWrites = [];
    let localReady = false;
    let clientClosed = false;
    const cleanup = () => {
      if (clientClosed) return;
      clientClosed = true;
      client.destroy();
      upstream.destroy();
      sockets.delete(client);
      sockets.delete(upstream);
    };
    client.on("error", cleanup);
    upstream.on("error", cleanup);
    client.on("close", cleanup);
    upstream.on("close", cleanup);

    client.on("data", (chunk) => {
      clientBuffer = Buffer.concat([clientBuffer, chunk]);
      let parsed;
      try { parsed = splitRtspFrames(clientBuffer); } catch { cleanup(); return; }
      clientBuffer = parsed.remainder;
      for (const frame of parsed.frames) {
        if (frame.interleaved) {
          if (localReady) upstream.write(frame.raw);
          else pendingClientWrites.push(frame.raw);
        } else {
          let rewritten;
          try {
            rewritten = rewriteClientRequest(frame.raw, { remoteBase, remotePath, authorization });
          } catch { cleanup(); return; }
          if (!rewritten) { cleanup(); return; }
          if (localReady) upstream.write(rewritten);
          else pendingClientWrites.push(rewritten);
        }
      }
    });

    upstream.once("secureConnect", () => {
      if (!upstream.authorized) { cleanup(); return; }
      localReady = true;
      for (const pending of pendingClientWrites.splice(0)) upstream.write(pending);
    });

    upstream.on("data", (chunk) => {
      serverBuffer = Buffer.concat([serverBuffer, chunk]);
      let parsed;
      try { parsed = splitRtspFrames(serverBuffer); } catch { cleanup(); return; }
      serverBuffer = parsed.remainder;
      for (const frame of parsed.frames) {
        if (frame.interleaved) client.write(frame.raw);
        else {
          try { client.write(rewriteServerResponse(frame.raw, { remoteBase, localBase })); }
          catch { cleanup(); return; }
        }
      }
    });
  });

  return {
    async listen() {
      if (closed) throw new Error("Proxy RTSP déjà fermé.");
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Local RTSP proxy unavailable.");
      localBase = "rtsp://127.0.0.1:" + address.port;
      localUrl = localBase + remotePath;
      return { url: localUrl };
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(() => resolve()));
      authorization = "";
      password = "";
      target.password = "";
      target.username = "";
    },
  };
}

module.exports = { splitRtspFrames, rewriteClientRequest, rewriteServerResponse, createRtspPublishProxy };
