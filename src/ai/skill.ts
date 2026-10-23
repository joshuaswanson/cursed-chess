/**
 * How well Chessbot plays in Story Mode, from 0, careless, to 1, as sharp as
 * he gets. He follows the score: the further the player pulls ahead the
 * sharper he plays, and the further they fall behind the more he lets slip,
 * so the run stays close with the player about a win in front.
 */
export const TARGET_LEAD = 1;
const SKILL_AT_TARGET = 0.6;
const SKILL_PER_WIN = 0.2;

export function storySkill(playerWins: number, botWins: number): number {
  const lead = playerWins - botWins;
  const skill = SKILL_AT_TARGET + SKILL_PER_WIN * (lead - TARGET_LEAD);
  return Math.min(1, Math.max(0, skill));
}

/** How loosely the least skilled Chessbot weighs one move's score against another's, in pawns */
const MAX_TEMPERATURE = 2.5;
/** Any score above this counts the same, so even a mate in one can be missed when careless */
const SCORE_CAP = 25;

/**
 * One of the scored choices: at full skill always the best, and with less
 * skill more and more often a worse one, the worse the less likely
 */
export function pickBySkill<T>(
  choices: { choice: T; score: number }[],
  skill: number,
): T {
  const temperature = MAX_TEMPERATURE * (1 - skill) ** 1.5;
  const capped = choices.map(({ score }) => Math.min(score, SCORE_CAP));
  const top = Math.max(...capped);
  if (temperature < 0.05) return choices[capped.indexOf(top)].choice;
  const weights = capped.map((score) => Math.exp((score - top) / temperature));
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < choices.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return choices[i].choice;
  }
  return choices[capped.indexOf(top)].choice;
}
