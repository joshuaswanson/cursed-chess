import { generatePseudoLegalMoves } from "../engine";
import type { Board, Color, PawnRules, SquareIndex } from "../engine";
import { opponent } from "../engine/moves";
import type { Game } from "../engine/game";
import type { PluginManager } from "../plugins/manager";
import type { PortalChessPlugin } from "../plugins/portalChess";

/** A piece that could take the king, and whether it would get there in a straight line from where it stands */
export interface Checker {
  sq: SquareIndex;
  straight: boolean;
}

function directAttackers(
  board: Board,
  king: SquareIndex,
  color: Color,
  enPassant: SquareIndex | null,
  pawnRules: PawnRules,
): SquareIndex[] {
  const from = generatePseudoLegalMoves(
    board,
    opponent(color),
    enPassant,
    pawnRules,
  )
    .filter((move) => move.to === king)
    .map((move) => move.from);
  return [...new Set(from)];
}

/**
 * Every piece that could take `color`'s king on `king`, straight off the
 * board or through a portal
 */
export function checkersOf(
  board: Board,
  king: SquareIndex,
  color: Color,
  enPassant: SquareIndex | null,
  pawnRules: PawnRules,
  portals?: PortalChessPlugin,
): Checker[] {
  const direct = directAttackers(board, king, color, enPassant, pawnRules);
  const portal = (portals?.portalAttackers(board, color) ?? []).filter(
    (sq) => !direct.includes(sq),
  );
  return [
    ...direct.map((sq) => ({ sq, straight: true })),
    ...portal.map((sq) => ({ sq, straight: false })),
  ];
}

/**
 * The king of the side to move and every piece that could take it, by the
 * mode's own rules. Modes played in real time have no turns, so no check.
 */
export function checkOnTurn(
  game: Game,
  plugins: PluginManager,
): { king: SquareIndex; checkers: Checker[] } | null {
  if (plugins.isAutonomous()) return null;
  const king = game.board.findKing(game.turn);
  if (king === null) return null;
  return {
    king,
    checkers: checkersOf(
      game.board,
      king,
      game.turn,
      game.enPassant,
      game.pawnRules,
      plugins.find<PortalChessPlugin>("portal-chess"),
    ),
  };
}
