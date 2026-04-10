# Jarvis Embed SDK

Embed the Jarvis AI Assistant in any web application. Works with bundlers and script tags.

---

## Installation

```bash
npm install @ascending-inc/jarvis-embed
```

### Browser (no bundler)

A pre-built UMD bundle is served via GitHub Pages. Load the latest version directly with a `<script>` tag and access the class via `window.JarvisSDK`:

```html
<script src="https://ascending-llc.github.io/jarvis-embed/latest/jarvis-embed.js"></script>
<script>
  const { JarvisEmbed } = window.JarvisSDK;

  const jarvis = new JarvisEmbed({
    provider:    'google',
    token:       googleIdToken,
    containerId: 'chat-container',
  });
</script>
```

To pin to a specific version, replace `latest` with the version number:

```html
<script src="https://ascending-llc.github.io/jarvis-embed/0.1.3/jarvis-embed.js"></script>
```

The bundle is also included in the npm package at `dist/index.global.js` if you prefer to self-host it.

---

## Usage

```ts
import { JarvisEmbed } from '@ascending-inc/jarvis-embed';

const jarvis = new JarvisEmbed({
  provider:    'google',
  token:       googleIdToken,
  containerId: 'chat-container',
  model:       'my-spec',
  artifactsButton: false,
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
| `model` | `string` | — | Spec identifier to use for the conversation (sent as `?spec=` to the API). Retrieve available values from `GET {apiUrl}/api/config`. |
| `artifactsButton` | `boolean` | `false` | Initial visibility state of the artifacts button in the embedded chat UI. |
| `debug` | `boolean` | `false` | Log SDK activity to the console. |
| `onReady` | `(jarvisToken: string) => void` | — | Fires when the iframe is authenticated and ready. Receives the Jarvis session token — use it to call Jarvis APIs (e.g. `GET {apiUrl}/api/mcp/servers`) on behalf of the user. |
| `onError` | `(err: Error) => void` | — | Fires on failure. |
| `onMessage` | `(data: unknown) => void` | — | Fires when the iframe posts a message to the host page. |

If neither `containerId` nor `container` is provided the iframe appends to `document.body`.

### Getting a spec

Available specs can be retrieved from the Jarvis config endpoint:

```
GET https://jarvis-demo.ascendingdc.com/api/config
```

---

## Authentication

Calls `POST {apiUrl}/api/auth/exchange` with your auth payload and receives a Jarvis session token back.

### `google` / `s_jwt` / `a_jwt`

| Provider | Token |
|----------|-------|
| `google` | Google `id_token` from OAuth2 |
| `s_jwt` | JWT signed with a shared secret (HS256) |
| `a_jwt` | JWT signed with a private key (RS256 / ES256) |

### `direct`

Pass a Jarvis session token you already hold — the SDK skips the `/api/auth/exchange` call entirely and uses the token as-is for `SDK_AUTH`.

```ts
new JarvisEmbed({
  provider:    'direct',
  token:       existingJarvisToken,
  containerId: 'chat-container',
});
```

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

| Method | Signature | Description |
|--------|-----------|-------------|
| `destroy` | `() => void` | Removes the iframe and cleans up the `window` message listener. Call this on unmount — essential for React. |
| `setMcpServers` | `(servers: string[]) => void` | Activates one or more [MCP](https://modelcontextprotocol.io) servers by name. Safe to call before the iframe is ready — servers are queued and flushed automatically on `SDK_READY`. |

---

## MCP (Model Context Protocol)

Pass one or more MCP server names to give Jarvis access to external tools and data sources during a session.

### Discovering available servers

Call `GET {apiUrl}/api/mcp/servers` with the Jarvis token as a Bearer header to retrieve the names of all servers available to the authenticated user. The response is an object keyed by server name:

```ts
const jarvis = new JarvisEmbed({
  provider:    'google',
  token:       googleIdToken,
  containerId: 'chat-container',
  onReady: async (jarvisToken) => {
    const res = await fetch(`https://jarvis.ascendingdc.com/api/mcp/servers`, {
      headers: { Authorization: `Bearer ${jarvisToken}` },
    });
    const servers = await res.json(); // { "posthog": {...}, "github": {...}, ... }
    const names = Object.keys(servers);

    // Activate all of them, or let the user pick from `names`
    jarvis.setMcpServers(names);
  },
});
```

### Activating servers

The safest place to call `setMcpServers` is inside `onReady`, which fires once the iframe has authenticated and is listening:

```ts
const jarvis = new JarvisEmbed({
  provider:    'google',
  token:       googleIdToken,
  containerId: 'chat-container',
  onReady: () => {
    jarvis.setMcpServers(['posthog', 'aws-knowledge']);
  },
});
```

You can also call it at any time after instantiation — if the iframe isn't ready yet the servers are queued internally and sent as soon as `SDK_READY` fires:

```ts
const jarvis = new JarvisEmbed({
  provider:    's_jwt',
  token:       myJwt,
  containerId: 'chat-container',
});

