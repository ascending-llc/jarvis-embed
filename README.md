# Jarvis Embed SDK

Embed the Jarvis AI Assistant in any web application. Works with bundlers and script tags.

## Quick Start

```bash
npm install @ascending-inc/jarvis-embed
```

### Browser (no bundler)

```html
<script src="https://ascending-llc.github.io/jarvis-embed/latest/jarvis-embed.js"></script>
<script>
  const { JarvisEmbed } = window.JarvisSDK;
  const jarvis = new JarvisEmbed({ provider: 'google', token: googleIdToken, containerId: 'chat-container' });
</script>
```

## Documentation

For more info on options, authentication, MCP discovery, and examples see the full documentation: [https://ascending-llc.github.io/jarvis-embed/jarvis-embed/](https://ascending-llc.github.io/jarvis-embed/jarvis-embed/)
