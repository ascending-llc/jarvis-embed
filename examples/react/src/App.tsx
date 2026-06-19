import { useEffect, useRef, useState } from 'react';
import { JarvisEmbed } from 'jarvis-embed';

type AppConfig = {
  jarvisUrl: string;
  jarvisModel?: string;
};

const DEFAULT_MODEL = 'openai-gpt-5-5';

export default function App() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [token, setToken] = useState('');
  const [serverName, setServerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const embedRef = useRef<JarvisEmbed | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: AppConfig) => setAppConfig(data))
      .catch(() => setError('Failed to load Jarvis config'));
  }, []);

  useEffect(() => {
    return () => {
      embedRef.current?.destroy();
      embedRef.current = null;
    };
  }, []);

  function connectJarvis() {
    const normalizedToken = token.trim();
    const normalizedServerName = serverName.trim();

    if (!appConfig || !container) {
      setError('Jarvis demo is not ready yet');
      return;
    }

    if (!normalizedToken) {
      setError('Please paste a Jarvis token');
      return;
    }

    embedRef.current?.destroy();
    setError(null);
    setConnected(false);

    const JARVIS_URL = appConfig.jarvisUrl;
    const iframeUrl = 'http://localhost:3090/v1/chat/new';

    console.log('appConfig==>>', appConfig)

    const embed = new JarvisEmbed({
      provider: 'direct',
      token: normalizedToken,
      model: appConfig.jarvisModel ?? DEFAULT_MODEL,
      apiUrl: JARVIS_URL,
      iframeUrl,
      container,
      artifactsButton: true,
      debug: true,
      width: '100%',
      height: '100%',
      onReady: () => setConnected(true),
      onError: () => setError('Failed to connect to Jarvis'),
    });

    embedRef.current = embed;

    if (normalizedServerName) {
      embed.setMcpServers([normalizedServerName]);
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, background: '#f9fafb', padding: 24, boxSizing: 'border-box' }}>
      <section style={{ width: 360, padding: 20, borderRadius: 16, background: '#fff', boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Jarvis Embed React Demo</h1>
        <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: '0.92rem' }}>
          Paste a direct Jarvis token and optionally pass one MCP server name.
        </p>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', marginBottom: 6, color: '#374151', fontSize: '0.85rem', fontWeight: 600 }}>Token</span>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste direct token"
            rows={7}
            style={{ width: '100%', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', marginBottom: 6, color: '#374151', fontSize: '0.85rem', fontWeight: 600 }}>MCP Server Name</span>
          <input
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="serverName"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </label>

        <button
          onClick={connectJarvis}
          disabled={!appConfig || !container}
          style={{ width: '100%', padding: '10px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.95rem', cursor: appConfig && container ? 'pointer' : 'not-allowed', opacity: appConfig && container ? 1 : 0.6 }}
        >
          Connect
        </button>

        {error && (
          <p style={{ margin: '12px 0 0', color: '#dc2626', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}
        {connected && !error && (
          <p style={{ margin: '12px 0 0', color: '#059669', fontSize: '0.85rem' }}>
            Connected to Jarvis.
          </p>
        )}

        <p style={{ margin: '14px 0 0', color: '#6b7280', fontSize: '0.78rem' }}>
          API: {appConfig?.jarvisUrl ?? 'loading...'}
          <br />
          Model: {appConfig?.jarvisModel ?? DEFAULT_MODEL}
        </p>
      </section>

      <div style={{ width: 560, height: 720, borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '10px 14px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', color: '#374151', fontSize: '0.9rem' }}>
          Jarvis Chat
        </div>
        <div ref={setContainer} style={{ flex: 1, overflow: 'hidden' }} />
      </div>
    </div>
  );
}
