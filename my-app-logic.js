import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);

// --- Elementos del DOM ---
const numPlayersInput = document.getElementById('numPlayers');
const playerInputsContainer = document.getElementById('playerInputs');
const startGameBtn = document.getElementById('startGameBtn');

// --- Funciones de Lógica de la Configuración ---

/**
 * Genera dinámicamente los campos de entrada para el número de jugadores especificado.
 * Incluye nombre y campo para subir foto (opcional).
 */
function generatePlayerInputs() {
    const numPlayers = parseInt(numPlayersInput.value);
    playerInputsContainer.innerHTML = ''; // Limpiar entradas anteriores

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
        matchMode: document.querySelector('input[name="matchType"]:checked').value, // 'single' o 'double'
        numPlayers: parseInt(numPlayersInput.value),
        numGroups: parseInt(document.getElementById('numGroups').value),
        gamesPerSet: parseInt(document.getElementById('gamesPerSet').value),
        superTieBreak: parseInt(document.getElementById('superTieBreak').value),
        // Los jugadores se recolectan en un paso separado
        players: []
    };

    // Recolectar la información de los jugadores
    const playerElements = playerInputsContainer.querySelectorAll('.player-input-item');
    playerElements.forEach((div, index) => {
        const nameInput = div.querySelector(`#player-${index + 1}-name`);
        const photoInput = div.querySelector(`#player-${index + 1}-photo`);

        config.players.push({
            id: index + 1,
            name: nameInput.value.trim() || `Participante ${index + 1}`,
            // NOTA: Para el manejo de fotos, deberás implementar la lógica
            // para subir el archivo a Firebase Storage y guardar la URL aquí.
            photoFile: photoInput.files[0] // Almacena el objeto File (temporal)
        });
    });

    return config;
}

/**
 * Función principal para iniciar el torneo.
 */
function handleStartGame() {
    const config = getTournamentConfiguration();

    if (config.players.length !== config.numPlayers || config.numPlayers < 2) {
        alert("Por favor, configura correctamente el número y nombre de los participantes.");
        return;
    }

    console.log("--- Configuración Final del Torneo ---");
    console.log("Modo de Juego:", config.matchMode);
    console.log("Número de Participantes:", config.numPlayers);
    console.log("Número de Grupos:", config.numGroups);
    console.log("Juegos por Set:", config.gamesPerSet);
    console.log("Puntos para Super Tie-Break:", config.superTieBreak);
    console.log("Participantes:", config.players);
    console.log("---------------------------------------");

    // TODO: Aquí deberías agregar la lógica para:
    // 1. **Subir las fotos** de los jugadores a Firebase Storage.
    // 2. **Guardar la configuración** y los datos iniciales del torneo en Firestore.
    // 3. **Generar los partidos** de la fase de grupos y la fase final (semifinales/final/3er puesto).
    // 4. **Redirigir** al usuario a la interfaz del marcador.

    alert("Configuración lista. ¡Implementa la lógica de Firebase Storage y Firestore para continuar!");
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

// Mensaje de estado de Firebase
console.log("Firebase inicializado con Project ID:", firebaseConfig.projectId);
