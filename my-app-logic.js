// This file is loaded after the Firebase initialization,
// so it has access to the global 'db' variable.

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
