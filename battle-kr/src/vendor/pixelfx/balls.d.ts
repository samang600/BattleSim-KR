export interface PxFrame { w: number; h: number; ox: number; oy: number; color: Uint32Array; light: Uint32Array }
export interface PxFx { meta: any; update(dt: number): void; draw(frame: PxFrame, layer?: 'back' | 'front'): void; stop(): void; done(): boolean; readonly t: number }
export interface PxModule { meta: { size: [number, number]; origin: [number, number]; duration: number; loop?: boolean; options?: any } }
export function createFrame(w: number, h: number, ox?: number, oy?: number): PxFrame;
export function clearFrame(f: PxFrame): PxFrame;
export function createFx(mod: PxModule, o?: { [k: string]: any }): PxFx;
export function composite(f: PxFrame, out: Uint8ClampedArray, bg?: null | number, lightK?: number): Uint8ClampedArray;
export const EFFECTS: { [k: string]: PxModule };
