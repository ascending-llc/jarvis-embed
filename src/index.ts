import type { AuthPayload, JarvisConfig } from './types';

export type { JarvisConfig };

export class JarvisEmbed {
  private readonly config: JarvisConfig;
  private readonly apiUrl: string;
  private readonly iframeUrl: string;
  private readonly iframeOrigin: string;

  private mountRoot: HTMLDivElement | null = null;
  private statusOverlay: HTMLDivElement | null = null;
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
    this.statusOverlay?.remove();
    this.statusOverlay = null;
    this.iframe?.remove();
    this.iframe = null;
    this.mountRoot?.remove();
    this.mountRoot = null;
    this.sdkReady = false;
    this.pendingMcpServers = null;
    this.pendingArtifactsButton = null;
    this.pendingAgentId = null;
  }

  private async start(): Promise<void> {
    const container = this.resolveContainer();
    if (!container) return;

    const mountRoot = this.ensureMountRoot(container);
    this.showLoadingOverlay();

    let token: string;
    try {
      token = this.config.provider === 'direct'
        ? this.config.token
        : await this.exchangeToken(this.config);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.showErrorOverlay(error);
      this.config.onError?.(error);
      return;
    }

    if (this.destroyed) return;

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
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;background:transparent;';

    iframe.addEventListener('load', () => {
      this.hideStatusOverlay();
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

    mountRoot.appendChild(iframe);
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

  private ensureMountRoot(container: HTMLElement): HTMLDivElement {
    if (this.mountRoot) return this.mountRoot;

    const mountRoot = document.createElement('div');
    mountRoot.style.cssText = `position:relative;width:${this.config.width ?? '100%'};height:${this.config.height ?? '600px'};`;
    container.appendChild(mountRoot);
    this.mountRoot = mountRoot;
    return mountRoot;
  }

  private showLoadingOverlay(): void {
    const overlay = this.ensureStatusOverlay();
    const spinner = document.createElement('div');
    spinner.style.cssText = 'width:32px;height:32px;border:3px solid #d0d7de;border-top-color:#0969da;border-radius:9999px;animation:jarvis-embed-spin 0.8s linear infinite;';

    const title = document.createElement('div');
    title.textContent = 'Loading Jarvis...';
    title.style.cssText = 'font-size:14px;font-weight:600;color:#111827;';

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Authenticating your session.';
    subtitle.style.cssText = 'font-size:13px;color:#4b5563;';

    this.injectSpinnerKeyframes();
    this.renderStatusOverlay(overlay, [spinner, title, subtitle]);
  }

  private showErrorOverlay(error: Error): void {
    const overlay = this.ensureStatusOverlay();

    const title = document.createElement('div');
    title.textContent = 'Unable to load Jarvis';
    title.style.cssText = 'font-size:14px;font-weight:600;color:#b42318;';

    const message = document.createElement('div');
    message.textContent = error.message || 'Something went wrong while preparing the chat.';
    message.style.cssText = 'font-size:13px;line-height:1.5;color:#4b5563;word-break:break-word;';

    this.renderStatusOverlay(overlay, [title, message]);
  }

  private hideStatusOverlay(): void {
    this.statusOverlay?.remove();
    this.statusOverlay = null;
  }

  private ensureStatusOverlay(): HTMLDivElement {
    if (!this.mountRoot) {
      throw new Error('Mount root is not initialized');
    }

    if (this.statusOverlay) return this.statusOverlay;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(255,255,255,0.92);z-index:1;';
    this.mountRoot.appendChild(overlay);
    this.statusOverlay = overlay;
    return overlay;
  }

  private renderStatusOverlay(overlay: HTMLDivElement, children: HTMLElement[]): void {
    overlay.replaceChildren();

    const card = document.createElement('div');
    card.style.cssText = 'display:flex;max-width:360px;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:24px 20px;border-radius:12px;background:#ffffff;box-shadow:0 8px 24px rgba(15,23,42,0.12);';
    card.replaceChildren(...children);

    overlay.appendChild(card);
  }

  private injectSpinnerKeyframes(): void {
    if (document.getElementById('jarvis-embed-spinner-style')) return;

    const style = document.createElement('style');
    style.id = 'jarvis-embed-spinner-style';
    style.textContent = '@keyframes jarvis-embed-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
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
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error('Token exchange timed out after 15 seconds.');
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errorMessage = await this.getErrorMessage(res);
      throw new Error(errorMessage);
    }

    const data = await res.json() as { token?: string };
    if (!data.token) {
      throw new Error('Token exchange succeeded but no token was returned.');
    }

    return data.token;
  }

  private async getErrorMessage(res: Response): Promise<string> {
    const fallbackMessage = `Token exchange failed (HTTP ${res.status})`;

    try {
      const data = await res.clone().json() as { error?: string; message?: string };
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
      if (typeof data.error === 'string' && data.error.trim()) return data.error;
    } catch {
      // Ignore JSON parse failures and fall back to text/status.
    }

    try {
      const text = (await res.text()).trim();
      if (text) return text;
    } catch {
      // Ignore text parse failures and fall back to status.
    }

    return fallbackMessage;
  }
}
