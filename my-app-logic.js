// Este archivo se carga DESPUÉS de la inicialización de Firebase
// por lo que tiene acceso a las variables globales 'db' y 'firebase'.

// ==========================================================
// 1. FUNCIÓN PARA GUARDAR DATOS (CREATE)
// ==========================================================

function saveParticipant(name, score) {
    // Retorna la promesa para que el manejador del formulario pueda usar .then()
    return db.collection("scores").add({
        name: name,
        score: score,
        // Usa el objeto global 'firebase' para acceder a FieldValue
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("Score saved successfully!");
        // No necesitamos actualizar el display aquí; getScores lo hace automáticamente
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
        throw error; // Propaga el error para que el formulario lo maneje
    });
}


// ==========================================================
// 2. FUNCIÓN PARA LEER Y MOSTRAR DATOS EN TIEMPO REAL (READ)
// ==========================================================

function getScores() {
    // Obtiene una referencia al elemento HTML donde se mostrarán los scores
    const container = document.getElementById('playoffs');
    if (!container) return; // Salir si el contenedor no existe

    container.innerHTML = "<h3>Cargando resultados...</h3>"; 

    // Query la colección 'scores'. Ordena por timestamp para mostrar los más recientes.
    // onSnapshot mantiene una conexión abierta para actualizaciones en tiempo real.
    db.collection("scores").orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
            // Limpia el contenedor antes de añadir la nueva lista
            container.innerHTML = ""; 

            if (snapshot.empty) {
                container.innerHTML = "<p>No hay resultados de playoffs registrados aún.</p>";
                return;
            }

            let htmlList = '<ul class="score-list">'; 

            // Itera sobre cada documento (score)
            snapshot.forEach((doc) => {
                const data = doc.data();
                
                const playerName = data.name;
                const scoreValue = data.score;
                
                let dateString = "Fecha desconocida";
                if (data.timestamp) {
                    const date = data.timestamp.toDate(); // Convierte Timestamp a Date
                    dateString = date.toLocaleDateString('es-ES', { 
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                }

                htmlList += `
                    <li>
                        <strong>${playerName}</strong>: ${scoreValue} puntos 
                        <span style="font-size: 0.8em; color: gray;">(${dateString})</span>
                    </li>
                `;
            });

            htmlList += '</ul>';
            container.innerHTML = htmlList;
        }, (error) => {
            console.error("Error getting documents: ", error);
            container.innerHTML = `<p style="color:red;">Error al cargar datos: ${error.message}</p>`;
        });
}


// ==========================================================
// 3. MANEJADOR DEL FORMULARIO DE REGISTRO
// ==========================================================

// Asegura que el código se ejecute una vez que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', (event) => {
    // Inicia la lectura de datos tan pronto como el DOM esté listo
    getScores(); 
    
    const scoreForm = document.getElementById('score-form');
    const messageArea = document.getElementById('message-area');

    if (scoreForm) {
        scoreForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Evita el envío tradicional del formulario

            const nameInput = document.getElementById('player-name');
            const scoreInput = document.getElementById('player-score');
            
            const name = nameInput.value.trim();
            const score = parseInt(scoreInput.value, 10); // Convierte el input a número

            if (name && !isNaN(score)) {
                messageArea.textContent = "Guardando...";
                
                // Llama a la función de guardar y maneja la promesa
                saveParticipant(name, score)
                    .then(() => {
                        // Éxito
                        messageArea.textContent = "¡Resultado guardado con éxito!";
                        nameInput.value = '';  // Limpia los inputs
                        scoreInput.value = ''; 
                    })
                    .catch(() => {
                        // Error (la función saveParticipant ya hizo console.error)
                        messageArea.textContent = "Error al guardar. Revisa la consola para más detalles.";
                    });

            } else {
                messageArea.textContent = "Por favor, ingresa un nombre y una puntuación válida.";
            }
        });
    }
});
