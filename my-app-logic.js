import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// *** TU CONFIGURACIÓN DE FIREBASE INSERTADA AQUÍ ***
const firebaseConfig = {
    apiKey: "AIzaSyAPUcbUnT7Fabp8TQUj-_5M4Ox4Ip_c3GA",
    authDomain: "precisiontennisscores.firebaseapp.com",
    projectId: "precisiontennisscores",
    storageBucket: "precisiontennisscores.firebasestorage.app",
    messagingSenderId: "847832314171",
    appId: "1:847832314171:web:ce61405a155f67bf4ac71e",
    measurementId: "G-C842BQXWXN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 

// --- ELEMENTOS DEL DOM ---
const configScreen = document.getElementById('configScreen');
const managerScreen = document.getElementById('managerScreen');
const scoreScreen = document.getElementById('scoreScreen');
const matchesContainer = document.getElementById('matchesContainer');
const activeTournamentIdDisplay = document.getElementById('activeTournamentId');
const newIdSection = document.getElementById('newIdSection');
const numPlayersInput = document.getElementById('numPlayers');
const playerInputsContainer = document.getElementById('playerInputs');
const startGameBtn = document.getElementById('startGameBtn');
const tournamentIdInput = document.getElementById('tournamentIdInput');
const currentTournamentIdDisplay = document.getElementById('currentTournamentIdDisplay');

// ------------------------------------------------------------------
// --- UTILIDADES Y LÓGICA DE PARTIDOS ---
// ------------------------------------------------------------------

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function assignPlayersToGroups(players, numGroups) {
    if (numGroups < 1 || players.length === 0) return players;

    const shuffledPlayers = [...players]; 
    shuffleArray(shuffledPlayers);

    const groupLabels = [];
    for (let i = 0; i < numGroups; i++) {
        groupLabels.push(String.fromCharCode(65 + i)); 
    }

    return shuffledPlayers.map((player, index) => {
        const groupIndex = index % numGroups;
        return {
            ...player,
            group: groupLabels[groupIndex]
        };
    });
}

function generateGroupMatches(players) {
    const matches = [];
    const groups = {};

    players.forEach(player => {
        if (!groups[player.group]) {
            groups[player.group] = [];
        }
        groups[player.group].push(player);
    });

    for (const groupName in groups) {
        const groupPlayers = groups[groupName];
        for (let i = 0; i < groupPlayers.length; i++) {
            for (let j = i + 1; j < groupPlayers.length; j++) {
                matches.push({
                    id: `${groupPlayers[i].id}_vs_${groupPlayers[j].id}_${Date.now() + i + j}`,
                    player1: { id: groupPlayers[i].id, name: groupPlayers[i].name },
                    player2: { id: groupPlayers[j].id, name: groupPlayers[j].name },
                    group: groupName,
                    round: 1, 
                    status: 'pending',
                    score: { set1: [0, 0], set2: [0, 0], set3: [0, 0] } 
                });
            }
        }
    }
    return matches;
}

function renderMatches(tournamentId, matches) {
    activeTournamentIdDisplay.textContent = tournamentId;
    
    let htmlContent = '';
    
    if (matches && matches.length > 0) {
        matches.forEach(match => {
            htmlContent += `
                <div class="match-card">
                    <h4>GRUPO ${match.group}</h4>
                    <p><strong>${match.player1.name}</strong> vs <strong>${match.player2.name}</strong></p>
                    <p>Estado: ${match.status} | Sets: ${match.score.set1[0]}-${match.score.set1[1]}</p>
                    <button class="primary-btn" data-match-id="${match.id}" style="padding: 5px; width: auto; margin-top: 5px;">Actualizar Marcador</button>
                    <hr style="margin-top: 10px; border-color: #eee;">
                </div>
            `;
        });
    } else {
        htmlContent = '<p style="text-align: center; color: red;">No se pudieron generar partidos. Verifique la configuración de participantes y grupos.</p>';
    }

    matchesContainer.innerHTML = htmlContent;
}


// ------------------------------------------------------------------
// --- MANEJO DE VISTAS Y CONFIGURACIÓN ---
// ------------------------------------------------------------------

function showScreen(screenId) {
    configScreen.style.display = 'none';
    managerScreen.style.display = 'none';
    scoreScreen.style.display = 'none';

    if (screenId === 'config') {
        configScreen.style.display = 'block';
        newIdSection.style.display = 'none'; 
    } else if (screenId === 'manager') {
        managerScreen.style.display = 'block';
    } else if (screenId === 'score') {
        scoreScreen.style.display = 'block';
    }
}

function getTournamentConfiguration() {
    const config = {
        matchMode: document.querySelector('input[name="matchType"]:checked').value,
        numPlayers: parseInt(numPlayersInput.value),
        numGroups: parseInt(document.getElementById('numGroups').value),
        gamesPerSet: parseInt(document.getElementById('gamesPerSet').value),
        superTieBreak: parseInt(document.getElementById('superTieBreak').value),
        players: []
    };

    const playerElements = playerInputsContainer.querySelectorAll('.player-input-item');
    playerElements.forEach((div, index) => {
        const nameInput = div.querySelector(`#player-${index + 1}-name`);

        config.players.push({
            id: `p${index + 1}`, 
            name: nameInput.value.trim() || `Participante ${index + 1}`,
        });
    });

    return config;
}

function generatePlayerInputs() {
    const numPlayers = parseInt(numPlayersInput.value);
    playerInputsContainer.innerHTML = '';

    if (numPlayers < 2) {
        playerInputsContainer.innerHTML = '<p style="color:red;">Mínimo 2 participantes.</p>';
        return;
    }

    for (let i = 1; i <= numPlayers; i++) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-input-item';
        playerDiv.innerHTML = `
            <label for="player-${i}-name">Participante ${i}:</label>
            <input type="text" id="player-${i}-name" name="player-${i}-name" placeholder="Nombre/Equipo ${i}" required>
            <label for="player-${i}-photo">Foto (Opcional):</label>
            <input type="file" id="player-${i}-photo" name="player-${i}-photo" accept="image/*">
        `;
        playerInputsContainer.appendChild(playerDiv);
    }
}


