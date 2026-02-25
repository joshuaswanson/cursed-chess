# Chaos Chess

You've never played chess like this before.

A web-based chess game where the rules change every 45 seconds. Play through rotating game modes that twist the classic game into something unpredictable.

## Game Modes

- **Normal Chess** -- Standard chess for the first few moves, then the chaos begins
- **Portal Mode** -- Portals spawn on the board. Pieces that enter one exit the other, continuing their trajectory
- **Fog of War** -- Dense fog rolls over the enemy half. You can't see their pieces until you're adjacent
- **Battle Royale** -- The board shrinks inward over time. Pieces on the edge are eliminated
- **Clash Royale** -- Pieces move on their own. Spend resources to deploy reinforcements via drag and drop
- **Minefield** -- Hidden mines are scattered across the board. Step on one and your piece explodes
- **King of the Hill** -- Control 3+ of the 4 center squares for 3 consecutive rounds to win
- **Gravity** -- Gravity pulls all pieces in one direction, shifting 45 degrees every few turns. The board rotates to match

## Features

- Automatic mode rotation with announcements and hint banners
- Score tracking across modes (points for checkmate wins)
- 10-second move timer with countdown overlay
- AI opponent that plays automatically
- Piece slide, rock-settle, and explosion animations
- Drag-and-drop piece movement with pendulum swing physics
- Portal teleportation animations with particle trails
- Skip mode and pause/resume controls

## Tech Stack

- React 19 + TypeScript
- Zustand for state management
- Custom 0x88 chess engine
- Plugin architecture for game modes
- Vite

## Getting Started

```bash
npm install
npm run dev
```
