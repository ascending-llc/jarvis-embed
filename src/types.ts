export type AuthProvider = 'google' | 'hmac' | 's_jwt' | 'a_jwt';

/** Auth fields vary by provider — TypeScript will enforce the right shape. */
export type AuthPayload =
  | { provider: 'google';  token: string }
  | { provider: 's_jwt';   token: string }
  | { provider: 'a_jwt';   token: string }
  | { provider: 'hmac';    userId: string; timestamp: number; signature: string };

type BaseConfig = {
  containerId?: string;
  container?: HTMLElement;
  width?: string;
  height?: string;
  apiUrl?: string;
  debug?: boolean;
  onReady?: (session: Session) => void;
  onError?: (error: Error) => void;
  onMessage?: (data: unknown) => void;
};

export type JarvisConfig = BaseConfig & AuthPayload;

export interface Session {
  token: string;
  provider: AuthProvider;
  iframe: HTMLIFrameElement;
}
