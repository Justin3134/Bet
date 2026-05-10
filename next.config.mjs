/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type errors in convex/_generated/** are false positives from stub files.
    // Run `npx convex dev` to generate real types which resolve all of these.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
