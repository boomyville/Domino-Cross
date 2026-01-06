# Domino Cross

Domino Cross is a logic puzzle game inspired by Picross and Dominoes. The goal is to fill the grid with domino pieces such that the sum of pips (dots) in each row and column matches the target numbers displayed on the sides.

## How to Play

1.  **Select a Difficulty**: Choose between Easy (6x6), Medium (8x8), or Hard (10x10) from the dropdown data-menu.
2.  **Place Dominos**:
    *   Select a domino piece from the palette at the bottom (Vertical or Horizontal).
    *   Click on an empty spot in the grid to place it.
    *   The domino will fill two adjacent cells.
3.  **Match the Clues**:
    *   The numbers on the left indicate the target sum for each row.
    *   The numbers on the top indicate the target sum for each column.
    *   When a row or column sum matches the target and is fully filled, the number turns green.
    *   If the sum exceeds the target, the number turns red.
4.  **Win**: The game ends when the entire grid is validly filled and all row/column sums match their targets.

## Controls

*   **Left Click**: Place the selected domino type or remove an existing domino.
*   **Right Click**: Remove a placed domino.
*   **Hint Button**: reveals correct/incorrect placements for 3 seconds.
    *   Cost: 200 points.
    *   Condition: Can only be used when the board is more than 50% filled.
    *   Cooldown: 30 seconds.
*   **Restart Level**: Resets the current board to its initial state and resets the score.
*   **New Game**: Generates a completely new puzzle.

## Scoring System

*   **Starting Score**: 2000 points.
*   **Time Penalty**: -1 point every second.
*   **Hint Penalty**: -200 points per use.

## Features

*   **Procedural Generation**: Every level is randomly generated and guaranteed to be solvable.
*   **Auto-Save**: The game automatically saves your progress. You can close the browser and return later to continue where you left off.
*   **Difficulty Scaling**: Larger grids and higher domino values for increased challenge.

## Technologies Used

*   HTML5
*   CSS3
*   Vanilla JavaScript

## Installation and execution

1.  Download the project files.
2.  Open `index.html` in any modern web browser.
