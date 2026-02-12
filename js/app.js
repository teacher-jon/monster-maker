/* Monster Maker App Logic */

// --- CONFIGURATION ---
// --- CONFIGURATION ---
// Using Base64 encoded assets to avoid Tainted Canvas errors on file:// protocol
const ASSETS = (typeof ENCODED_ASSETS !== 'undefined') ? ENCODED_ASSETS : {
    bodies: [], eyes: [], mouths: [], accessories: []
};

// --- STATE ---
let canvas;
let currentTab = 'bodies';

// --- SOUND EFFECTS ---
const SOUNDS = {
    pop: new Audio('assets/sounds/pop.mp3'),
    click: new Audio('assets/sounds/click.mp3'),
    incubate: new Audio('assets/sounds/incubate.mp3'),
    snap: new Audio('assets/sounds/snap.mp3'),
    trash: new Audio('assets/sounds/trash.mp3')
};
// Helper to try playing sound if exists
function playSound(name) {
    if (SOUNDS[name]) {
        try {
            SOUNDS[name].currentTime = 0;
            SOUNDS[name].play().catch(e => console.log("Sound error:", e));
        } catch (e) { console.log("Sound file missing:", name); }
    }
}

// --- HISTORY STATE ---
let history = [];
let historyStep = -1;
let isUndoRedo = false; // Flag to prevent saving state during undo/redo

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    renderInventory(currentTab);
    setupEventListeners();
});

function initCanvas() {
    canvas = new fabric.Canvas('monsterCanvas', {
        width: 600,
        height: 500,
        isDrawingMode: false,
        backgroundColor: '#f0f0f0'  // Light gray background for visibility
    });

    // Save initial state
    saveHistory();

    // History Listeners
    canvas.on('object:added', () => { if (!isUndoRedo) saveHistory(); });
    canvas.on('object:modified', () => { if (!isUndoRedo) saveHistory(); });
    canvas.on('object:removed', () => { if (!isUndoRedo) saveHistory(); });

    // Custom Brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = "#000000";

    // Setup Drop Zone
    // Setup Drop Zone
    // Using the canvas wrapper created by Fabric (canvas-container)
    const dropZone = canvas.wrapperEl;

    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.style.boxShadow = '0 0 15px #00e676';
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // REQUIRED to allow drop
        e.dataTransfer.dropEffect = 'copy';
        dropZone.style.boxShadow = '0 0 15px #00e676';
    });

    dropZone.addEventListener('dragleave', (e) => {
        dropZone.style.boxShadow = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.boxShadow = '';

        const src = e.dataTransfer.getData('text/plain');
        console.log("DROP EVENT: Source=", src);

        if (src) {
            // Get canvas position
            // fabric.js lowerCanvasEl is the main lower canvas element
            const rect = canvas.lowerCanvasEl.getBoundingClientRect();

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            console.log("DROP COORDS:", x, y);
            addToCanvas(src, x, y);
        }
    });
}

// --- INVENTORY SYSTEM ---
function renderInventory(category) {
    const grid = document.getElementById('assetGrid');
    grid.innerHTML = ''; // Clear

    const items = ASSETS[category] || [];

    if (items.length === 0) {
        grid.innerHTML = '<div style="color:#666; font-style:italic; grid-column: 1/-1; text-align:center; padding:20px;">No parts discovered yet.</div>';
        return;
    }

    items.forEach(src => {
        const div = document.createElement('div');
        div.className = 'asset-item';
        div.draggable = true; // Enable Drag

        const img = document.createElement('img');
        img.src = src;
        img.draggable = false; // Prevent default ghosting

        div.appendChild(img);

        // Click Add (Backup)
        div.onclick = () => addToCanvas(src);

        // Drag Start
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', src);
            e.dataTransfer.effectAllowed = 'copy';
        });

        grid.appendChild(div);
    });
}

