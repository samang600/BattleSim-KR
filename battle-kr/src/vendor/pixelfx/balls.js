// battle-kr: 볼 등장 이펙트에 쓰는 pixelfx 효과만 묶어 내보냄 (pixelfx MIT, LICENSE·NOTICE.md 참고)
export { createFrame, clearFrame, createFx, composite } from "./core/index.js";
import * as heartPickup from "./fx/pickups/heart-pickup.js";
export const EFFECTS = { heartPickup };
