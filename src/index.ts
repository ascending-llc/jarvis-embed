import type { AuthPayload, AuthProvider, JarvisConfig, Session } from './types';

export type { AuthPayload, AuthProvider, JarvisConfig, Session } from './types';

export const VERSION = '0.1.0';

type Listener = (...args: any[]) => void;

export class JarvisEmbed {
  private readonly config: JarvisConfig;
  private readonly apiUrl: string;

  private session: Session | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private listeners = new Map<string, Listener[]>();

  constructor(config: JarvisConfig) {
    this.config = config;
    this.apiUrl = config.apiUrl?.replace(/\/$/, '') ?? 'https://jarvis.ascendingdc.com';
    this.start();
  }

  on(event: 'ready', fn: (session: Session) => void): this;
  on(event: 'error', fn: (err: Error) => void): this;
  on(event: 'message', fn: (data: unknown) => void): this;
  on(event: string, fn: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, fn]);
    return this;
  }

  off(event: string, fn: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, existing.filter((f) => f !== fn));
    return this;
  }

  async refreshToken(auth: AuthPayload): Promise<void> {
    if (!this.iframe?.contentWindow) throw new Error('Not initialized yet');

    const jarvisToken = await this.exchangeToken(auth);
    const chatOrigin = new URL(this.apiUrl).origin;

    this.iframe.contentWindow.postMessage({ type: 'SDK_AUTH', token: jarvisToken }, chatOrigin);

    if (this.session) {
      this.session = { ...this.session, token: jarvisToken, provider: auth.provider };
    }
  }

  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe?.remove();
    this.iframe = null;
    this.session = null;
    this.listeners.clear();
  }

  getSession(): Session | null {
    return this.session;
  }

  isAuthenticated(): boolean {
    return this.session !== null;
  }

  private async start(): Promise<void> {
    let token: string;
    try {
      token = await this.exchangeToken(this.config);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.config.onError?.(error);
      this.emit('error', error);
      return;
    }

    const container = this.config.container
      ?? (this.config.containerId ? document.getElementById(this.config.containerId) : null)
      ?? document.body;

    const chatOrigin = new URL(this.apiUrl).origin;

    const iframe = document.createElement('iframe');
    iframe.src = `${this.apiUrl}/v1/chat`;
    iframe.title = 'Jarvis AI Assistant';
    iframe.style.cssText = `width:${this.config.width ?? '100%'};height:${this.config.height ?? '600px'};border:none;display:block;`;

    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({ type: 'SDK_AUTH', token }, chatOrigin);
      this.config.onReady?.(this.session!);
      this.emit('ready', this.session);
    });

    this.messageHandler = (e: MessageEvent) => {
      if (e.origin !== chatOrigin) return;
      this.config.onMessage?.(e.data);
      this.emit('message', e.data);
    };
    window.addEventListener('message', this.messageHandler);

    container.appendChild(iframe);
    this.iframe = iframe;
    this.session = { token, provider: this.config.provider, iframe };
  }

  private async exchangeToken(auth: AuthPayload): Promise<string> {
    if (this.config.debug) console.log('[JarvisEmbed] Exchanging token, provider:', auth.provider);

    const res = await fetch(`${this.apiUrl}/api/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auth),
    });

    if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);

    const data = await res.json() as { token: string };
    return data.token;
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}
