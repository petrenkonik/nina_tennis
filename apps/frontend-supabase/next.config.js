const nextConfig = {
  // supabase-js — ESM-пакет; без serverExternalPackages он работает,
  // но вынесение улучшает cold start в serverless.
  serverExternalPackages: ["@supabase/ssr", "@supabase/supabase-js"],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    return config;
  },
}

module.exports = nextConfig;
