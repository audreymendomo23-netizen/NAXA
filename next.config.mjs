import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "worker/sw.ts",
  swDest: "public/sw.js",
  register: true,
  disable: process.env.NODE_ENV !== "production",
  cacheOnNavigation: false,
  additionalPrecacheEntries: [
    { url: "/offline.html", revision: "naxa-offline-20261106-v1" },
  ],
});

export default withSerwist({ reactStrictMode: true });
