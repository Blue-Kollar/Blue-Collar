import { buildSpec } from './spec.js'

type Spec = ReturnType<typeof buildSpec>

/**
 * v1 and v2 mount the exact same Express routers (see app.ts), so their
 * documented surface is identical apart from the path prefix and a couple of
 * response-shape differences called out per-endpoint in `spec.ts`. Deriving v2
 * from the v1 document (rather than hand-maintaining a second registry) is
 * what keeps `/api/v1/docs` and `/api/v2/docs` from drifting out of sync with
 * each other and with `openapi.json`.
 */
function withVersionMeta(spec: Spec, version: 'v1' | 'v2'): Spec {
  return {
    ...spec,
    info: { ...spec.info, version, description: `BlueCollar API - Version ${version}` },
    servers: [
      { url: `http://localhost:3000/api/${version}`, description: 'Local' },
      { url: `https://api.bluecollar.app/api/${version}`, description: 'Production' },
    ],
  }
}

function reprefixPaths(spec: Spec, from: string, to: string): Spec {
  const paths = Object.fromEntries(
    Object.entries(spec.paths ?? {}).map(([path, def]) => [path.replace(from, to), def]),
  )
  return { ...spec, paths }
}

export const openApiSpecV1 = withVersionMeta(buildSpec(), 'v1')
export const openApiSpecV2 = withVersionMeta(reprefixPaths(buildSpec(), '/api/v1/', '/api/v2/'), 'v2')
