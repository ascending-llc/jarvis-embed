var JarvisSDK = (function (exports) {
  'use strict';

  // src/index.ts
  var JarvisEmbed = class {
    constructor(config) {
      this.mountRoot = null;
      this.statusOverlay = null;
      this.iframe = null;
      this.messageHandler = null;
      this.sdkReady = false;
      this.pendingMcpServers = null;
      this.destroyed = false;
      var _a, _b, _c;
      if (typeof config.apiUrl !== "string" || config.apiUrl.trim() === "") {
        throw new Error('JarvisEmbed: "apiUrl" is required and must be a non-empty string.');
      }
      this.config = config;
      this.apiUrl = config.apiUrl.trim().replace(/\/$/, "");
      this.iframeUrl = new URL((_a = config.iframeUrl) != null ? _a : "/v1/chat", this.apiUrl).toString();
      this.iframeOrigin = new URL(this.iframeUrl).origin;
      this.pendingArtifactsButton = (_b = config.artifactsButton) != null ? _b : false;
      this.pendingAgentId = (_c = this.getConfiguredAgentId()) != null ? _c : null;
      this.start();
    }
    getConfiguredAgentId() {
      return this.config.agentId;
    }
    setMcpServers(servers) {
      var _a;
      const isReady = this.sdkReady && ((_a = this.iframe) == null ? void 0 : _a.contentWindow) != null;
      if (!isReady) {
        this.pendingMcpServers = servers;
        return;
      }
      this.iframe.contentWindow.postMessage({ type: "SDK_MCP", servers }, this.iframeOrigin);
    }
    setArtifactsButton(enabled) {
      var _a;
      const isReady = this.sdkReady && ((_a = this.iframe) == null ? void 0 : _a.contentWindow) != null;
      if (!isReady) {
        this.pendingArtifactsButton = enabled;
        return;
      }
      this.iframe.contentWindow.postMessage(
        { type: "SDK_ARTIFACTS", enabled },
        this.iframeOrigin
      );
    }
    setAgentId(agentId) {
      var _a;
      const normalizedAgentId = agentId.trim();
      if (!normalizedAgentId) {
        return;
      }
      const isReady = this.sdkReady && ((_a = this.iframe) == null ? void 0 : _a.contentWindow) != null;
      if (!isReady) {
        this.pendingAgentId = normalizedAgentId;
        return;
      }
      this.iframe.contentWindow.postMessage(
        { type: "SDK_AGENT", agentId: normalizedAgentId },
        this.iframeOrigin
      );
    }
    destroy() {
      var _a, _b, _c;
      this.destroyed = true;
      if (this.messageHandler) {
        window.removeEventListener("message", this.messageHandler);
        this.messageHandler = null;
      }
      (_a = this.statusOverlay) == null ? void 0 : _a.remove();
      this.statusOverlay = null;
      (_b = this.iframe) == null ? void 0 : _b.remove();
      this.iframe = null;
      (_c = this.mountRoot) == null ? void 0 : _c.remove();
      this.mountRoot = null;
      this.sdkReady = false;
      this.pendingMcpServers = null;
      this.pendingArtifactsButton = null;
      this.pendingAgentId = null;
    }
    async start() {
      var _a, _b;
      const container = this.resolveContainer();
      if (!container) return;
      const mountRoot = this.ensureMountRoot(container);
      this.showLoadingOverlay();
      let token;
      try {
        token = this.config.provider === "direct" ? this.config.token : await this.exchangeToken(this.config);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.showErrorOverlay(error);
        (_b = (_a = this.config).onError) == null ? void 0 : _b.call(_a, error);
        return;
      }
      if (this.destroyed) return;
      const iframe = document.createElement("iframe");
      const chatUrl = new URL(this.iframeUrl);
      if (this.config.model && !chatUrl.searchParams.has("spec")) {
        chatUrl.searchParams.set("spec", this.config.model);
      }
      const agentId = this.getConfiguredAgentId();
      if (agentId && !chatUrl.searchParams.has("agent_id")) {
        chatUrl.searchParams.set("agent_id", agentId);
      }
      iframe.src = chatUrl.toString();
      iframe.title = "Jarvis AI Assistant";
      iframe.style.cssText = "width:100%;height:100%;border:none;display:block;background:transparent;";
      let authSent = false;
      iframe.addEventListener("load", () => {
        this.hideStatusOverlay();
        authSent = false;
      });
      this.messageHandler = (e) => {
        var _a2, _b2, _c, _d, _e, _f, _g;
        const isCorrectOrigin = e.origin === this.iframeOrigin;
        const isCurrentIframe = e.source === iframe.contentWindow;
        if (!isCorrectOrigin || !isCurrentIframe) return;
        const isAuthReady = ((_a2 = e.data) == null ? void 0 : _a2.type) === "SDK_AUTH_READY";
        if (isAuthReady) {
          if (authSent) return;
          authSent = true;
          (_b2 = iframe.contentWindow) == null ? void 0 : _b2.postMessage({ type: "SDK_AUTH", token }, this.iframeOrigin);
          return;
        }
        const isSdkReady = ((_c = e.data) == null ? void 0 : _c.type) === "SDK_READY";
        if (!isSdkReady) {
          (_e = (_d = this.config).onMessage) == null ? void 0 : _e.call(_d, e.data);
          return;
        }
        if (this.sdkReady) return;
        this.sdkReady = true;
        (_g = (_f = this.config).onReady) == null ? void 0 : _g.call(_f, token);
        const hasPendingServers = this.pendingMcpServers != null && iframe.contentWindow != null;
        if (hasPendingServers) {
          iframe.contentWindow.postMessage(
            { type: "SDK_MCP", servers: this.pendingMcpServers },
            this.iframeOrigin
          );
          this.pendingMcpServers = null;
        }
        const hasPendingArtifactsButton = this.pendingArtifactsButton != null && iframe.contentWindow != null;
        if (hasPendingArtifactsButton) {
          iframe.contentWindow.postMessage(
            { type: "SDK_ARTIFACTS", enabled: this.pendingArtifactsButton },
            this.iframeOrigin
          );
          this.pendingArtifactsButton = null;
        }
        const hasPendingAgentId = this.pendingAgentId != null && iframe.contentWindow != null;
        if (hasPendingAgentId) {
          iframe.contentWindow.postMessage(
            { type: "SDK_AGENT", agentId: this.pendingAgentId },
            this.iframeOrigin
          );
          this.pendingAgentId = null;
        }
      };
      window.addEventListener("message", this.messageHandler);
      mountRoot.appendChild(iframe);
      this.iframe = iframe;
    }
    resolveContainer() {
      var _a, _b;
      if (this.config.container) return this.config.container;
      if (this.config.containerId) {
        const el = document.getElementById(this.config.containerId);
        if (el) return el;
        (_b = (_a = this.config).onError) == null ? void 0 : _b.call(_a, new Error(`Container element with id "${this.config.containerId}" not found`));
        return null;
      }
      return document.body;
    }
    ensureMountRoot(container) {
      var _a, _b;
      if (this.mountRoot) return this.mountRoot;
      const mountRoot = document.createElement("div");
      mountRoot.style.cssText = `position:relative;width:${(_a = this.config.width) != null ? _a : "100%"};height:${(_b = this.config.height) != null ? _b : "600px"};`;
      container.appendChild(mountRoot);
      this.mountRoot = mountRoot;
      return mountRoot;
    }
    showLoadingOverlay() {
      const overlay = this.ensureStatusOverlay();
      const spinner = document.createElement("div");
      spinner.style.cssText = "width:32px;height:32px;border:3px solid #d0d7de;border-top-color:#0969da;border-radius:9999px;animation:jarvis-embed-spin 0.8s linear infinite;";
      const title = document.createElement("div");
      title.textContent = "Loading Jarvis...";
      title.style.cssText = "font-size:14px;font-weight:600;color:#111827;";
      const subtitle = document.createElement("div");
      subtitle.textContent = "Authenticating your session.";
      subtitle.style.cssText = "font-size:13px;color:#4b5563;";
      this.injectSpinnerKeyframes();
      this.renderStatusOverlay(overlay, [spinner, title, subtitle]);
    }
    showErrorOverlay(error) {
      const overlay = this.ensureStatusOverlay();
      const title = document.createElement("div");
      title.textContent = "Unable to load Jarvis";
      title.style.cssText = "font-size:14px;font-weight:600;color:#b42318;";
      const message = document.createElement("div");
      message.textContent = error.message || "Something went wrong while preparing the chat.";
      message.style.cssText = "font-size:13px;line-height:1.5;color:#4b5563;word-break:break-word;";
      this.renderStatusOverlay(overlay, [title, message]);
    }
    hideStatusOverlay() {
      var _a;
      (_a = this.statusOverlay) == null ? void 0 : _a.remove();
      this.statusOverlay = null;
    }
    ensureStatusOverlay() {
      if (!this.mountRoot) {
        throw new Error("Mount root is not initialized");
      }
      if (this.statusOverlay) return this.statusOverlay;
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(255,255,255,0.92);z-index:1;";
      this.mountRoot.appendChild(overlay);
      this.statusOverlay = overlay;
      return overlay;
    }
    renderStatusOverlay(overlay, children) {
      overlay.replaceChildren();
      const card = document.createElement("div");
      card.style.cssText = "display:flex;max-width:360px;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:24px 20px;border-radius:12px;background:#ffffff;box-shadow:0 8px 24px rgba(15,23,42,0.12);";
      card.replaceChildren(...children);
      overlay.appendChild(card);
    }
    injectSpinnerKeyframes() {
      if (document.getElementById("jarvis-embed-spinner-style")) return;
      const style = document.createElement("style");
      style.id = "jarvis-embed-spinner-style";
      style.textContent = "@keyframes jarvis-embed-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
      document.head.appendChild(style);
    }
    async exchangeToken(auth) {
      const body = auth.provider === "hmac" ? { provider: "hmac", userId: auth.userId, timestamp: auth.timestamp, signature: auth.signature } : { provider: auth.provider, token: auth.token };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15e3);
      let res;
      try {
        res = await fetch(`${this.apiUrl}/api/auth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error("Token exchange timed out after 15 seconds.");
        }
        throw err instanceof Error ? err : new Error(String(err));
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) {
        const errorMessage = await this.getErrorMessage(res);
        throw new Error(errorMessage);
      }
      const data = await res.json();
      if (!data.token) {
        throw new Error("Token exchange succeeded but no token was returned.");
      }
      return data.token;
    }
    async getErrorMessage(res) {
      const fallbackMessage = `Token exchange failed (HTTP ${res.status})`;
      try {
        const data = await res.clone().json();
        if (typeof data.message === "string" && data.message.trim()) return data.message;
        if (typeof data.error === "string" && data.error.trim()) return data.error;
      } catch (e) {
      }
      try {
        const text = (await res.text()).trim();
        if (text) return text;
      } catch (e) {
      }
      return fallbackMessage;
    }
  };

  exports.JarvisEmbed = JarvisEmbed;

  return exports;

})({});
//# sourceMappingURL=index.global.js.map
//# sourceMappingURL=index.global.js.map