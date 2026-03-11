# Jarvis Embed SDK

Embed the Jarvis AI Assistant in any web application.

---

## Installation

```bash
npm install git@github.com:ascending-llc/jarvis-embed.git
```

---

## Usage

```ts
import { JarvisEmbed } from 'jarvis-embed';

const jarvis = new JarvisEmbed({
  provider:    'google',
  token:       googleIdToken,
  containerId: 'chat-container',
  onReady:     (jarvisToken) => jarvis.setMcpServers(['my-mcp-server']),
});
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `AuthProvider` | required | Auth provider — see [Authentication](#authentication). |
| `token` | `string` | required* | OAuth / JWT token. *Not used for `hmac`. |
| `containerId` | `string` | — | ID of the DOM element to mount the iframe into. |
| `container` | `HTMLElement` | — | Direct element reference (alternative to `containerId`). |
| `width` | `string` | `'100%'` | CSS width of the iframe. |
| `height` | `string` | `'600px'` | CSS height of the iframe. |
| `apiUrl` | `string` | `https://jarvis.ascendingdc.com` | Override for self-hosted deployments. |
| `debug` | `boolean` | `false` | Log SDK activity to the console. |
| `onReady` | `(jarvisToken: string) => void` | — | Fires when the iframe is authenticated and ready. Receives the exchanged Jarvis token. |
| `onError` | `(err: Error) => void` | — | Fires on failure. |
| `onMessage` | `(data: unknown) => void` | — | Fires when the iframe posts a message to the host page. |

If neither `containerId` nor `container` is provided the iframe appends to `document.body`.

---

## Authentication

Calls `POST {apiUrl}/api/auth/exchange` with your auth payload and receives a Jarvis session token back.

### `google` / `s_jwt` / `a_jwt`

| Provider | Token |
|----------|-------|
| `google` | Google `id_token` from OAuth2 |
| `s_jwt` | JWT signed with a shared secret (HS256) |
| `a_jwt` | JWT signed with a private key (RS256 / ES256) |

### `hmac`

```ts
new JarvisEmbed({
  provider:  'hmac',
  userId:    'user_123',
  timestamp: Math.floor(Date.now() / 1000),
  signature: hmacHex, // HMAC-SHA256(userId + timestamp)
  containerId: 'chat-container',
});
```

Requests older than 5 minutes are rejected server-side.

---

## Methods

### `destroy()`

Removes the iframe and cleans up the `window` message listener. Call this on unmount — essential for React.

### `setMcpServers(servers: string[])`

Configures the embedded chat with one or more [MCP](https://modelcontextprotocol.io) server URLs. If called before the iframe is ready, the servers are queued and sent automatically once the SDK is ready.

```ts
jarvis.setMcpServers(['https://my-mcp-server.com/sse']);
```

---

## Examples

Both examples demonstrate Google OAuth, MCP tool selection, and embedding the chat widget. They share the same Express backend for token exchange.

### 1. Clone and set up

```bash
git clone git@github.com:ascending-llc/jarvis-embed.git
cd jarvis-embed
npm run setup
```

`setup` installs root dependencies, builds the SDK, and installs dependencies for both examples.

### 2. Configure environment variables

Each example has its own `.env`. Copy and fill in both:

```bash
cp examples/vanilla/.env.example examples/vanilla/.env
cp examples/react/.env.example   examples/react/.env
```

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (never sent to the browser) |
| `REDIRECT_URI` | Must match what's registered in Google Cloud Console |
| `JARVIS_URL` | `https://jarvis-demo.ascendingdc.com` or `http://localhost:3080` for local Jarvis |
| `PORT` | Express port (default `5500`) |

### 3. Run an example

**Vanilla JS** — floating chat widget, served at `http://localhost:5500`

```bash
npm run example:vanilla
```

**React** — `useJarvis` hook demo with proper cleanup, served at `http://localhost:5501`

```bash
npm run example:react
```
