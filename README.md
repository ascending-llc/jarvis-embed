# Jarvis Embed SDK

Embed the Jarvis AI Assistant in any web application.

---

## Installation

```bash
npm install jarvis-embed
```

---

## Usage

```ts
import { JarvisEmbed } from 'jarvis-embed';

new JarvisEmbed({
  provider:    'google',
  token:       googleIdToken,
  containerId: 'chat-container',
  onReady:     (session) => console.log(session),
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
| `onReady` | `(session: Session) => void` | — | Fires when the iframe is ready. |
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

## Events

```ts
const jarvis = new JarvisEmbed({ provider: 'google', token, containerId: 'chat' });

jarvis.on('ready',   (session) => console.log(session));
jarvis.on('error',   (err)     => console.error(err));
jarvis.on('message', (data)    => console.log(data));

jarvis.off('ready', myHandler);
```

---

## Methods

### `refreshToken(auth: AuthPayload)`

Sends a fresh auth payload to the existing iframe without reloading it.

```ts
await jarvis.refreshToken({ provider: 'google', token: newToken });
```

### `destroy()`

Removes the iframe and clears all state and listeners.

### `getSession(): Session | null`

Returns the active session, or `null` if not initialized.

### `isAuthenticated(): boolean`

Returns `true` if a session is active.

---

## CDN

```html
<script src="https://jarvis.ascendingdc.com/sdk/jarvis-embed.js"></script>
<script>
  const Jarvis = window.JarvisEmbed.JarvisEmbed;

  new Jarvis({
    provider:    'google',
    token:       googleIdToken,
    containerId: 'chat-container',
  });
</script>
```

---

## Example

Google OAuth demo with a floating chat widget.
```bash
cd examples/vanilla && cp .env.example .env && npm install && npm start
```
