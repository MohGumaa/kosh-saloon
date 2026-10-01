import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  experimental: {
    // The default caps a whole Server Action request at 1 MB, which a 1 MB logo plus its form encoding exceeds.
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    // The salon logo is stored in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
