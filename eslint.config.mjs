import next from "eslint-config-next";

// Discord avatars are hotlinked straight from the CDN with
// `referrerPolicy="no-referrer"`. Routing them through next/image would proxy
// every avatar through our origin, which is both slower and a larger leak
// surface, so the plain <img> is deliberate here.
const config = [
  { ignores: [".next/**", "node_modules/**", "scripts/**"] },
  ...next,
  { rules: { "@next/next/no-img-element": "off" } },
];

export default config;