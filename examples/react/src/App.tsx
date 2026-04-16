import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJarvis } from './useJarvis';

type AppConfig = {
  googleClientId: string;
  redirectUri: string;
  jarvisUrl: string;
  jarvisModel?: string;
};

type McpServer = {
  name: string;
  checked: boolean;
};

export default function App() {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [mcpSearch, setMcpSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [agentIdInput, setAgentIdInput] = useState();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const onReady = useCallback(async (jarvisToken: string) => {
    if (!appConfig) return;
    const res = await fetch(`${appConfig.jarvisUrl}/api/mcp/servers`, {
      headers: { Authorization: `Bearer ${jarvisToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setMcpServers(Object.keys(data).map((name) => ({ name, checked: false })));
  }, [appConfig]);

  const jarvisConfig = useMemo(() => {
    if (!appConfig || !googleToken || !container) return null;
    return {
      provider: 'google' as const,
      token: googleToken,
      apiUrl: appConfig.jarvisUrl,
      ...(appConfig.jarvisModel ? { model: appConfig.jarvisModel } : {}),
      container,
      width: '100%',
      height: '100%',
      onReady,
      onError: (err: Error) => console.error('[Jarvis]', err),
      artifactsButton: true,
    };
  }, [appConfig, googleToken, container, onReady]);

  const jarvisRef = useJarvis(jarvisConfig);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      fetch('/api/google/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.token) sessionStorage.setItem('google_id_token', data.token);
          window.history.replaceState({}, '', '/');
          window.location.reload();
        });
      return;
    }

    fetch('/api/config')
      .then((r) => r.json())
      .then((data: AppConfig) => {
        setAppConfig(data);
        const storedToken = sessionStorage.getItem('google_id_token');
        if (storedToken) {
          sessionStorage.removeItem('google_id_token');
          setGoogleToken(storedToken);
        }
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const isOutside = dropdownRef.current && !dropdownRef.current.contains(e.target as Node);
      if (isOutside) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function signInWithGoogle() {
    if (!appConfig) return;
    const params = new URLSearchParams({
      client_id: appConfig.googleClientId,
      redirect_uri: appConfig.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  function applyMcpServers() {
    const selected = mcpServers.filter((s) => s.checked).map((s) => s.name);
    if (selected.length > 0) jarvisRef.current?.setMcpServers(selected);
    setDropdownOpen(false);
  }

  function showArtifactsButton() {
    jarvisRef.current?.setArtifactsButton(true);
  }

  function hideArtifactsButton() {
    jarvisRef.current?.setArtifactsButton(false);
  }

  function applyAgentId() {
    const normalizedAgentId = agentIdInput?.trim();
    if (!normalizedAgentId) {
      return;
    }
    jarvisRef.current?.setAgentId(normalizedAgentId);
  }

  const filteredServers = mcpServers.filter((s) =>
    s.name.toLowerCase().includes(mcpSearch.toLowerCase()),
  );

  const isSignedIn = googleToken !== null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      {!isSignedIn ? (
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: 8 }}>Jarvis Embed — React Demo</h1>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>Sign in to start chatting.</p>
          <button onClick={signInWithGoogle} style={{ padding: '10px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.95rem', cursor: 'pointer' }}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <div style={{ width: 420, height: 620, borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
            <input
              value={agentIdInput}
              onChange={(e) => setAgentIdInput(e.target.value)}
              placeholder="Agent ID"
              style={{ width: 100, minWidth: 100, padding: '5px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8rem' }}
            />
            <button
              onClick={applyAgentId}
              style={{ padding: '5px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Apply
            </button>
            {mcpServers.length > 0 && (
              <>
                <div ref={dropdownRef} style={{ position: 'relative', flex: 1 }}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    style={{ width: '100%', padding: '5px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8rem', textAlign: 'left', cursor: 'pointer' }}
                  >
                    Select tools...
                  </button>
                  {dropdownOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 10, overflow: 'hidden' }}>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={mcpSearch}
                        onChange={(e) => setMcpSearch(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: 'none', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                        {filteredServers.map((server) => (
                          <label key={server.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={server.checked}
                              onChange={() =>
                                setMcpServers((prev) =>
                                  prev.map((s) => s.name === server.name ? { ...s, checked: !s.checked } : s),
                                )
                              }
                            />
                            {server.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={applyMcpServers} style={{ padding: '5px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Apply
                </button>
              </>
            )}
          </div>
          {/* callback ref: triggers re-render when div mounts, so useMemo picks up the container */}
          <div ref={setContainer} style={{ flex: 1, overflow: 'hidden' }} />
        </div>
      )}
    </div>
  );
}
