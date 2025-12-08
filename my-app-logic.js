import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Importaciones de Firestore para guardar datos y generar el ID
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// NOTA: Si usas Storage para fotos, también necesitarás:
// import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Inicializa la base de datos Firestore

// --- Elementos del DOM ---
const numPlayersInput = document.getElementById('numPlayers');
const playerInputsContainer = document.getElementById('playerInputs');
const startGameBtn = document.getElementById('startGameBtn');

// --- Funciones de Lógica de la Configuración ---

/**
 * Genera dinámicamente los campos de entrada para el número de jugadores.
 */
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

/**
 * Recolecta toda la configuración del torneo desde el formulario.
 */
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
        const photoInput = div.querySelector(`#player-${index + 1}-photo`);

        config.players.push({
            id: index + 1,
            name: nameInput.value.trim() || `Participante ${index + 1}`,
            photoFile: photoInput.files[0] // Objeto File, no apto para Firestore
        });
    });

    return config;
}

/**
 * Función principal para iniciar el torneo.
 * Guarda la configuración en Firestore y genera el ID único.
 */
async function handleStartGame() {
    const config = getTournamentConfiguration();

    if (config.players.length !== config.numPlayers || config.numPlayers < 2) {
        alert("Por favor, configura correctamente el número y nombre de los participantes.");
        return;
    }
    
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Guardando Torneo...';

    try {
        // Prepara el objeto de jugadores para guardar en Firestore
        const playersToSave = config.players.map(player => ({
            name: player.name,
            score: { sets: [], games: 0, points: 0 }, // Inicializar marcador
            photoURL: '' // Aquí se guardaría la URL de Storage
        }));

        const tournamentData = {
            matchMode: config.matchMode,
            numPlayers: config.numPlayers,
            numGroups: config.numGroups,
            gamesPerSet: config.gamesPerSet,
            superTieBreak: config.superTieBreak,
            players: playersToSave,
            currentPhase: 'Grupos', 
            status: 'Activo',
            createdAt: new Date()
        };

        // --- GUARDAR EN FIRESTORE Y OBTENER ID ÚNICO ---
        // addDoc genera el ID automáticamente
        const docRef = await addDoc(collection(db, "tournaments"), tournamentData);

        const tournamentId = docRef.id;

        console.log("Torneo guardado en Firestore. ID Único:", tournamentId);
        
        // --- MOSTRAR EL ID AL USUARIO ---
        alert(`✅ ¡Torneo Creado y Guardado! 
        
        Comparte este ID con los otros dispositivos para sincronizar:
        
        ${tournamentId}
        
        Copia este ID (es sensible a mayúsculas y minúsculas).`);

        // NOTA: Implementar aquí la subida de fotos a Storage si es necesario.

    } catch (e) {
        console.error("Error al guardar la configuración del torneo en Firestore: ", e);
        alert("Ocurrió un error al guardar. Revisa la consola para más detalles y tu configuración de Firebase.");
    } finally {
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Iniciar Torneo y Generar ID';
    }
}

// --- Listeners de Eventos ---

// Generar campos de jugadores al cambiar el número
numPlayersInput.addEventListener('input', generatePlayerInputs);

// Iniciar la configuración de jugadores al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    generatePlayerInputs();
});

// Botón para iniciar el torneo
startGameBtn.addEventListener('click', handleStartGame);
