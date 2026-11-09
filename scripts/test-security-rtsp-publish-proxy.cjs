const test = require("node:test");
const assert = require("node:assert/strict");
const {
  splitRtspFrames,
  rewriteClientRequest,
  rewriteServerResponse,
  createRtspPublishProxy,
} = require("../services/security-gateway/rtsp-publish-proxy.cjs");

const CAMERA = "a4a4b1a1-4d0d-4b83-8db4-ae7c1b19ea20";
const REMOTE_PATH = "/naxa/" + CAMERA + "/" + CAMERA;
const REMOTE_BASE = "rtsps://video.example.test:8322";
const LOCAL_BASE = "rtsp://127.0.0.1:45321";

test("proxy RTSP : injecte le ticket publisher uniquement côté relais TLS", () => {
  const ticket = "very-short-lived-ticket";
  const authorization = "Basic " + Buffer.from(CAMERA + ":" + ticket).toString("base64");
  const request = Buffer.from(
    "ANNOUNCE " + LOCAL_BASE + REMOTE_PATH + " RTSP/1.0\r\nCSeq: 1\r\nContent-Length: 0\r\n\r\n",
    "latin1",
  );
  const rewritten = rewriteClientRequest(request, {
    remoteBase: REMOTE_BASE,
    remotePath: REMOTE_PATH,
    authorization,
  }).toString("latin1");
  assert.ok(rewritten.startsWith("ANNOUNCE " + REMOTE_BASE + REMOTE_PATH + " RTSP/1.0"));
  assert.ok(rewritten.includes("Authorization: " + authorization));
  assert.equal(rewritten.includes(ticket), false);
  assert.equal(rewritten.includes(LOCAL_BASE), false);
});

test("proxy RTSP : refuse toute URI de caméra ou de chemin hors ticket", () => {
  const authorization = "Basic " + Buffer.from(CAMERA + ":ticket").toString("base64");
  const outside = Buffer.from(
    "ANNOUNCE rtsp://127.0.0.1:45321/naxa/other/path RTSP/1.0\r\nCSeq: 1\r\n\r\n",
    "latin1",
  );
  assert.equal(rewriteClientRequest(outside, {
    remoteBase: REMOTE_BASE,
    remotePath: REMOTE_PATH,
    authorization,
  }), null);
});

test("proxy RTSP : réécrit Content-Base et SDP pour garder le lecteur dans le tunnel loopback", () => {
  const body = "v=0\r\na=control:" + REMOTE_BASE + REMOTE_PATH + "/trackID=0\r\n";
  const response = Buffer.from(
    "RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Base: " + REMOTE_BASE + REMOTE_PATH + "/\r\n" +
    "Content-Type: application/sdp\r\nContent-Length: " + Buffer.byteLength(body) + "\r\n\r\n" + body,
    "latin1",
  );
  const rewritten = rewriteServerResponse(response, {
    remoteBase: REMOTE_BASE,
    localBase: LOCAL_BASE,
  }).toString("latin1");
  assert.equal(rewritten.includes(REMOTE_BASE), false);
  assert.ok(rewritten.includes("Content-Base: " + LOCAL_BASE + REMOTE_PATH + "/"));
  assert.ok(rewritten.includes("a=control:" + LOCAL_BASE + REMOTE_PATH + "/trackID=0"));
  const actualBody = rewritten.split("\r\n\r\n")[1];
  assert.equal(/Content-Length: (\d+)/i.exec(rewritten)[1], String(Buffer.byteLength(actualBody, "latin1")));
});

test("proxy RTSP : le parseur supporte messages fragmentés et paquets RTP intercalés", () => {
  const message = Buffer.from("OPTIONS * RTSP/1.0\r\nCSeq: 3\r\n\r\n", "latin1");
  const first = splitRtspFrames(message.subarray(0, 10));
  assert.equal(first.frames.length, 0);
  const second = splitRtspFrames(Buffer.concat([first.remainder, message.subarray(10)]));
  assert.equal(second.frames.length, 1);
  assert.equal(second.frames[0].interleaved, false);

  const rtp = Buffer.from([0x24, 0x00, 0x00, 0x03, 0x80, 0x60, 0x00]);
  const parsed = splitRtspFrames(rtp);
  assert.equal(parsed.frames.length, 1);
  assert.equal(parsed.frames[0].interleaved, true);
});

