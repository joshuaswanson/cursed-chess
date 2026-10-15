import { useEffect, useRef } from "react";
import type { SquareIndex } from "../../engine";
import type { PacRun, PacView } from "../../plugins/pacman";
import { sfx } from "../../audio/sfx";
import { fileOf } from "../../utils/squareUtils";
import { visualCol, visualRow } from "./boardGeometry";
import { SLIDE_MS } from "./useBoardEffects";

/** How long a piece takes to go out through one tunnel and in at the other */
export const TUNNEL_MS = 560;

type Point = { x: number; y: number };

/**
 * Where a piece that went through a tunnel shows on its way, as offsets
 * from its landing square: where it set out, the mouth of the tunnel it
 * went out by, and the mouth it came in at
 */
export function tunnelWay(
  run: PacRun,
  flipped: boolean,
  squareSize: number,
): { from: Point; exit: Point; entry: Point } | null {
  const at = (sq: SquareIndex): Point => ({
    x: visualCol(sq, flipped),
    y: visualRow(sq, flipped),
  });
  const end = at(run.to);
  const offset = (p: Point): Point => ({
    x: (p.x - end.x) * squareSize,
    y: (p.y - end.y) * squareSize,
  });
  for (let i = 1; i < run.path.length; i++) {
    const a = run.path[i - 1];
    const b = run.path[i];
    const files = fileOf(b) - fileOf(a);
    if (Math.abs(files) <= 2) continue;
    const across = files - Math.sign(files) * 8;
    const dx = flipped ? -across : across;
    const dy = at(b).y - at(a).y;
    return {
      from: offset(at(run.from)),
      exit: offset({ x: at(a).x + dx, y: at(a).y + dy }),
      entry: offset({ x: at(b).x - dx, y: at(b).y - dy }),
    };
  }
  return null;
}

/** When each pellet a move ate goes, as the piece reaches it */
export function eatTimes(
  run: PacRun,
  tunnel: boolean,
): Map<SquareIndex, number> {
  const length = run.path.length - 1;
  const duration = tunnel ? TUNNEL_MS : SLIDE_MS;
  return new Map(
    run.eaten.map((sq) => [
      sq,
      Math.round((run.path.indexOf(sq) / Math.max(1, length)) * duration),
    ]),
  );
}

/** The arcade's sounds for each move: a waka for every pellet, the power pellet's siren, and a ghost being eaten */
export function usePacSounds(view: PacView | null) {
  const run = view?.run ?? null;
  const heard = useRef(run?.id ?? 0);
  useEffect(() => {
    if (!run || run.id === heard.current) return;
    heard.current = run.id;
    if (run.ghost) sfx.ghostEaten();
    if (run.power) sfx.powerPellet();
    else if (run.eaten.length > 0) sfx.chomp(run.eaten.length);
  }, [run]);
}
