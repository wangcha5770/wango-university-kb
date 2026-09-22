/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-only native/experimental module; keep it out of the client bundle.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
