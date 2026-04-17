import type { AuthPayload, JarvisConfig } from './types';

export type { JarvisConfig };

export class JarvisEmbed {
  private readonly config: JarvisConfig;
  private readonly apiUrl: string;
  private readonly iframeUrl: string;
  private readonly iframeOrigin: string;

  private iframe: HTMLIFrameElement | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private sdkReady = false;
  private pendingMcpServers: string[] | null = null;
  private pendingArtifactsButton: boolean | null;
  private pendingAgentId: string | null;
  private destroyed = false;

  constructor(config: JarvisConfig) {
    this.config = config;
    this.apiUrl = config.apiUrl?.replace(/\/$/, '') ?? 'https://jarvis.ascendingdc.com';
    this.iframeUrl = new URL(config.iframeUrl ?? '/v1/chat', this.apiUrl).toString();
    this.iframeOrigin = new URL(this.iframeUrl).origin;
    this.pendingArtifactsButton = config.artifactsButton ?? false;
    this.pendingAgentId = this.getConfiguredAgentId() ?? null;
    this.start();
  }

  private getConfiguredAgentId(): string | undefined {
    return this.config.agentId;
  }

  setMcpServers(servers: string[]): void {
    const isReady = this.sdkReady && this.iframe?.contentWindow != null;

    if (!isReady) {
      this.pendingMcpServers = servers;
      return;
    }

    this.iframe!.contentWindow!.postMessage({ type: 'SDK_MCP', servers }, this.iframeOrigin);
  }

  setArtifactsButton(enabled: boolean): void {
    const isReady = this.sdkReady && this.iframe?.contentWindow != null;

    if (!isReady) {
      this.pendingArtifactsButton = enabled;
      return;
    }

    this.iframe!.contentWindow!.postMessage(
      { type: 'SDK_ARTIFACTS', enabled },
      this.iframeOrigin,
    );
  }

  setAgentId(agentId: string): void {
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId) {
      return;
    }

    const isReady = this.sdkReady && this.iframe?.contentWindow != null;
    if (!isReady) {
      this.pendingAgentId = normalizedAgentId;
      return;
    }

    this.iframe!.contentWindow!.postMessage(
      { type: 'SDK_AGENT', agentId: normalizedAgentId },
      this.iframeOrigin,
    );
  }

  destroy(): void {
    this.destroyed = true;
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe?.remove();
    this.iframe = null;
    this.sdkReady = false;
    this.pendingMcpServers = null;
    this.pendingArtifactsButton = null;
    this.pendingAgentId = null;
  }

  private async start(): Promise<void> {
    let token: string;
    try {
      token = this.config.provider === 'direct'
        ? this.config.token
        : await this.exchangeToken(this.config);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.config.onError?.(error);
      return;
    }

    if (this.destroyed) return;

    const container = this.resolveContainer();
    if (!container) return;
    const iframe = document.createElement('iframe');
    const chatUrl = new URL(this.iframeUrl);
    if (this.config.model && !chatUrl.searchParams.has('spec')) {
      chatUrl.searchParams.set('spec', this.config.model);
    }
    const agentId = this.getConfiguredAgentId();
    if (agentId && !chatUrl.searchParams.has('agent_id')) {
      chatUrl.searchParams.set('agent_id', agentId);
    }
    iframe.src = chatUrl.toString();
    iframe.title = 'Jarvis AI Assistant';
    iframe.style.cssText = `width:${this.config.width ?? '100%'};height:${this.config.height ?? '600px'};border:none;display:block;`;

    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({ type: 'SDK_AUTH', token }, this.iframeOrigin);
    });

    this.messageHandler = (e: MessageEvent) => {
      const isCorrectOrigin = e.origin === this.iframeOrigin;
      if (!isCorrectOrigin) return;

      const isSdkReady = e.data?.type === 'SDK_READY';
      if (!isSdkReady) {
        this.config.onMessage?.(e.data);
        return;
      }

      if (this.sdkReady) return;
      this.sdkReady = true;
      this.config.onReady?.(token);

      const hasPendingServers = this.pendingMcpServers != null && iframe.contentWindow != null;
      if (hasPendingServers) {
        iframe.contentWindow!.postMessage(
          { type: 'SDK_MCP', servers: this.pendingMcpServers },
          this.iframeOrigin,
        );
        this.pendingMcpServers = null;
      }

      const hasPendingArtifactsButton = this.pendingArtifactsButton != null && iframe.contentWindow != null;
      if (hasPendingArtifactsButton) {
        iframe.contentWindow!.postMessage(
          { type: 'SDK_ARTIFACTS', enabled: this.pendingArtifactsButton },
          this.iframeOrigin,
        );
        this.pendingArtifactsButton = null;
      }

      const hasPendingAgentId = this.pendingAgentId != null && iframe.contentWindow != null;
      if (hasPendingAgentId) {
        iframe.contentWindow!.postMessage(
          { type: 'SDK_AGENT', agentId: this.pendingAgentId },
          this.iframeOrigin,
        );
        this.pendingAgentId = null;
      }
    };
    window.addEventListener('message', this.messageHandler);

    container.appendChild(iframe);
    this.iframe = iframe;
  }

  private resolveContainer(): HTMLElement | null {
    if (this.config.container) return this.config.container;

    if (this.config.containerId) {
      const el = document.getElementById(this.config.containerId);
      if (el) return el;
      this.config.onError?.(new Error(`Container element with id "${this.config.containerId}" not found`));
      return null;
    }

    return document.body;
  }

  private async exchangeToken(auth: AuthPayload): Promise<string> {
    if (this.config.debug) console.log('[JarvisEmbed] Exchanging token, provider:', auth.provider);

    const body: AuthPayload = auth.provider === 'hmac'
      ? { provider: 'hmac', userId: auth.userId, timestamp: auth.timestamp, signature: auth.signature }
      : { provider: auth.provider, token: auth.token };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/api/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);

    const data = await res.json() as { token: string };
    return data.token;
  }
}
