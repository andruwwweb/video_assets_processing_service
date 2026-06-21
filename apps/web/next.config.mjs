// Dev proxy: keep the dashboard same-origin with the API so the JWT cookie and
// requests work without CORS. WS connects directly (see NEXT_PUBLIC_WS_URL).
const target = process.env.API_PROXY_TARGET
if (!target) throw new Error('API_PROXY_TARGET is required (e.g. http://localhost:3000)')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${target}/v1/:path*` },
      { source: '/openapi.json', destination: `${target}/openapi.json` },
    ]
  },
}

export default nextConfig
