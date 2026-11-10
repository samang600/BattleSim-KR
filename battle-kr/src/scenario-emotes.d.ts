export const EMOTES: { [kind: string]: { meta: { size: [number, number]; origin: [number, number]; duration: number }; draw: (p: any, t: number, o: any) => void } };
export function createFx(mod: any, opts?: any): { update(dt: number): void; draw(frame: any, layer?: string): void; stop(): void; done(): boolean };
export function createFrame(w: number, h: number): any;
export function clearFrame(f: any): any;
export function composite(f: any, out: Uint8ClampedArray, bg: any): any;
