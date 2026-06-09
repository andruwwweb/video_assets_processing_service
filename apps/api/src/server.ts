import { loadEnv } from '@mpp/config'
import { buildApp } from './app'

const env = loadEnv()
const app = buildApp()

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  try {
    await app.close()
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'error during shutdown')
    process.exit(1)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

try {
  const address = await app.listen({ port: env.API_PORT, host: env.API_HOST })
  app.log.info(`API listening on ${address}`)
} catch (err) {
  app.log.error({ err }, 'failed to start')
  process.exit(1)
}
