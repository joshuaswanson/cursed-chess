# Cursed Chess

You've never played chess like this before.

A web-based chess game where the rules change every 45 seconds. Play through rotating game modes that twist the classic game into something unpredictable.

## Game Modes

- **Normal Chess**: standard chess for the first three moves, then the chaos begins.
- **Portals**: portals spawn on the board. Pieces that enter one exit the other and continue their trajectory.
- **Fog of War**: dense fog rolls over the enemy half. You can't see their pieces.
- **Battle Royale**: the outer ring of the board collapses. Pieces on the edge are eliminated.
- **Clash Royale**: pieces move on their own. Spend resources to deploy reinforcements via drag and drop.
- **Minefield**: hidden mines are scattered across the board. Step on one and your piece explodes.
- **King of the Hill**: hold 3 of the 4 center squares for 3 consecutive rounds to win.
- **Gravity**: gravity pulls all pieces in one direction and shifts every few turns. The board rotates to match.
- **Hex Chess**: surviving pieces move onto a hexagonal board, then back again when the mode ends.
- **Stratego**: enemy pieces are hidden until they capture, and lakes block the center.

## Features

- Automatic mode rotation with announcements and hint banners
- Score tracking across modes (a point for each win)
- 10-second move timer with countdown overlay
- AI opponent that plays automatically
- Piece slide, rock-settle, and explosion animations
- Drag-and-drop piece movement with pendulum swing physics
- Portal teleportation animations with particle trails
- Skip mode and pause/resume controls
- Dev mode (Ctrl+Shift+D) to jump to any mode and stay there

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

On macOS you can also double-click `start.command`, which starts the dev server and opens the browser.
