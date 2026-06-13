// Ambient declarations for modules used without @types packages
// This prevents TS7016 errors in deployment environments

declare module 'express' {
  import { Request, Response, NextFunction, Router, Application } from 'express-serve-static-core';
  export function json(options?: any): any;
  export function static(root: string, options?: any): any;
  const e: any;
  export default e;
  export { Request, Response, NextFunction, Router, Application };
}

declare module 'jsonwebtoken' {
  interface JwtPayload { [key: string]: any; }
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string, options?: any): JwtPayload;
  export function decode(token: string, options?: any): JwtPayload | null;
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: any, text: string, options?: any): Promise<void>;
  export function toString(text: string, options?: any): Promise<string>;
}
