// The government bond desk as the engine writes it into timeline.json. What
// does not move with the market is held once under bondDesk, and each frame
// carries the marks for its own set.

export interface BondInfo {
  id: string; name: string; cls: string; benchmark: string; onCurve: boolean;
  coupon: number; maturity: string; years: number;
  histMean?: number; histSd?: number;
}

export interface BondDesk {
  valuation: string; curve: string; swapCurve: string;
  bonds: BondInfo[];
  positions: { bond: number; package: string; strategy: string; face: number; openSpreadBp: number }[];
  hedges: { id: string; package: string; payer: boolean; notional: number; years: number; rate: number }[];
  packages: { name: string; strategy: string }[];
  swapT: number[];
  gates: { sets: number; rebuilds: number; checks: number; rows: { name: string; value: number; limit: number }[] };
}

export interface BondEvent {
  kind: 'price' | 'static'; id: string; field: string; from: string; to: string; onCurve: boolean;
}

// One bond on one set: clean, curve clean, yield %, residual bp, z, spread to
// the bond curve bp, z-spread bp, asset swap bp, DV01 per 100, accrued.
export type ScreenRow = [number, number, number, number, number | null, number, number, number, number, number];
export const S = { clean: 0, curveClean: 1, yield: 2, resid: 3, z: 4, govSpread: 5, zSpread: 6, asw: 7, dv01: 8, accrued: 9 } as const;

export interface BondFrame {
  us: number; status: string; version: number; rebuilt: boolean;
  events: BondEvent[];
  govT: number[]; govZ: number[];
  screen: (ScreenRow | null)[];
  book: {
    value: number; hedgeValue: number;
    pnl: number; pnlCurve: number; pnlSpread: number; pnlHedge: number;
    dv01Govt: number; dv01Swap: number; cs01: number;
    govLad: number[]; swapLad: number[];
    pos: number[][];       // value, P&L, curve part, spread part, DV01, clean
    hedges: number[][];    // value, P&L, DV01
    packages: number[][];  // P&L, curve, spread, hedge, bond DV01, hedge DV01
  };
}