test("proxy RTSP : URL publisher TLS stricte et écoute loopback uniquement", async () => {
  const ticketUrl = REMOTE_BASE.replace("rtsps://", "rtsps://" + CAMERA + ":ticket@") + REMOTE_PATH;
  const proxy = createRtspPublishProxy(ticketUrl);
  const local = await proxy.listen();
  try {
    const parsed = new URL(local.url);
    assert.equal(parsed.protocol, "rtsp:");
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.equal(parsed.username, "");
    assert.equal(parsed.password, "");
    assert.equal(parsed.pathname, REMOTE_PATH);
  } finally {
    await proxy.close();
  }
  assert.throws(() => createRtspPublishProxy("rtsp://user:pass@video.example.test:554" + REMOTE_PATH));
  assert.throws(() => createRtspPublishProxy(REMOTE_BASE + "/other/path"));
});

test("proxy RTSP : relaie une requête vers TLS et réécrit la réponse sans exposer le ticket au client", async () => {
  const { EventEmitter } = require("node:events");
  let acceptClient;
  const upstreamWrites = [];
  const clientWrites = [];
  const tlsOptions = [];
  class FakeServer extends EventEmitter {
    listen(_port, _host, callback) { callback(); }
    address() { return { port: 45678, address: "127.0.0.1" }; }
    close(callback) { callback(); }
  }
  class FakeSocket extends EventEmitter {
    write(buffer) { clientWrites.push(Buffer.from(buffer)); }
    destroy() { this.emit("close"); }
  }
  const fakeUpstream = new EventEmitter();
  fakeUpstream.authorized = true;
  fakeUpstream.write = (buffer) => upstreamWrites.push(Buffer.from(buffer));
  fakeUpstream.destroy = () => fakeUpstream.emit("close");
  const ticketUrl = REMOTE_BASE.replace("rtsps://", "rtsps://" + CAMERA + ":one-use-ticket@") + REMOTE_PATH;
  const proxy = createRtspPublishProxy(ticketUrl, {
    serverFactory: (handler) => { acceptClient = handler; return new FakeServer(); },
    tlsConnect: (options) => {
      tlsOptions.push(options);
      setImmediate(() => fakeUpstream.emit("secureConnect"));
      return fakeUpstream;
    },
  });
  const local = await proxy.listen();
  const client = new FakeSocket();
  acceptClient(client);
  client.emit("data", Buffer.from(
    "ANNOUNCE " + local.url + " RTSP/1.0\\r\\nCSeq: 9\\r\\nContent-Length: 0\\r\\n\\r\\n",
    "latin1",
  ));
  await new Promise((resolve) => setImmediate(resolve));
  const request = Buffer.concat(upstreamWrites).toString("latin1");
  assert.ok(request.includes("ANNOUNCE " + REMOTE_BASE + REMOTE_PATH));
  assert.ok(request.includes("Authorization: Basic "));
  assert.equal(request.includes("one-use-ticket"), false);
  assert.equal(tlsOptions[0].servername, "video.example.test");
  assert.equal(tlsOptions[0].rejectUnauthorized, true);

  const body = "v=0\\r\\na=control:" + REMOTE_BASE + REMOTE_PATH + "/trackID=0\\r\\n";
  fakeUpstream.emit("data", Buffer.from(
    "RTSP/1.0 200 OK\\r\\nCSeq: 9\\r\\nContent-Base: " + REMOTE_BASE + REMOTE_PATH + "/\\r\\n" +
    "Content-Type: application/sdp\\r\\nContent-Length: " + Buffer.byteLength(body) + "\\r\\n\\r\\n" + body,
    "latin1",
  ));
  const response = Buffer.concat(clientWrites).toString("latin1");
  assert.ok(response.includes("Content-Base: " + local.url + "/"));
  assert.equal(response.includes(REMOTE_BASE), false);
  await proxy.close();
});
