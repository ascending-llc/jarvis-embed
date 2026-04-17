var JarvisSDK = (function (exports) {
  'use strict';

  // src/index.ts
  var JarvisEmbed = class {
    constructor(config) {
      this.iframe = null;
      this.messageHandler = null;
      this.sdkReady = false;
      this.pendingMcpServers = null;
      this.destroyed = false;
      var _a, _b, _c, _d, _e;
      this.config = config;
      this.apiUrl = (_b = (_a = config.apiUrl) == null ? void 0 : _a.replace(/\/$/, "")) != null ? _b : "https://jarvis.ascendingdc.com";
      this.iframeUrl = new URL((_c = config.iframeUrl) != null ? _c : "/v1/chat", this.apiUrl).toString();
      this.iframeOrigin = new URL(this.iframeUrl).origin;
      this.pendingArtifactsButton = (_d = config.artifactsButton) != null ? _d : false;
      this.pendingAgentId = (_e = this.getConfiguredAgentId()) != null ? _e : null;
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
      var _a;
      this.destroyed = true;
      if (this.messageHandler) {
        window.removeEventListener("message", this.messageHandler);
        this.messageHandler = null;
      }
      (_a = this.iframe) == null ? void 0 : _a.remove();
      this.iframe = null;
      this.sdkReady = false;
      this.pendingMcpServers = null;
      this.pendingArtifactsButton = null;
      this.pendingAgentId = null;
    }
    async start() {
      var _a, _b, _c, _d;
      let token;
      try {
        token = this.config.provider === "direct" ? this.config.token : await this.exchangeToken(this.config);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        (_b = (_a = this.config).onError) == null ? void 0 : _b.call(_a, error);
        return;
      }
      if (this.destroyed) return;
      const container = this.resolveContainer();
      if (!container) return;
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
      iframe.style.cssText = `width:${(_c = this.config.width) != null ? _c : "100%"};height:${(_d = this.config.height) != null ? _d : "600px"};border:none;display:block;`;
      iframe.addEventListener("load", () => {
        var _a2;
        (_a2 = iframe.contentWindow) == null ? void 0 : _a2.postMessage({ type: "SDK_AUTH", token }, this.iframeOrigin);
      });
      this.messageHandler = (e) => {
        var _a2, _b2, _c2, _d2, _e;
        const isCorrectOrigin = e.origin === this.iframeOrigin;
        if (!isCorrectOrigin) return;
        const isSdkReady = ((_a2 = e.data) == null ? void 0 : _a2.type) === "SDK_READY";
        if (!isSdkReady) {
          (_c2 = (_b2 = this.config).onMessage) == null ? void 0 : _c2.call(_b2, e.data);
          return;
        }
        if (this.sdkReady) return;
        this.sdkReady = true;
        (_e = (_d2 = this.config).onReady) == null ? void 0 : _e.call(_d2, token);
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
      container.appendChild(iframe);
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
    async exchangeToken(auth) {
      if (this.config.debug) console.log("[JarvisEmbed] Exchanging token, provider:", auth.provider);
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
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);
      const data = await res.json();
      return data.token;
    }
  };

  exports.JarvisEmbed = JarvisEmbed;

  return exports;

})({});
//# sourceMappingURL=index.global.js.map
//# sourceMappingURL=index.global.js.map