// Called immediately — queued until SDK_READY
jarvis.setMcpServers(['github', 'jira']);
```

To swap the active server set later (e.g. after a user action), call `setMcpServers` again with the new list:

```ts
document.getElementById('enable-analytics')?.addEventListener('click', () => {
  jarvis.setMcpServers(['posthog']);
});
```

### `setArtifactsButton(enabled: boolean)`

Shows or hides the artifacts button at runtime.
If called before the iframe is ready, the value is queued and applied once the SDK is ready.

```ts
jarvis.setArtifactsButton(true);
jarvis.setArtifactsButton(false);
```

---

## React

`useJarvis` is not exported from the package — copy `examples/react/src/useJarvis.ts` into your project. It wraps `JarvisEmbed` in a `useEffect` and calls `destroy()` on unmount automatically:

```ts
import { useEffect, useRef } from 'react';
import { JarvisEmbed } from '@ascending-inc/jarvis-embed';
import type { JarvisConfig } from '@ascending-inc/jarvis-embed';

export function useJarvis(config: JarvisConfig | null) {
  const jarvisRef = useRef<JarvisEmbed | null>(null);

  useEffect(() => {
    if (!config) return;
    jarvisRef.current = new JarvisEmbed(config);
    return () => {
      jarvisRef.current?.destroy();
      jarvisRef.current = null;
    };
  }, [config]);

  return jarvisRef;
}
```

Pass `null` to defer initialization until the user is authenticated. The hook calls `destroy()` automatically on unmount, so there are no memory leaks or stale event listeners.

### Using the `container` prop in React

When mounting into a React-managed DOM node, use a **callback ref** so initialization only happens once the element actually exists. Wrap config in `useMemo` with the container as a dependency — this ensures the SDK sees a real `HTMLElement`, not `null`:

```tsx
import { useCallback, useMemo, useState } from 'react';
import { useJarvis } from './useJarvis';

function ChatWidget({ googleToken }: { googleToken: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const config = useMemo(() => {
    if (!container || !googleToken) return null;
    return {
      provider: 'google' as const,
      token:    googleToken,
      container,
      width:    '100%',
      height:   '100%',
      onReady:  (jarvisToken: string) => {
        // fetch available servers and activate them
      },
    };
  }, [container, googleToken]);

  const jarvisRef = useJarvis(config);

  return <div ref={setContainer} style={{ flex: 1 }} />;
}
```

Using `containerId` instead avoids this entirely — the SDK does the `getElementById` lookup itself after the iframe loads — but the `container` prop approach above is required when the element is managed by React state.

---

## Examples

Both examples demonstrate Google OAuth, MCP tool selection, and embedding the chat widget. They share the same Express backend for token exchange.

### 1. Clone and set up

```bash
git clone https://github.com/ascending-llc/jarvis-embed.git
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
| `JARVIS_MODEL` | Optional spec override |
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