function addToCanvas(src, x = null, y = null) {
    console.log("addToCanvas called with:", src, x, y);
    fabric.Image.fromURL(src, function (img) {
        if (!img) {
            console.error("ERROR: fabric.Image.fromURL returned null for", src);
            return;
        }
        console.log("Image loaded successfully:", img);

        // Optimize scale based on part type roughly
        if (src.includes('bodies')) img.scaleToWidth(300);
        else if (src.includes('eyes')) img.scaleToWidth(100);
        else if (src.includes('mouths')) img.scaleToWidth(100);
        else img.scaleToWidth(150);

        // Position
        if (x !== null && y !== null) {
            img.set({
                left: x - (img.getScaledWidth() / 2),
                top: y - (img.getScaledHeight() / 2)
            });
        } else {
            // Center default
            img.set({
                left: canvas.width / 2 - (img.getScaledWidth() / 2),
                top: canvas.height / 2 - (img.getScaledHeight() / 2)
            });
        }

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll(); // Force render

        console.log("Image added to canvas and rendered.");

        // Switch to move mode automatically
        setDrawMode(false);
        // Switch to move mode automatically
        setDrawMode(false);
    });
}

// --- HISTORY SYSTEM ---
function saveHistory() {
    if (historyStep < history.length - 1) {
        history = history.slice(0, historyStep + 1);
    }
    history.push(JSON.stringify(canvas));
    historyStep++;
    updateHistoryButtons();
}

function undo() {
    if (historyStep > 0) {
        isUndoRedo = true;
        historyStep--;
        canvas.loadFromJSON(history[historyStep], () => {
            canvas.renderAll();
            isUndoRedo = false;
            updateHistoryButtons();
        });
    }
}

function redo() {
    if (historyStep < history.length - 1) {
        isUndoRedo = true;
        historyStep++;
        canvas.loadFromJSON(history[historyStep], () => {
            canvas.renderAll();
            isUndoRedo = false;
            updateHistoryButtons();
        });
    }
}

function updateHistoryButtons() {
    document.getElementById('btnUndo').disabled = (historyStep <= 0);
    document.getElementById('btnRedo').disabled = (historyStep >= history.length - 1);
}

// --- SCREENSHOT SYSTEM ---
// --- SCREENSHOT SYSTEM ---
function takeScreenshot() {
    playSound('snap');

    // 1. Deselect everything for clean monster shot
    canvas.discardActiveObject();
    canvas.renderAll();

    // 2. Create a temporary composite canvas
    // Monster is 600x500. We'll add 150px at the bottom for notes.
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = 600;
    tempCanvas.height = 650;

    // 3. Fill Background (White)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 4. Draw Monster
    // We need the dataURL from Fabric to draw it onto the temp canvas
    const monsterImg = new Image();
    monsterImg.onload = () => {
        // Draw monster at top
        ctx.drawImage(monsterImg, 0, 0);

        // 5. Draw Field Notes Background
        ctx.fillStyle = '#212121'; // Dark footer
        ctx.fillRect(0, 500, 600, 150);

        // 6. Draw Text
        ctx.fillStyle = '#00e676'; // Neon Green
        ctx.font = 'bold 24px monospace';
        ctx.fillText("📝 FIELD NOTES:", 20, 535);

        // Get Values
        const adj = document.getElementById('adjInput').value || "_____";
        const adv = document.getElementById('advInput').value || "_____";
        const prep = document.getElementById('prepInput').value || "_____";
        // Clean noun from HTML tags
        const nounRaw = document.getElementById('outNoun').innerText;
        const noun = nounRaw.replace(/<[^>]*>?/gm, '') || "_____";

        // Construct Sentence
        const line1 = `The ${adj} beast waits ${adv}`;
        const line2 = `${prep} to show its ${noun}.`;

        ctx.font = '18px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(line1, 20, 575);
        ctx.fillText(line2, 20, 605);

        // 7. Export Composite
        const finalDataUrl = tempCanvas.toDataURL('image/png');
        handleExport(finalDataUrl);
    };
    // Load the fabric canvas image
    monsterImg.src = canvas.toDataURL({ format: 'png', multiplier: 1 });
}

