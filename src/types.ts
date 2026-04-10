export type AuthProvider = 'google' | 'hmac' | 's_jwt' | 'a_jwt' | 'direct';

/** Auth fields vary by provider — TypeScript will enforce the right shape. */
export type AuthPayload =
  | { provider: 'google';  token: string }
  | { provider: 's_jwt';   token: string }
  | { provider: 'a_jwt';   token: string }
  | { provider: 'direct';  token: string }
  | { provider: 'hmac';    userId: string; timestamp: number; signature: string };

type BaseConfig = {
  containerId?: string;
  container?: HTMLElement;
  width?: string;
  height?: string;
  apiUrl?: string;
  model?: string;
  artifactsButton?: boolean;
  debug?: boolean;
  onReady?: (jarvisToken: string) => void;
  onError?: (error: Error) => void;
  onMessage?: (data: unknown) => void;
};

export type JarvisConfig = BaseConfig & AuthPayload;
