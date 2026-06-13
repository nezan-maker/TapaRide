// Ambient declarations for modules without @types packages
// This prevents TS7016/TS2694 errors in deployment environments

declare module 'jsonwebtoken' {
  interface SignOptions {
    algorithm?: string;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    subject?: string;
    issuer?: string;
    jwtid?: string;
    mutatePayload?: boolean;
    noTimestamp?: boolean;
    header?: object;
    keyid?: string;
  }
  interface VerifyOptions {
    algorithms?: string[];
    audience?: string | RegExp | Array<string | RegExp>;
    clockTimestamp?: number;
    clockTolerance?: number;
    complete?: boolean;
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    jwtid?: string;
    nonce?: string;
    subject?: string;
    maxAge?: string | number;
  }
  export function sign(payload: string | Buffer | object, secretOrPrivateKey: string | Buffer, options?: SignOptions): string;
  export function verify(token: string, secretOrPublicKey: string | Buffer, options?: VerifyOptions): object | string;
  export function decode(token: string, options?: { complete?: boolean; json?: boolean }): null | { [key: string]: any } | string;
  export type SignOptions = SignOptions;
}

declare module 'qrcode' {
  export function toDataURL(text: string | object[], options?: any): Promise<string>;
  export function toCanvas(canvas: any, text: string | object[], options?: any): Promise<void>;
  export function toString(text: string | object[], options?: any): Promise<string>;
}