function handleExport(dataUrl) {
    try {
        // Try Web Share API (iPad/Mobile)
        if (navigator.share && navigator.canShare) {
            const blob = dataURItoBlob(dataUrl);
            const file = new File([blob], "monster-notes.png", { type: "image/png" });

            if (navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: 'My Monster Field Notes',
                    text: 'Scientific observation from the Monster Maker Lab.'
                }).catch((err) => {
                    console.warn("Share cancelled/failed:", err);
                    showHelpModal(dataUrl);
                });
                return;
            }
        }
    } catch (e) {
        console.warn("Share API error:", e);
    }
    // Fallback
    showHelpModal(dataUrl);
}

// Helper: Convert DataURI to Blob
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

function showHelpModal(dataUrl) {
    const modal = document.getElementById('helpModal');
    const img = document.getElementById('modalImage');
    img.src = dataUrl;
    modal.classList.add('active');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('active');
}

// --- CANVAS CONTROLS ---
function setDrawMode(isDraw) {
    canvas.isDrawingMode = isDraw;

    // UI Updates
    document.getElementById('btnDraw').classList.toggle('active', isDraw);
    document.getElementById('btnSelect').classList.toggle('active', !isDraw);
}

// --- SUFFIX MACHINE LOGIC ---
// --- SUFFIX MACHINE LOGIC ---
async function runIncubator() {
    const input = document.getElementById('adjInput').value.trim();
    if (!input) return;

    const display = document.getElementById('machineOutput');
    display.innerHTML = "🧬 ANALYZING DNA...";
    display.style.color = "#ff4081";
    playSound('incubate');

    try {
        // 1. Validation via Dictionary API
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${input}`);

        if (!response.ok) {
            throw new Error("Word not found");
        }

        const data = await response.json();

        // 1. Strict Check: If it's primarily a VERB, reject it (e.g. "Run", "Jump")
        const firstEntry = data[0];
        const firstMeaning = firstEntry?.meanings[0];
        const primaryPos = firstMeaning ? firstMeaning.partOfSpeech : "unknown";

        if (primaryPos === 'verb') {
            display.innerHTML = `⚠️ IS A VERB!`;
            display.style.color = "#ff5252";
            display.style.animation = "shake 0.5s";
            setTimeout(() => display.style.animation = "", 500);
            setTimeout(() => {
                display.innerHTML = "TRY: HAPPY, COLD...";
                display.style.color = "#aaa";
            }, 2000);
            return;
        }

        const isAdjective = data.some(entry =>
            entry.meanings.some(m => m.partOfSpeech === 'adjective')
        );

        if (!isAdjective) {
            // Find what it IS (Grab the first part of speech found)
            const firstMeaning = data[0]?.meanings[0];
            const detectedPos = firstMeaning ? firstMeaning.partOfSpeech.toUpperCase() : "UNKNOWN";

            display.innerHTML = `⚠️ IS A ${detectedPos}!`;
            display.style.color = "#ff5252";

            // Shake effect (requires CSS class 'shake' which we'll add via style.animation)
            display.style.animation = "shake 0.5s";
            setTimeout(() => display.style.animation = "", 500);

            setTimeout(() => {
                display.innerHTML = "NEED AN ADJECTIVE";
                display.style.color = "#aaa";
            }, 2000);
            return;
        }

        // 2. Process Valid Adjective
        display.innerHTML = "🧬 INCUBATING...";

        setTimeout(() => {
            let base = input.toLowerCase();
            let suffix = "ness";
            let result = "";
            let html = "";

            // Y Rule
            if (base.endsWith('y')) {
                let stem = base.substring(0, base.length - 1);
                result = stem + "i" + suffix;
                html = `${stem}<span style="color:#fff">i</span><span style="color:#00e676">${suffix}</span>`;
            } else {
                result = base + suffix;
                html = `${base}<span style="color:#00e676">${suffix}</span>`;
            }

            display.innerHTML = html;
            display.style.color = "#00e676";

            // Update outputs
            updateReport(input, result);

        }, 1000); // Slight delay for effect

    } catch (e) {
        // Fallback or Network Error - Allow it but warn
        console.warn("Dictionary check failed:", e);
        // If word not found, we might still let them try, or say "Unknown DNA"
        // For 2nd grade, simpler to just let it pass if offline/unknown?
        // User asked to "ensure" it is an adjective. 
        // If network fails, we'll assume valid to not block class.
        // If word truly not found (404), likely spelled wrong.

        if (e.message === "Word not found") {
            display.innerHTML = "⚠️ UNKNOWN SPECIMEN";
            return;
        }

        // Proceed if just network error
        runIncubatorOffline(input, display);
    }
}

function runIncubatorOffline(input, display) {
    let base = input.toLowerCase();
    let suffix = "ness";
    let html = "";
    let result = "";

    if (base.endsWith('y')) {
        let stem = base.substring(0, base.length - 1);
        result = stem + "i" + suffix;
        html = `${stem}<span style="color:#fff">i</span><span style="color:#00e676">${suffix}</span>`;
    } else {
        result = base + suffix;
        html = `${base}<span style="color:#00e676">${suffix}</span>`;
    }
    display.innerHTML = html;
    display.style.color = "#00e676";
    updateReport(input, result);
}

// --- LIVE REPORT UPDATER ---
function updateReport(adj, noun) {
    const adv = document.getElementById('advInput').value || "_____";
    const prep = document.getElementById('prepInput').value || "_____";

    // Web Layout
    document.getElementById('outAdj').innerText = adj;
    document.getElementById('outNoun').innerText = noun.replace(/<[^>]*>?/gm, ''); // Plain text
    document.getElementById('outAdv').innerText = adv;
    document.getElementById('outPrep').innerText = prep;

    // Print Layout
    document.getElementById('printAdj').innerText = adj;
    document.getElementById('printNoun').innerText = noun.replace(/<[^>]*>?/gm, '');

    document.getElementById('printAdj2').innerText = adj;
    document.getElementById('printNoun2').innerText = noun.replace(/<[^>]*>?/gm, '');
    document.getElementById('printAdv').innerText = adv;
    document.getElementById('printPrep').innerText = prep;
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.dataset.category;
            renderInventory(currentTab);
            playSound('click');
        });
    });

    // Controls
    document.getElementById('btnSelect').onclick = () => { setDrawMode(false); playSound('click'); };
    document.getElementById('btnDraw').onclick = () => { setDrawMode(true); playSound('click'); };
    document.getElementById('colorPicker').onchange = (e) => {
        canvas.freeDrawingBrush.color = e.target.value;
    };
    document.getElementById('btnClear').onclick = () => {
        if (confirm("Clear the tank?")) {
            canvas.clear();
            canvas.setBackgroundColor('#f0f0f0', canvas.renderAll.bind(canvas));
            saveHistory(); // Save clear state
            playSound('trash');
        }
    };

    // History Buttons
    document.getElementById('btnUndo').onclick = () => { undo(); playSound('click'); };
    document.getElementById('btnRedo').onclick = () => { redo(); playSound('click'); };

    // Screenshot / Share
    document.getElementById('btnDownload').onclick = takeScreenshot;

    // Help Modal
    document.getElementById('btnCloseModal').onclick = closeHelpModal;
    document.getElementById('helpModal').onclick = (e) => {
        if (e.target.id === 'helpModal') closeHelpModal();
    };

    // Machine
    document.getElementById('btnIncubate').onclick = () => {
        runIncubator();
        playSound('incubate');
    };

    // Inputs
    ['advInput', 'prepInput'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            const adj = document.getElementById('adjInput').value || "_____";
            const noun = document.getElementById('outNoun').innerText || "_____";
            updateReport(adj, noun);
        });
    });

    // Print prep
    window.onbeforeprint = () => {
        document.getElementById('printSnapshot').src = canvas.toDataURL();
    };
}
