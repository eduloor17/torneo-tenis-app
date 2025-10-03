// This file is loaded after the Firebase initialization,
// so it has access to the global 'db' variable.
// --- Function to READ and DISPLAY the data (Add this to your file) ---

function getScores() {
    // 1. Get a reference to the HTML element where we want to display the scores.
    const container = document.getElementById('playoffs');
    container.innerHTML = "<h3>Cargando resultados...</h3>"; // Initial loading message

    // 2. Query the 'scores' collection. Order by timestamp to show latest scores at the top.
    db.collection("scores").orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
            // 3. Clear the container before adding the new list
            container.innerHTML = ""; 

            // 4. Check if there are any documents (scores)
            if (snapshot.empty) {
                container.innerHTML = "<p>No hay resultados de playoffs registrados aún.</p>";
                return;
            }

            // 5. Create a list to hold the scores
            let htmlList = '<ul class="score-list">'; // Added a class for styling

            // 6. Loop through each document (score) in the result set
            snapshot.forEach((doc) => {
                const data = doc.data();
                
                // Format the score data for display
                const playerName = data.name;
                const scoreValue = data.score;
                
                // Optional: Format the timestamp 
                let dateString = "Fecha desconocida";
                if (data.timestamp) {
                    const date = data.timestamp.toDate(); // Convert Firestore Timestamp object to JS Date
                    dateString = date.toLocaleDateString('es-ES', { 
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                }

                // Append a new list item for this score
                htmlList += `
                    <li>
                        <strong>${playerName}</strong>: ${scoreValue} puntos 
                        <span style="font-size: 0.8em; color: gray;">(${dateString})</span>
                    </li>
                `;
            });

            // 7. Close the list and add it to the page
            htmlList += '</ul>';
            container.innerHTML = htmlList;
        }, (error) => {
            console.error("Error getting documents: ", error);
            container.innerHTML = `<p style="color:red;">Error al cargar datos: ${error.message}</p>`;
        });
}

// --- CALL THE FUNCTION TO START DISPLAYING DATA ---
getScores();

function saveParticipant(name, score) {
    db.collection("scores").add({
        name: name,
        score: score,
        // CORRECTED: Use the 'firebase' global object to access FieldValue
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("Score saved successfully!");
        // You would typically update the UI here to show success
    })
    .catch((error) => {
        console.error("Error writing document: ", error);
    });
}

// Example usage to test (optional)
// saveParticipant("Player A", 100);
