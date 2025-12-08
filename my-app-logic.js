import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

/**
 * Dibuja la lista de partidos en la interfaz y añade los Listeners.
 */
function renderMatches(tournamentId, matches) {
    activeTournamentIdDisplay.textContent = tournamentId;
    
    let htmlContent = '';
    
    if (matches && matches.length > 0) {
        matches.forEach(match => {
            const scoreData = JSON.stringify(match.score);
            
            htmlContent += `
                <div class="match-card">
                    <h4>GRUPO ${match.group}</h4>
                    <p><strong>${match.player1.name}</strong> vs <strong>${match.player2.name}</strong></p>
                    <p>Estado: ${match.status} | Marcador: ${match.score.set1[0]}-${match.score.set1[1]}, ${match.score.set2[0]}-${match.score.set2[1]}</p>
                    
                    <button class="primary-btn update-score-btn" 
                            data-match-id="${match.id}" 
                            data-p1-name="${match.player1.name}" 
                            data-p2-name="${match.player2.name}"
                            data-score='${scoreData}'
                            style="padding: 5px; width: auto; margin-top: 5px;">
                        Actualizar Marcador
                    </button>
                    
                    <div id="scoreUpdateForm-${match.id}" class="score-form-container" style="display:none; margin-top: 15px;">
                        </div>

                    <hr style="margin-top: 10px; border-color: #eee;">
                </div>
            `;
        });
    } else {
        htmlContent = '<p style="text-align: center; color: red;">No se pudieron generar partidos. Verifique la configuración de participantes y grupos.</p>';
    }

    matchesContainer.innerHTML = htmlContent;

    // CLAVE: Reasignar el listener después de actualizar el DOM.
    document.querySelectorAll('.update-score-btn').forEach(button => {
        button.addEventListener('click', toggleScoreForm);
    });
}

/**
 * Genera el HTML para el formulario de sets, usando los valores actuales del partido.
 */
function createScoreFormHTML(matchId, p1Name, p2Name, currentScore) {
    return `
        <h4>Actualizar Sets</h4>
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <div style="flex: 1;">
                <label for="set1-p1-${matchId}">${p1Name} (Set 1)</label>
                <input type="number" id="set1-p1-${matchId}" min="0" value="${currentScore.set1[0]}">
            </div>
            <div style="flex: 1;">
                <label for="set1-p2-${matchId}">${p2Name} (Set 1)</label>
                <input type="number" id="set1-p2-${matchId}" min="0" value="${currentScore.set1[1]}">
            </div>
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <div style="flex: 1;">
                <label for="set2-p1-${matchId}">${p1Name} (Set 2)</label>
                <input type="number" id="set2-p1-${matchId}" min="0" value="${currentScore.set2[0]}">
            </div>
            <div style="flex: 1;">
                <label for="set2-p2-${matchId}">${p2Name} (Set 2)</label>
                <input type="number" id="set2-p2-${matchId}" min="0" value="${currentScore.set2[1]}">
            </div>
        </div>
        
        <button class="primary-btn save-score-btn" data-match-id="${matchId}">Guardar Puntuación</button>
    `;
}

/**
 * Muestra u oculta el formulario de puntuación para un partido específico.
 */
function toggleScoreForm(event) {
    const button = event.currentTarget;
    const matchId = button.dataset.matchId;
    const p1Name = button.dataset.p1Name;
    const p2Name = button.dataset.p2Name;
    const scoreData = JSON.parse(button.dataset.score); 
    const formContainer = document.getElementById(`scoreUpdateForm-${matchId}`);

    if (formContainer.style.display === 'none') {
        // Mostrar formulario
        formContainer.innerHTML = createScoreFormHTML(matchId, p1Name, p2Name, scoreData); 
        formContainer.style.display = 'block';

        // Añadir listener al nuevo botón "Guardar Puntuación"
        formContainer.querySelector('.save-score-btn').addEventListener('click', handleScoreUpdate);
    } else {
        // Ocultar formulario
        formContainer.style.display = 'none';
        formContainer.innerHTML = '';
    }
}

/**
 * Guarda la puntuación del partido en Firebase Firestore.
 */
