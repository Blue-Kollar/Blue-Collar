import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSpec } from '@/openapi/spec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

type OpenAPISpec = ReturnType<typeof buildSpec>;

interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<string, { description?: string }>;
}

interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  trace?: OperationObject;
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

function renderOverview(spec: OpenAPISpec): string {
  const lines: string[] = [];
  const info =
    (spec as { info?: { title?: string; version?: string; description?: string } }).info ?? {};
  lines.push(`# ${info.title ?? 'API Reference'}`);
  lines.push('');
  if (info.version) {
    lines.push(`**Version:** ${info.version}`);
    lines.push('');
  }
  if (info.description) {
    lines.push(info.description);
    lines.push('');
  }

  const servers =
    (spec as { servers?: Array<{ url: string; description?: string }> }).servers ?? [];
  if (servers.length > 0) {
    lines.push('## Servers');
    lines.push('');
    for (const server of servers) {
      lines.push(`- \`${server.url}\`${server.description ? ` — ${server.description}` : ''}`);
    }
    lines.push('');
  }

  const components = (
    spec as {
      components?: {
        securitySchemes?: Record<
          string,
          { type?: string; scheme?: string; bearerFormat?: string; description?: string }
        >;
      };
    }
  ).components;
  const schemes = components?.securitySchemes ?? {};
  if (Object.keys(schemes).length > 0) {
    lines.push('## Security Schemes');
    lines.push('');
    for (const [name, scheme] of Object.entries(schemes)) {
      const detail = [scheme.type, scheme.scheme, scheme.bearerFormat].filter(Boolean).join(' / ');
      lines.push(
        `- **${name}**${detail ? ` (${detail})` : ''}${scheme.description ? ` — ${scheme.description}` : ''}`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function isAuthRequired(op: OperationObject): boolean {
  if (op.security && op.security.length > 0) {
    return true;
  }
  return false;
}

function renderRequestBody(op: OperationObject): string[] {
  const lines: string[] = [];
  const body = op.requestBody;
  if (!body || !body.content) {
    return lines;
  }
  const contentTypes = Object.keys(body.content);
  if (contentTypes.length === 0) {
    return lines;
  }
  const contentType = contentTypes[0];
  const schema = body.content[contentType]?.schema;
  const schemaName = extractSchemaName(schema);
  lines.push(
    `- **Request body** (${contentType}${body.required ? ', required' : ''}): ${schemaName}`,
  );
  return lines;
}

function extractSchemaName(schema: unknown): string {
  if (!schema || typeof schema !== 'object') {
    return '`object`';
  }
  const s = schema as { $ref?: string; type?: string };
  if (typeof s.$ref === 'string') {
    const parts = s.$ref.split('/');
    return `\`${parts[parts.length - 1]}\``;
  }
  if (typeof s.type === 'string') {
    return `\`${s.type}\``;
  }
  return '`object`';
}

function renderResponses(op: OperationObject): string[] {
  const lines: string[] = [];
  const responses = op.responses ?? {};
  const codes = Object.keys(responses).sort();
  if (codes.length === 0) {
    return lines;
  }
  const formatted = codes.map((code) => {
    const desc = responses[code]?.description;
    return desc ? `\`${code}\` (${desc})` : `\`${code}\``;
  });
  lines.push(`- **Responses:** ${formatted.join(', ')}`);
  return lines;
}

function renderEndpoints(spec: OpenAPISpec): string {
  const lines: string[] = [];
  const paths = (spec as { paths?: Record<string, PathItemObject> }).paths ?? {};

  const byTag = new Map<string, Array<{ method: string; path: string; op: OperationObject }>>();

  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op) continue;
      const tags = op.tags && op.tags.length > 0 ? op.tags : ['default'];
      for (const tag of tags) {
        if (!byTag.has(tag)) {
          byTag.set(tag, []);
        }
        byTag.get(tag)!.push({ method: method.toUpperCase(), path, op });
      }
    }
  }

  lines.push('## Endpoints');
  lines.push('');

  const sortedTags = Array.from(byTag.keys()).sort();
  for (const tag of sortedTags) {
    lines.push(`### ${tag}`);
    lines.push('');
    const entries = byTag.get(tag)!.sort((a, b) => {
      if (a.path === b.path) return a.method.localeCompare(b.method);
      return a.path.localeCompare(b.path);
    });
    for (const { method, path, op } of entries) {
      lines.push(`#### \`${method} ${path}\``);
      lines.push('');
      if (op.summary) {
        lines.push(op.summary);
        lines.push('');
      }
      if (op.description) {
        lines.push(op.description);
        lines.push('');
      }
      const auth = isAuthRequired(op) ? 'Required (Bearer JWT)' : 'None';
      lines.push(`- **Auth:** ${auth}`);
      lines.push(...renderRequestBody(op));
      lines.push(...renderResponses(op));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function renderAuthFlow(): string {
  const lines: string[] = [];
  lines.push('## Authentication Flow');
  lines.push('');
  lines.push(
    'The API uses JWT bearer tokens. Protected routes require an `Authorization: Bearer <token>` header. ' +
      'Tokens are issued by the auth endpoints below and validated by the auth middleware on each protected request.',
  );
  lines.push('');
  lines.push('### 1. Login');
  lines.push('');
  lines.push('`POST /api/v1/auth/login`');
  lines.push('');
  lines.push(
    'Submit credentials (email and password). On success, the response contains an access token and a refresh token. ' +
      'If the account has two-factor authentication enabled, the response indicates that a 2FA challenge is required ' +
      'and a short-lived challenge token is returned instead of the full token pair.',
  );
  lines.push('');
  lines.push('### 2. Two-Factor Authentication (if enabled)');
  lines.push('');
  lines.push(
    'When 2FA is enabled, complete the challenge by submitting the one-time code from the authenticator app. ' +
      'On success, the full access and refresh token pair is returned.',
  );
  lines.push('');
  lines.push('### 3. Using the Access Token');
  lines.push('');
  lines.push(
    'Include the access token on every protected request: `Authorization: Bearer <accessToken>`. ' +
      'The auth middleware verifies the token signature and expiry, and attaches the authenticated user to the request context.',
  );
  lines.push('');
  lines.push('### 4. Token Refresh');
  lines.push('');
  lines.push('`POST /api/v1/auth/refresh`');
  lines.push('');
  lines.push(
    'When the access token expires, exchange the refresh token for a new access token (and rotated refresh token). ' +
      'Refresh tokens are single-use; a used refresh token is invalidated.',
  );
  lines.push('');
  lines.push('### 5. Logout');
  lines.push('');
  lines.push('`DELETE /api/v1/auth/logout`');
  lines.push('');
  lines.push(
    'Invalidates the current refresh token so it can no longer be used to obtain new access tokens. ' +
      'The client should discard its stored tokens.',
  );
  lines.push('');
  return lines.join('\n');
}

function renderMarkdown(spec: OpenAPISpec): string {
  const parts = [renderOverview(spec), renderEndpoints(spec), renderAuthFlow()];
  return (
    parts
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

const spec = buildSpec();

const openapiOut = join(__dirname, '..', '..', 'openapi.json');
writeFileSync(openapiOut, JSON.stringify(spec, null, 2) + '\n');
console.log(`openapi.json written to ${openapiOut}`);

const docsDir = join(__dirname, '..', '..', '..', '..', 'docs');
mkdirSync(docsDir, { recursive: true });
const markdownOut = join(docsDir, 'api.md');
writeFileSync(markdownOut, renderMarkdown(spec));
console.log(`api.md written to ${markdownOut}`);
