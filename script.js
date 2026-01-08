class DominoCrossGame {
    constructor() {
        this.gridSize = 6;
        this.grid = [];
        this.solution = [];
        this.userGrid = [];
        this.dominoTypes = [];
        this.obstacles = [];
        this.rowClues = [];
        this.colClues = [];
        this.activeDomino = null;
        this.availableShapes = []; 
        
        this.score = 2000;
        this.timerInterval = null;
        this.hintCooldownTimer = null;
        this.inputLocked = false;
        this.lastHintTime = 0;

        // DOM Elements
        this.titleScreen = document.getElementById('title-screen');
        this.gameContainer = document.querySelector('.game-container');
        this.continueBtn = document.getElementById('continue-btn');
        this.resetDataBtn = document.getElementById('reset-data-btn');
        this.backToMenuBtn = document.getElementById('back-to-menu-btn');
        
        this.gridEl = document.getElementById('grid');
        this.paletteEl = document.getElementById('palette');
        this.rowCluesEl = document.getElementById('row-clues');
        this.colCluesEl = document.getElementById('col-clues');
        this.difficultySelect = document.getElementById('difficulty-select');
        this.scoreEl = document.getElementById('score');
        this.hintBtn = document.getElementById('hint-btn');
        
        // Modal logic
        this.modal = document.getElementById('instruction-modal');
        this.closeModalBtn = document.getElementById('close-modal');
        this.startPlayingBtn = document.getElementById('start-playing-btn');

        this.closeModalBtn.onclick = () => this.modelClose();
        this.startPlayingBtn.onclick = () => this.modelClose();
        window.onclick = (e) => {
            if (e.target == this.modal) this.modelClose();
        }

        // Title Screen Events
        document.querySelectorAll('.menu-btn[data-diff]').forEach(btn => {
            btn.addEventListener('click', () => {
                const diff = btn.getAttribute('data-diff');
                this.startNewGame(diff);
            });
        });

        this.continueBtn.addEventListener('click', () => this.continueGame());
        this.resetDataBtn.addEventListener('click', () => this.resetData());
        this.backToMenuBtn.addEventListener('click', () => {
            localStorage.removeItem('dominoCrossSave');
            this.showTitleScreen();
        });

        this.hintBtn.addEventListener('click', () => this.useHint());

        // Initialize
        this.showTitleScreen();
    }

    modelClose() {
        this.modal.classList.remove('show');
    }

    showTitleScreen() {
        this.stopTimer();
        this.titleScreen.classList.remove('hidden');
        this.gameContainer.classList.add('hidden');
        
        // Check for save
        const saved = localStorage.getItem('dominoCrossSave');
        if (saved) {
            this.continueBtn.style.display = 'block';
            this.continueBtn.textContent = `Continue Game`;
        } else {
            this.continueBtn.style.display = 'none';
        }
    }

    resetData() {
        if(confirm("Are you sure you want to delete ALL data including high scores and saved games?")) {
            localStorage.clear();
            alert("Data reset.");
            this.showTitleScreen();
        }
    }

    continueGame() {
        if (this.loadGame()) {
            this.titleScreen.classList.add('hidden');
            this.gameContainer.classList.remove('hidden');
            this.render();
            this.startTimer();
        } else {
            alert("Failed to load game save.");
            this.showTitleScreen();
        }
    }

    startNewGame(difficulty) {
        this.difficultySelect.value = difficulty; // Sync hidden select
        this.setupDifficulty(difficulty);
        console.log(`Starting new game: ${this.gridSize}x${this.gridSize}`);

        this.titleScreen.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');

        this.stopTimer();
        this.score = 2000;
        this.updateScoreDisplay();
        this.startTimer();
        
        this.inputLocked = false;
        this.hintBtn.disabled = true; 
        this.lastHintTime = 0; 
        
        if(this.hintTimeout) clearTimeout(this.hintTimeout);

        let success = false;
        while (!success) {
            success = this.generateLevel();
        }

        this.initUserGrid();
        this.saveGame();
        this.render();
    }
    
    // Removed duplicate startNewGame/restartLevel from below, relying on these new methods
    // Legacy restartLevel is replaced by back button logic effectively, or we can keep it for "Restart Level" button support if we kept it?
    // We hid key restart button, but let's keep the method just in case or delete it.
    // Actually, user said "when restart game it moves back to title screen".
    // I mapped "Exit to Menu" to showTitleScreen.
    // If there is another "Restart Level" button (I hid it), it should probably still work as actual level restart
    // Or I should make "Restart Level" go to title screen?
    // Prompt: "when player clicks restart game it actually moves the game back to title screen"
    // So if I kept the button, it calls showTitleScreen.


    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.score > 0) {
                // Decay based on difficulty
                let decay = 1;
                const diff = this.difficultySelect.value;
                if (diff === 'medium') decay = 2;
                if (diff === 'hard') decay = 5; // Fast decay for Hard mode

                this.score = Math.max(0, this.score - decay);
                this.updateScoreDisplay();
                
                // Periodic save (approx every 5s-ish logic check, but let's just save on moves usually)
                // Saving every second is too much I/O maybe? keeping it every 5 ticks of pure counter or just check time?
                // The original code was score % 5, which with decay 5 happens every tick.
                // Let's rely on moves for saving, but maybe just periodic check logic is fine.
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateScoreDisplay() {
        this.scoreEl.textContent = this.score;
    }

    checkHintAvailability() {
        if (this.inputLocked) return; // Don't updating button state while hinting

        const now = Date.now();
        const onCooldown = (now - this.lastHintTime < 30000);

        // Check 50% fill
        let filledCount = 0;
        let totalCount = this.gridSize * this.gridSize;
        let obstacleCount = 0;

        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                const cell = this.userGrid[r][c];
                if (cell && cell.obstacle) obstacleCount++;
                else if (cell !== null) filledCount++;
            }
        }
        
        const playableCells = totalCount - obstacleCount;
        const fillPercentage = filledCount / playableCells;

        if (onCooldown) {
            this.hintBtn.disabled = true;
            this.hintBtn.title = "On cooldown (30s)";
        } else if (fillPercentage < 0.25) { // Relaxed to 25% to be more accessible
            this.hintBtn.disabled = true;
            this.hintBtn.title = `Fill 25% or more to use hint (${Math.floor(fillPercentage*100)}%)`;
        } else {
            this.hintBtn.disabled = false;
            this.hintBtn.title = "Use hint (-200 points)";
        }
    }

    saveGame() {
        const state = {
            gridSize: this.gridSize,
            grid: this.grid,
            solution: this.solution,
            userGrid: this.userGrid,
            dominoTypes: this.dominoTypes,
            obstacles: this.obstacles,
            rowClues: this.rowClues,
            colClues: this.colClues,
            score: this.score,
            difficulty: this.difficultySelect.value,
            lastHintTime: this.lastHintTime
        };
        localStorage.setItem('dominoCrossSave', JSON.stringify(state));
    }

    loadGame() {
        const saved = localStorage.getItem('dominoCrossSave');
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            this.gridSize = state.gridSize;
            this.grid = state.grid;
            this.solution = state.solution;
            this.userGrid = state.userGrid;
            this.dominoTypes = state.dominoTypes;
            this.obstacles = state.obstacles;
            this.rowClues = state.rowClues;
            this.colClues = state.colClues;
            this.score = state.score;
            this.lastHintTime = state.lastHintTime || 0;
            
            // Set UI
            this.difficultySelect.value = state.difficulty || 'easy';
            this.setupDifficulty(state.difficulty || 'easy'); // Ensure maxPips etc are set
            this.updateScoreDisplay();
            
            return true;
        } catch (e) {
            console.error("Failed to load game", e);
            return false;
        }
    }

    useHint() {
        if (this.inputLocked) return;
        
        // Final sanity check
        let filledCount = 0;
        let obstacleCount = 0;
        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                const cell = this.userGrid[r][c];
                if (cell && cell.obstacle) obstacleCount++;
                else if (cell !== null) filledCount++;
            }
        }
        const playable = (this.gridSize * this.gridSize) - obstacleCount;
        if (filledCount / playable < 0.25) return;


        const now = Date.now();
        if (now - this.lastHintTime < 30000) return; // double check

        this.score = Math.max(0, this.score - 200);
        this.updateScoreDisplay();
        
        this.lastHintTime = now;
        this.hintBtn.disabled = true;
        this.inputLocked = true;
        this.saveGame();

        // Apply visual hints
        const cells = document.querySelectorAll('.cell');
        cells.forEach(el => {
            const r = parseInt(el.dataset.r);
            const c = parseInt(el.dataset.c);
            const userCell = this.userGrid[r][c];

            if (userCell && !userCell.obstacle) {
                // Determine correctness
                const sol = this.solution[r][c];
                // Check value match
                if (userCell.val === sol.val) {
                    el.classList.add('hint-correct');
                } else {
                    el.classList.add('hint-wrong');
                }
            }
        });

        // After 3 seconds, remove wrong ones and unlock
        this.hintTimeout = setTimeout(() => {
            this.removeWrongDominos();
            this.inputLocked = false;
            
            // Start cooldown visual logic if needed, but button is disabled. 
            // Re-enable button after 30s total (3s active + 27s wait)
            // Or 30s from start of hint.
            const remaining = 30000 - 3000;
            setTimeout(() => {
               this.checkHintAvailability();
            }, remaining);
            
            this.render(); // Re-render to clear classes and update grid
            this.saveGame();
        }, 3000);
    }

    removeWrongDominos() {
        // Collect wrong cells first to avoid mess up during removal
        const toRemove = [];
        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                const userCell = this.userGrid[r][c];
                if (userCell && !userCell.obstacle) {
                    const sol = this.solution[r][c];
                    if (userCell.val !== sol.val) {
                        toRemove.push({r,c});
                    }
                }
            }
        }

        toRemove.forEach(pos => {
            // Use existing remove logic which handles partners
            // Note: removeDomino handles partner removal, so we might try to remove something twice, 
            // but removeDomino checks for null.
            this.removeDomino(pos.r, pos.c);
        });
    }

    render() {
        this.renderGrid();
        this.renderClues();
        this.renderPalette();
        this.checkHintAvailability(); // Check every render (move)
        this.checkWinCondition();
    }

    setupDifficulty(diff) {
        if (diff === 'very-easy') {
            this.gridSize = 4;
            this.maxPips = 2; // Simple numbers
            this.numDominoTypes = 2; 
            this.availableShapes = [
                { type: 'H2', cells: [[0,0], [0,1]], name: 'Horizontal 2' },
                { type: 'V2', cells: [[0,0], [1,0]], name: 'Vertical 2' }
            ];
        } else if (diff === 'easy') {
            this.gridSize = 6;
            this.maxPips = 3;
            this.numDominoTypes = 2; // 1 Vertical, 1 Horizontal
            this.availableShapes = [
                { type: 'H2', cells: [[0,0], [0,1]], name: 'Horizontal 2' },
                { type: 'V2', cells: [[0,0], [1,0]], name: 'Vertical 2' }
            ];
        } else if (diff === 'medium') {
            this.gridSize = 8;
            this.maxPips = 5;
            this.numDominoTypes = 2;
            this.availableShapes = [
                { type: 'H2', cells: [[0,0], [0,1]], name: 'Horizontal 2' },
                { type: 'V2', cells: [[0,0], [1,0]], name: 'Vertical 2' }
            ];
        } else {
            this.gridSize = 10;
            this.maxPips = 6;
            this.numDominoTypes = 3; 
            // Add 3-cell shapes: H3, V3, L-shapes
            this.availableShapes = [
                { type: 'H2', cells: [[0,0], [0,1]], name: 'Horizontal 2' },
                { type: 'V2', cells: [[0,0], [1,0]], name: 'Vertical 2' },
                { type: 'H3', cells: [[0,0], [0,1], [0,2]], name: 'Horizontal 3' },
                { type: 'V3', cells: [[0,0], [1,0], [2,0]], name: 'Vertical 3' },
                { type: 'L_BR', cells: [[0,0], [0,1], [1,1]], name: 'L (Bottom-Right)' }, // 7 shape
                { type: 'L_BL', cells: [[0,0], [0,1], [1,0]], name: 'L (Bottom-Left)' }, // r shape
                { type: 'L_TR', cells: [[1,0], [1,1], [0,1]], name: 'L (Top-Right)' }, // J shape
                { type: 'L_TL', cells: [[1,0], [1,1], [0,0]], name: 'L (Top-Left)' }  // L shape
            ];
        }
    }
    
    // Legacy stub if needed, but render() is now standalone in class
    // render() { ... } replaced above

    generateLevel() {
        // 1. Initialize empty grid
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        
        // 2. Generate generic tiling
        if (!this.createRandomTiling()) return false;

        // 3. Create Domino Types (Palette)
        this.dominoTypes = this.generateDominoTypes();
        
        // 4. Assign types to tiling to create solution
        this.solution = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(null));
        this.assignTypesToTiling();

        // 5. Add Obstacles (Remove ~10-15% of dominoes)
        this.placeObstacles();

        // 6. Calculate Clues
        this.calculateClues();

        return true;
    }

    createRandomTiling() {
        // Robust Algorithm: Deterministic Fill + Random Shuffle (Tiling by Flips)
        // This guarantees a valid tiling and prevents freezing/crashing on large grids (10x10).

        // 1. Initial Fill: All Horizontal
        // (Assumes even grid size, which is true for 4, 6, 8, 10)
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c += 2) {
                this.grid[r][c] = { type: 'H', part: 1 };
                this.grid[r][c+1] = { type: 'H', part: 2 };
            }
        }

        // 2. Shuffle by flipping 2x2 blocks
        // N * N * 20 provides good randomization without performance hit
        const moves = this.gridSize * this.gridSize * 20; 
        
        for (let i = 0; i < moves; i++) {
            // Pick random top-left corner of a 2x2 block
            const r = Math.floor(Math.random() * (this.gridSize - 1));
            const c = Math.floor(Math.random() * (this.gridSize - 1));

            const cellTL = this.grid[r][c];     // Top-Left
            const cellTR = this.grid[r][c+1];   // Top-Right
            const cellBL = this.grid[r+1][c];   // Bottom-Left
            // const cellBR = this.grid[r+1][c+1]; // Bottom-Right (implied)

            // Case A: Two Horizontal rows stacked
            // [H1 H2]
            // [H1 H2]
            if (cellTL.type === 'H' && cellTL.part === 1 &&
                cellBL.type === 'H' && cellBL.part === 1) {
                
                // Flip to Vertical
                this.grid[r][c] = { type: 'V', part: 1 };
                this.grid[r+1][c] = { type: 'V', part: 2 };
                
                this.grid[r][c+1] = { type: 'V', part: 1 };
                this.grid[r+1][c+1] = { type: 'V', part: 2 };
            }
            // Case B: Two Verticals side-by-side
            // [V1 V1]
            // [V2 V2]
            else if (cellTL.type === 'V' && cellTL.part === 1 &&
                     cellTR.type === 'V' && cellTR.part === 1) {
                
                // Flip to Horizontal
                this.grid[r][c] = { type: 'H', part: 1 };
                this.grid[r][c+1] = { type: 'H', part: 2 };
                
                this.grid[r+1][c] = { type: 'H', part: 1 };
                this.grid[r+1][c+1] = { type: 'H', part: 2 };
            }
        }
        
        return true;
    }

    generateDominoTypes() {
        const types = [];
        // Ensure at least one H and one V
        const orientations = ['V', 'H'];
        
        // For remaining allowed types
        for (let i = 0; i < this.numDominoTypes; i++) {
            // Distribute orientations: 0->V, 1->H, 2->Random
            let orient;
            if (i === 0) orient = 'V';
            else if (i === 1) orient = 'H';
            else orient = Math.random() > 0.5 ? 'V' : 'H';

            types.push({
                id: i,
                orientation: orient,
                top: Math.floor(Math.random() * (this.maxPips + 1)),
                bottom: Math.floor(Math.random() * (this.maxPips + 1))
            });
        }
        return types;
    }

    // Previous render implementation was:
    // render() {
    //     this.renderGrid();
    //     this.renderClues();
    //     this.renderPalette();
    //     this.checkWinCondition();
    // }
    // Now it is updated above to include checkHintAvailability

    assignTypesToTiling() {
        // Map abstract grid to solution grid with values
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = this.grid[r][c];
                if (cell.part === 1) {
                    // Find suitable type
                    const suitableTypes = this.dominoTypes.filter(t => t.orientation === cell.type);
                    const chosen = suitableTypes[Math.floor(Math.random() * suitableTypes.length)];
                    
                    // Assign to solution
                    if (cell.type === 'H') {
                        this.solution[r][c] = { val: chosen.top, pId: chosen.id }; // Left
                        this.solution[r][c+1] = { val: chosen.bottom, pId: chosen.id }; // Right
                    } else {
                        this.solution[r][c] = { val: chosen.top, pId: chosen.id }; // Top
                        this.solution[r+1][c] = { val: chosen.bottom, pId: chosen.id }; // Bottom
                    }
                }
            }
        }
    }

    placeObstacles() {
        // Identify domino pairs in solution.
        let pairs = [];
        const visited = new Set();
        
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const key = `${r},${c}`;
                if (visited.has(key)) continue;

                // Check direction based on grid structure (re-infer or store ref)
                // Actually we have this.grid which has structure info
                const struct = this.grid[r][c];
                
                if (struct.type === 'H') {
                    pairs.push({r1: r, c1: c, r2: r, c2: c+1});
                    visited.add(`${r},${c}`);
                    visited.add(`${r},${c+1}`);
                } else {
                    pairs.push({r1: r, c1: c, r2: r+1, c2: c});
                    visited.add(`${r},${c}`);
                    visited.add(`${r+1},${c}`);
                }
            }
        }

        // Shuffle and pick 10%
        pairs.sort(() => Math.random() - 0.5);
        const count = Math.max(1, Math.floor(pairs.length * 0.15)); // 15% obstacles

        for (let i = 0; i < count; i++) {
            const p = pairs[i];
            // Mark as obstacle in solution (value 0 or null for sum?)
            // Normally obstacles don't count towards sum in Picross, or they are just blockers?
            // "place the dominos that they all fill the grid... remove the dominos... place obstacles"
            // If an obstacle is there, no number is there. So value is 0.
            this.solution[p.r1][p.c1] = { val: 0, obstacle: true };
            this.solution[p.r2][p.c2] = { val: 0, obstacle: true };
        }
    }

    calculateClues() {
        this.rowClues = Array(this.gridSize).fill(0);
        this.colClues = Array(this.gridSize).fill(0);

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = this.solution[r][c];
                if (!cell.obstacle) {
                    this.rowClues[r] += cell.val;
                    this.colClues[c] += cell.val;
                }
            }
        }
    }

    initUserGrid() {
        this.userGrid = Array(this.gridSize).fill().map((_, r) => 
            Array(this.gridSize).fill().map((_, c) => {
                if (this.solution[r][c].obstacle) return { obstacle: true };
                return null;
            })
        );
        
        if (this.difficultySelect.value === 'very-easy') {
            this.prefillVeryEasy();
        }
    }

    prefillVeryEasy() {
        const heads = [];
        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                // relying on this.grid for structure (H/V, part 1/2)
                // relying on this.solution for values/obstacles
                if (this.grid[r][c] && this.grid[r][c].part === 1) {
                    const sol = this.solution[r][c];
                    if (!sol.obstacle) {
                        heads.push({r, c});
                    }
                }
            }
        }

        // Shuffle and pick 2
        heads.sort(() => Math.random() - 0.5);
        const toReveal = heads.slice(0, 2);

        toReveal.forEach(pos => {
            const {r, c} = pos;
            const solHead = this.solution[r][c];
            const type = this.grid[r][c].type; // 'H' or 'V'
            
            if (type === 'H') {
                const solTail = this.solution[r][c+1];
                this.userGrid[r][c] = { val: solHead.val, type: 'H', isHead: true, pId: solHead.pId };
                this.userGrid[r][c+1] = { val: solTail.val, type: 'H', isHead: false, pId: solTail.pId };
            } else {
                const solTail = this.solution[r+1][c];
                this.userGrid[r][c] = { val: solHead.val, type: 'V', isHead: true, pId: solHead.pId };
                this.userGrid[r+1][c] = { val: solTail.val, type: 'V', isHead: false, pId: solTail.pId };
            }
        });
    }

    render() {
        this.renderGrid();
        this.renderClues();
        this.renderPalette();
        this.checkWinCondition();
    }

    renderClues() {
        this.colCluesEl.innerHTML = '';
        this.colCluesEl.style.width = `calc(${this.gridSize} * (var(--cell-size) + var(--gap-size)))`; // fail-safe
        
        this.colClues.forEach((sum, idx) => {
            const el = document.createElement('div');
            el.className = 'col-clue';
            el.textContent = sum;
            
            // Check status
            const currentSum = this.calculateCurrentColSum(idx);
            if (currentSum === sum && this.isColFull(idx)) el.classList.add('clue-correct');
            else if (currentSum > sum) el.classList.add('clue-wrong');

            this.colCluesEl.appendChild(el);
        });

        this.rowCluesEl.innerHTML = '';
        this.rowClues.forEach((sum, idx) => {
            const el = document.createElement('div');
            el.className = 'row-clue';
            el.textContent = sum;

            const currentSum = this.calculateCurrentRowSum(idx);
            if (currentSum === sum && this.isRowFull(idx)) el.classList.add('clue-correct');
            else if (currentSum > sum) el.classList.add('clue-wrong');

            this.rowCluesEl.appendChild(el);
        });
    }

    // render() method logic is now distributed or called from main render() 

    calculateCurrentRowSum(r) {
        let sum = 0;
        for (let c = 0; c < this.gridSize; c++) {
            const cell = this.userGrid[r][c];
            if (cell && !cell.obstacle && cell.val !== undefined) sum += cell.val;
        }
        return sum;
    }

    calculateCurrentColSum(c) {
        let sum = 0;
        for (let r = 0; r < this.gridSize; r++) {
            const cell = this.userGrid[r][c];
            if (cell && !cell.obstacle && cell.val !== undefined) sum += cell.val;
        }
        return sum;
    }
    
    isRowFull(r) {
        return this.userGrid[r].every(cell => cell !== null);
    }

    isColFull(c) {
        for(let r=0; r<this.gridSize; r++) {
            if(this.userGrid[r][c] === null) return false;
        }
        return true;
    }
    
    // Legacy render method was here, moved up to support checkHintAvailability

    renderGrid() {
        this.gridEl.innerHTML = '';
        this.gridEl.style.gridTemplateColumns = `repeat(${this.gridSize}, var(--cell-size))`;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cellEl = document.createElement('div');
                cellEl.classList.add('cell');
                cellEl.dataset.r = r;
                cellEl.dataset.c = c;

                const userCell = this.userGrid[r][c];

                if (userCell && userCell.obstacle) {
                    cellEl.classList.add('obstacle');
                } else if (userCell) {
                    // Render placed domino part
                    const partEl = document.createElement('div');
                    partEl.classList.add('domino-part');
                    
                    // Add orientation classes
                    if (userCell.type === 'V') {
                        if (userCell.isHead) partEl.classList.add('domino-vertical-top');
                        else partEl.classList.add('domino-vertical-bottom');
                    } else {
                        if (userCell.isHead) partEl.classList.add('domino-horizontal-left');
                        else partEl.classList.add('domino-horizontal-right');
                    }

                    // Render Pips
                    partEl.appendChild(this.createPips(userCell.val));
                    cellEl.appendChild(partEl);
                }

                cellEl.addEventListener('click', (e) => this.handleGridClick(r, c, e));
                cellEl.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.removeDomino(r, c);
                });

                this.gridEl.appendChild(cellEl);
            }
        }
    }

    createPips(num) {
        const container = document.createElement('div');
        container.className = `pip-container p${num}`;
        for(let i=0; i<9; i++) {
            const pip = document.createElement('div');
            pip.className = 'pip';
            container.appendChild(pip);
        }
        return container;
    }

    renderPalette() {
        this.paletteEl.innerHTML = '';
        
        // Count totals needed
        const diff = this.difficultySelect.value;
        const showCounts = (diff === 'easy' || diff === 'very-easy');
        const counts = {}; // pId -> {total, current}

        if (showCounts) {
            // Init
            this.dominoTypes.forEach(t => counts[t.id] = {total: 0, current: 0});

            // Calculate Totals from solution
            for(let r=0; r<this.gridSize; r++) {
                for(let c=0; c<this.gridSize; c++) {
                    const sol = this.solution[r][c];
                    // Only count heads to avoid double counting per domino (since 1 domino = 2 cells)
                    // Or since solution grid stores values for each cell, we can just count every cell that matches a pId
                    // Actually, let's count occurrences of pId in solution / 2
                    if (sol && !sol.obstacle && sol.pId !== undefined) {
                         counts[sol.pId].total += 0.5;
                    }
                }
            }

            // Calculate Current from User Grid
             for(let r=0; r<this.gridSize; r++) {
                for(let c=0; c<this.gridSize; c++) {
                    const cell = this.userGrid[r][c];
                    if (cell && !cell.obstacle && cell.pId !== undefined) {
                         counts[cell.pId].current += 0.5;
                    }
                }
            }
        }

        this.dominoTypes.forEach((type, index) => {
            const item = document.createElement('div');
            item.className = 'palette-item';
            if (this.activeDomino === type) item.classList.add('selected');
            
            // Add Badge
            if (showCounts) {
                const c = counts[type.id];
                const remaining = Math.max(0, Math.ceil(c.total - c.current));
                const badge = document.createElement('div');
                badge.className = 'count-badge';
                badge.textContent = `x${remaining}`;
                item.appendChild(badge);
            }

            item.onclick = () => {
                this.activeDomino = type;
                this.renderPalette();
            };

            const preview = document.createElement('div');
            preview.className = `domino-preview ${type.orientation === 'V' ? 'vertical' : 'horizontal'}`;
            
            const part1 = document.createElement('div');
            part1.className = 'domino-preview-part';
            part1.appendChild(this.createPips(type.top));
            
            const part2 = document.createElement('div');
            part2.className = 'domino-preview-part';
            part2.appendChild(this.createPips(type.bottom));

            preview.appendChild(part1);
            preview.appendChild(part2);
            item.appendChild(preview);
            
            this.paletteEl.appendChild(item);
        });
    }

    handleGridClick(r, c) {
        if (this.inputLocked) return;

        const cell = this.userGrid[r][c];
        
        // If clicked on an existing domino (not obstacle), remove it
        if (cell !== null) {
            if (!cell.obstacle) {
                this.removeDomino(r, c);
                // Save is handled by timer loop to prevent lag
            }
            return;
        }

        if (!this.activeDomino) return;

        const type = this.activeDomino;

        if (type.orientation === 'V') {
            if (r + 1 < this.gridSize && this.userGrid[r+1][c] === null) {
                // Place Vertical
                this.userGrid[r][c] = { val: type.top, type: 'V', isHead: true, pId: type.id };
                this.userGrid[r+1][c] = { val: type.bottom, type: 'V', isHead: false, pId: type.id };
                this.render();
            }
        } else {
            if (c + 1 < this.gridSize && this.userGrid[r][c+1] === null) {
                // Place Horizontal
                this.userGrid[r][c] = { val: type.top, type: 'H', isHead: true, pId: type.id };
                this.userGrid[r][c+1] = { val: type.bottom, type: 'H', isHead: false, pId: type.id };
                this.render();
            }
        }
    }

    removeDomino(r, c) {
        const cell = this.userGrid[r][c];
        if (!cell || cell.obstacle) return;

        // Find partner
        if (cell.type === 'V') {
            if (cell.isHead) {
                this.userGrid[r][c] = null;
                this.userGrid[r+1][c] = null;
            } else {
                this.userGrid[r][c] = null;
                this.userGrid[r-1][c] = null;
            }
        } else {
            if (cell.isHead) {
                this.userGrid[r][c] = null;
                this.userGrid[r][c+1] = null;
            } else {
                this.userGrid[r][c] = null;
                this.userGrid[r][c-1] = null;
            }
        }
        this.render();
    }

    checkWinCondition() {
        // Check if all filled
        for(let r=0; r<this.gridSize; r++) {
            for(let c=0; c<this.gridSize; c++) {
                if(this.userGrid[r][c] === null) return;
            }
        }

        // Check sums
        for(let r=0; r<this.gridSize; r++) {
            if(this.calculateCurrentRowSum(r) !== this.rowClues[r]) return;
        }
        for(let c=0; c<this.gridSize; c++) {
            if(this.calculateCurrentColSum(c) !== this.colClues[c]) return;
        }

        this.stopTimer();
        this.saveHighScore();
        setTimeout(() => this.showHighScoreModal(), 300);
    }

    saveHighScore() {
        const diff = this.difficultySelect.value;
        const key = `dominoCross_highScores_${diff}`;
        let scores = JSON.parse(localStorage.getItem(key)) || [];
        
        scores.push({
            score: this.score,
            date: new Date().toLocaleString()
        });

        // Sort descending
        scores.sort((a, b) => b.score - a.score);
        
        // Keep top 5
        scores = scores.slice(0, 5);
        
        localStorage.setItem(key, JSON.stringify(scores));
    }

    showHighScoreModal() {
        const modal = document.getElementById('highScoreModal');
        const scoreDisplay = document.getElementById('currentScoreDisplay');
        const diffSpan = document.getElementById('highScoreDifficulty');
        const list = document.getElementById('highScoreList');
        
        const diff = this.difficultySelect.value;
        const key = `dominoCross_highScores_${diff}`;
        const scores = JSON.parse(localStorage.getItem(key)) || [];

        scoreDisplay.textContent = `Final Score: ${this.score}`;
        diffSpan.textContent = diff.replace('-', ' ').toUpperCase();
        
        list.innerHTML = '';
        scores.forEach((entry, idx) => {
            const li = document.createElement('li');
            li.style.padding = '5px 0';
            li.style.borderBottom = '1px solid #eee';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            
            const isCurrent = (entry.score === this.score && entry.date === new Date().toLocaleString()); // Rough check, maybe add ID if needed but fine for now
            if(idx === 0) li.style.fontWeight = 'bold';
            
            li.innerHTML = `<span>${idx + 1}. ${entry.score} pts</span> <span style="font-size:0.8em; color:#666;">${entry.date}</span>`;
            list.appendChild(li);
        });

        modal.style.display = 'flex';
    }
}

// Initialize
window.onload = () => {
    new DominoCrossGame();
};