async function handleScoreUpdate(event) {
    const button = event.currentTarget;
    const matchId = button.dataset.matchId;
    const currentTournamentId = activeTournamentIdDisplay.textContent;

    // 1. Leer los datos del formulario
    const s1p1 = parseInt(document.getElementById(`set1-p1-${matchId}`).value);
    const s1p2 = parseInt(document.getElementById(`set1-p2-${matchId}`).value);
    const s2p1 = parseInt(document.getElementById(`set2-p1-${matchId}`).value);
    const s2p2 = parseInt(document.getElementById(`set2-p2-${matchId}`).value);

    if (isNaN(s1p1) || isNaN(s1p2) || isNaN(s2p1) || isNaN(s2p2)) {
        alert("Por favor, introduce números válidos para todos los sets.");
        return;
    }

    button.disabled = true;
    button.textContent = 'Guardando...';

    try {
        // 2. Obtener la data actual del torneo
        const docRef = doc(db, "tournaments", currentTournamentId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Error: Torneo no encontrado en la base de datos.");
            return;
        }

        const tournamentData = docSnap.data();
        let matches = tournamentData.matches;
        let matchIndex = matches.findIndex(m => m.id === matchId);

        if (matchIndex === -1) {
            alert("Error: Partido no encontrado.");
            return;
        }

        // 3. Actualizar el objeto Match
        matches[matchIndex].score.set1 = [s1p1, s1p2];
        matches[matchIndex].score.set2 = [s2p1, s2p2];
        
        // Lógica de estado simplificada
        if (s1p1 > 0 || s1p2 > 0 || s2p1 > 0 || s2p2 > 0) {
            matches[matchIndex].status = 'in progress';
        } else {
            matches[matchIndex].status = 'pending';
        }
        
        // 4. Actualizar el documento en Firebase
        await updateDoc(docRef, {
            matches: matches 
        });
        
        alert(`✅ Puntuación del partido ${matchId} actualizada correctamente.`);
        
        // 5. Re-renderizar para mostrar el nuevo marcador
        renderMatches(currentTournamentId, matches);

    } catch (e) {
        console.error("Error al actualizar la puntuación:", e);
        alert("❌ Error al guardar el marcador. Revisa las reglas de seguridad de Firestore.");
    } finally {
        // Ocultar el formulario después de guardar
        document.getElementById(`scoreUpdateForm-${matchId}`).style.display = 'none';
    }
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
    const matchMode = document.querySelector('input[name="matchType"]:checked').value; 
    
    const config = {
        matchMode: matchMode, 
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

/**
 * Genera los inputs de jugador/equipo, ajustando el label según el modo de juego.
 */
function generatePlayerInputs() {
    // CLAVE: Leer el valor del radio button seleccionado
    const matchMode = document.querySelector('input[name="matchType"]:checked').value;
    const numPlayers = parseInt(numPlayersInput.value);
    playerInputsContainer.innerHTML = '';
    
    // Cambiar la etiqueta si es Dobles
    const labelText = matchMode === 'double' ? 'Equipo' : 'Participante'; 

    if (numPlayers < 2) {
        playerInputsContainer.innerHTML = '<p style="color:red;">Mínimo 2 participantes/equipos.</p>';
        return;
    }

    for (let i = 1; i <= numPlayers; i++) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-input-item';
        playerDiv.innerHTML = `
            <label for="player-${i}-name">${labelText} ${i}:</label>
            <input type="text" id="player-${i}-name" name="player-${i}-name" placeholder="${labelText} ${i}" required>
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

        currentTournamentIdDisplay.value = tournamentId;
        tournamentIdInput.value = tournamentId; 
        newIdSection.style.display = 'block';

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

            renderMatches(id, data.matches); 
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

// CLAVE: Este listener regenera los inputs cuando se cambia entre 'single' y 'double'.
document.querySelectorAll('input[name="matchType"]').forEach(input => {
    input.addEventListener('change', generatePlayerInputs);
});

// Listener para cambiar el número de inputs
numPlayersInput.addEventListener('input', generatePlayerInputs);

// Listeners de navegación y gestión
document.getElementById('showManagerBtn').addEventListener('click', () => showScreen('manager'));
document.getElementById('backToConfigBtn').addEventListener('click', () => showScreen('config'));
document.getElementById('backToManagerBtn').addEventListener('click', () => showScreen('manager'));

// Listeners de acciones principales
startGameBtn.addEventListener('click', handleStartGame);
document.getElementById('copyIdBtn').addEventListener('click', handleCopyId);
document.getElementById('openCreatedTournamentBtn').addEventListener('click', handleOpenTournament); 
document.getElementById('openTournamentBtn').addEventListener('click', handleOpenTournament);
document.getElementById('deleteTournamentBtn').addEventListener('click', handleDeleteTournament);


// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    generatePlayerInputs(); // Genera los inputs iniciales (por defecto, Individual)
    showScreen('config');
});