// ------------------------------------------------------------------
// --- ACCIONES DE FIREBASE ---
// ------------------------------------------------------------------

async function handleStartGame() {
    const config = getTournamentConfiguration();

    if (config.players.length !== config.numPlayers || config.numPlayers < 2 || config.numGroups < 1) {
        alert("Por favor, verifica el número de participantes y grupos.");
        return;
    }
    
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Creando y Guardando...';

    try {
        const playersWithGroups = assignPlayersToGroups(config.players, config.numGroups);
        const groupMatches = generateGroupMatches(playersWithGroups);

        const playersToSave = playersWithGroups.map(player => ({
            id: player.id,
            name: player.name,
            group: player.group,
            score: { sets: [], games: 0, points: 0 }, 
            photoURL: '' 
        }));

        const tournamentData = {
            matchMode: config.matchMode,
            numPlayers: config.numPlayers,
            numGroups: config.numGroups,
            gamesPerSet: config.gamesPerSet,
            superTieBreak: config.superTieBreak,
            players: playersToSave, 
            matches: groupMatches,
            currentPhase: 'Grupos', 
            status: 'Activo',
            createdAt: new Date(),
        };

        const docRef = await addDoc(collection(db, "tournaments"), tournamentData);
        const tournamentId = docRef.id;

        // 1. Mostrar ID en el manager
        currentTournamentIdDisplay.value = tournamentId;
        tournamentIdInput.value = tournamentId; 
        newIdSection.style.display = 'block';

        // 2. Renderizar y mostrar el marcador inmediatamente
        renderMatches(tournamentId, groupMatches);
        showScreen('score');
        
        alert(`✅ Torneo creado con ID: ${tournamentId}. Partidos generados.`);

    } catch (e) {
        console.error("FIREBASE ERROR:", e);
        alert("❌ Error al guardar. Revisa la consola.");
    } finally {
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Crear y Obtener ID';
    }
}

async function handleOpenTournament() {
    const id = tournamentIdInput.value.trim();
    if (!id) {
        alert("Por favor, introduce un ID de torneo.");
        return;
    }

    try {
        const docRef = doc(db, "tournaments", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Torneo cargado con éxito:", data);

            // 1. Renderizar los partidos cargados desde Firebase
            renderMatches(id, data.matches); 
            
            // 2. Mostrar la pantalla del marcador
            showScreen('score');

            alert(`✅ Torneo ${id} abierto.`);
        } else {
            alert(`❌ Error: No se encontró ningún torneo con el ID: ${id}`);
        }
    } catch (e) {
        console.error("Error al cargar torneo:", e);
        alert("❌ Error al intentar abrir el torneo. Revisa la consola.");
    }
}

async function handleDeleteTournament() {
    const id = tournamentIdInput.value.trim();
    if (!id) {
        alert("Por favor, introduce el ID del torneo que deseas eliminar.");
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres ELIMINAR PERMANENTEMENTE el torneo con ID: ${id}?`)) {
        return;
    }

    try {
        const docRef = doc(db, "tournaments", id);
        await deleteDoc(docRef);

        alert(`🗑️ Torneo con ID ${id} eliminado con éxito.`);
        console.log(`Torneo ${id} eliminado.`);
        
        tournamentIdInput.value = '';
        showScreen('config');

    } catch (e) {
        console.error("Error al eliminar torneo:", e);
        alert("❌ Error al eliminar el torneo. Revisa la consola.");
    }
}

function handleCopyId() {
    const id = currentTournamentIdDisplay.value;
    if (id) {
        navigator.clipboard.writeText(id).then(() => {
            alert("ID copiado al portapapeles: " + id);
        }).catch(err => {
            console.error('Error al copiar: ', err);
            alert("No se pudo copiar el ID. Cópialo manualmente.");
        });
    }
}


// ------------------------------------------------------------------
// --- LISTENERS DE EVENTOS ---
// ------------------------------------------------------------------

// Botones de Vistas
document.getElementById('showManagerBtn').addEventListener('click', () => showScreen('manager'));
document.getElementById('backToConfigBtn').addEventListener('click', () => showScreen('config'));
document.getElementById('backToManagerBtn').addEventListener('click', () => showScreen('manager'));

// Lógica de Configuración y Creación
numPlayersInput.addEventListener('input', generatePlayerInputs);
startGameBtn.addEventListener('click', handleStartGame);

// Lógica de Gestión de Torneos
document.getElementById('copyIdBtn').addEventListener('click', handleCopyId);
document.getElementById('openCreatedTournamentBtn').addEventListener('click', handleOpenTournament); 
document.getElementById('openTournamentBtn').addEventListener('click', handleOpenTournament);
document.getElementById('deleteTournamentBtn').addEventListener('click', handleDeleteTournament);


// Inicializar la configuración de jugadores y mostrar la pantalla inicial
document.addEventListener('DOMContentLoaded', () => {
    generatePlayerInputs();
    showScreen('config');
});
