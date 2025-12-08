import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Importar doc y deleteDoc para la gestión de documentos individuales
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
const newIdSection = document.getElementById('newIdSection');
const numPlayersInput = document.getElementById('numPlayers');
const playerInputsContainer = document.getElementById('playerInputs');
const startGameBtn = document.getElementById('startGameBtn');
const tournamentIdInput = document.getElementById('tournamentIdInput');
const currentTournamentIdDisplay = document.getElementById('currentTournamentIdDisplay');

// --- UTILIDADES ---

/**
 * Función Fisher-Yates para barajar (shuffle) un array.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Asigna jugadores a grupos de forma equitativa y cíclica.
 */
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

/**
 * Recolecta toda la configuración del torneo desde el formulario.
 */
function getTournamentConfiguration() {
    // ... (Esta función permanece igual) ...
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
            // Eliminamos la referencia a photoFile ya que no es un objeto JSON válido
        });
    });

    return config;
}

// ------------------------------------------------------------------
// --- MANEJO DE VISTAS ---
// ------------------------------------------------------------------

function showScreen(screenId) {
    configScreen.style.display = 'none';
    managerScreen.style.display = 'none';

    if (screenId === 'config') {
        configScreen.style.display = 'block';
        newIdSection.style.display = 'none'; // Ocultar el ID recién creado
    } else if (screenId === 'manager') {
        managerScreen.style.display = 'block';
    }
}

// ------------------------------------------------------------------
// --- ACCIONES DE TORNEO ---
// ------------------------------------------------------------------

/**
 * Crea un nuevo torneo, lo guarda en Firebase y muestra el ID.
 */
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

        const playersToSave = playersWithGroups.map(player => ({
            id: player.id,
            name: player.name,
            group: player.group,
            score: { sets: [], games: 0, points: 0 }, 
            photoURL: '' 
        }));

        const tournamentData = {
            // ... (Datos del torneo)
            players: playersToSave, 
            currentPhase: 'Grupos', 
            status: 'Activo',
            createdAt: new Date(),
        };

        const docRef = await addDoc(collection(db, "tournaments"), tournamentData);
        const tournamentId = docRef.id;

        // Mostrar el ID y cambiar a la vista de gestión
        currentTournamentIdDisplay.value = tournamentId;
        tournamentIdInput.value = tournamentId; // Precargar el input de Abrir/Eliminar
        newIdSection.style.display = 'block';
        showScreen('manager');
        alert(`¡Torneo Creado! Comparte el ID: ${tournamentId}`);

    } catch (e) {
        console.error("FIREBASE ERROR:", e);
        alert("❌ Error al guardar. Revisa la consola.");
    } finally {
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Crear y Obtener ID';
    }
}

/**
 * Abre un torneo existente. (Simulación: En una app real, redirigirías).
 */
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
            console.log("Torneo cargado con éxito:", docSnap.data());
            alert(`✅ Torneo "${id}" encontrado. (Simulación de apertura del marcador)`);
            
            // Aquí iría la lógica para cargar la interfaz de marcador real.
            // window.location.href = `marcador.html?id=${id}`;
        } else {
            alert(`❌ Error: No se encontró ningún torneo con el ID: ${id}`);
        }
    } catch (e) {
        console.error("Error al cargar torneo:", e);
        alert("❌ Error al intentar abrir el torneo. Revisa la consola.");
    }
}

/**
 * Elimina el torneo con el ID actual o introducido.
 */
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
        
        // Limpiar y volver a la pantalla de configuración
        tournamentIdInput.value = '';
        showScreen('config');

    } catch (e) {
        console.error("Error al eliminar torneo:", e);
        alert("❌ Error al eliminar el torneo. Revisa la consola.");
    }
}

/**
 * Copia el ID del torneo al portapapeles.
 */
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

// Lógica de Configuración y Creación
numPlayersInput.addEventListener('input', generatePlayerInputs);
startGameBtn.addEventListener('click', handleStartGame);

// Lógica de Gestión de Torneos
document.getElementById('copyIdBtn').addEventListener('click', handleCopyId);
document.getElementById('openCreatedTournamentBtn').addEventListener('click', handleOpenTournament); // El botón de Abrir en la sección "Nuevo ID"
document.getElementById('openTournamentBtn').addEventListener('click', handleOpenTournament);
document.getElementById('deleteTournamentBtn').addEventListener('click', handleDeleteTournament);


// Inicializar la configuración de jugadores y mostrar la pantalla inicial
document.addEventListener('DOMContentLoaded', () => {
    generatePlayerInputs();
    showScreen('config');
});
