/** Auth fields vary by provider — TypeScript will enforce the right shape. */
type AuthPayload = {
    provider: 'google';
    token: string;
} | {
    provider: 's_jwt';
    token: string;
} | {
    provider: 'a_jwt';
    token: string;
} | {
    provider: 'direct';
    token: string;
} | {
    provider: 'hmac';
    userId: string;
    timestamp: number;
    signature: string;
};
type BaseConfig = {
    containerId?: string;
    container?: HTMLElement;
    width?: string;
    height?: string;
    apiUrl?: string;
    model?: string;
    debug?: boolean;
    onReady?: (jarvisToken: string) => void;
    onError?: (error: Error) => void;
    onMessage?: (data: unknown) => void;
};
type JarvisConfig = BaseConfig & AuthPayload;

declare class JarvisEmbed {
    private readonly config;
    private readonly apiUrl;
    private iframe;
    private messageHandler;
    private sdkReady;
    private pendingMcpServers;
    constructor(config: JarvisConfig);
    setMcpServers(servers: string[]): void;
    destroy(): void;
    private start;
    private resolveContainer;
    private exchangeToken;
}

export { type JarvisConfig, JarvisEmbed };
