let participantes = [];
let partidos = [];
let grupos = { A: [], B: [] };

// --- 1. GESTIÓN DE PARTICIPANTES ---

function cargarDatos() {
    const p = localStorage.getItem('participantes');
    const pa = localStorage.getItem('partidos');
    const g = localStorage.getItem('grupos');
    
    if (p) participantes = JSON.parse(p);
    if (pa) partidos = JSON.parse(pa);
    if (g) grupos = JSON.parse(g);

    actualizarIU();
    if (participantes.length === 18 && grupos.A.length === 9) {
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        generarPartidosHTML();
        actualizarRankingYFinales();
    }
}

function guardarDatos() {
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
}

function actualizarIU() {
    const lista = document.getElementById('lista-participantes');
    lista.innerHTML = '';
    participantes.forEach(nombre => {
        const li = document.createElement('li');
        li.textContent = nombre;
        lista.appendChild(li);
    });

    document.getElementById('contador-participantes').textContent = participantes.length;
    const btnIniciar = document.getElementById('btn-iniciar');
    if (participantes.length === 18) {
        btnIniciar.disabled = false;
        btnIniciar.textContent = '¡Iniciar Torneo!';
    } else {
        btnIniciar.disabled = true;
        btnIniciar.textContent = `Iniciar Torneo (Necesita ${18 - participantes.length} más)`;
    }
}

function agregarParticipante() {
    const input = document.getElementById('nombre-input');
    const nombre = input.value.trim();

    if (nombre && participantes.length < 18 && !participantes.includes(nombre)) {
        participantes.push(nombre);
        input.value = '';
        guardarDatos();
        actualizarIU();
    } else if (participantes.length >= 18) {
        alert("Ya se han añadido 18 participantes.");
    }
}

// --- 2. GENERACIÓN DE GRUPOS Y FIXTURE ---

function generarFixture(grupo) {
    const n = 9;
    const fixture = [];
    const jugadores = [...grupo];

    // Algoritmo de Rotación para número impar (9 jugadores)
    for (let r = 0; r < n; r++) {
        for (let i = 0; i < (n - 1) / 2; i++) {
            const j1 = jugadores[i];
            const j2 = jugadores[n - 2 - i];
            
            // Añadir solo si el partido no existe ya (para evitar duplicados en el ciclo)
            if (!fixture.find(p => (p.j1 === j1 && p.j2 === j2) || (p.j1 === j2 && p.j2 === j1))) {
                 fixture.push({ j1: j1, j2: j2, grupo: grupo === grupos.A ? 'A' : 'B' });
            }
        }
        // Rotar los jugadores, dejando el último (jugador 9) quieto y rotando el resto
        const ultimo = jugadores.pop();
        jugadores.splice(1, 0, ultimo);
    }

    return fixture;
}

function iniciarTorneo() {
    if (participantes.length !== 18) {
        alert("El torneo requiere exactamente 18 jugadores.");
        return;
    }

    // Mezclar y dividir en 2 grupos
    const mezclados = participantes.sort(() => Math.random() - 0.5);
    grupos.A = mezclados.slice(0, 9);
    grupos.B = mezclados.slice(9, 18);

    // Generar el fixture completo
    partidos = generarFixture(grupos.A).concat(generarFixture(grupos.B));
    partidos.forEach(p => {
        p.gamesJ1 = null;
        p.gamesJ2 = null;
    });

    guardarDatos();
    document.getElementById('registro').style.display = 'none';
    document.getElementById('grupos-fixture').style.display = 'block';
    document.getElementById('ranking-finales').style.display = 'block';
    
    // Mostrar grupos en el HTML
    document.getElementById('grupo-a-list').innerHTML = grupos.A.map(j => `<li>${j}</li>`).join('');
    document.getElementById('grupo-b-list').innerHTML = grupos.B.map(j => `<li>${j}</li>`).join('');
    
    generarPartidosHTML();
    actualizarRankingYFinales();
}

function generarPartidosHTML() {
    const contenedor = document.getElementById('partidos-registro');
    contenedor.innerHTML = '<h4>Registre los resultados (Ej: 8-6, 8-7, 10-8, etc.)</h4>';

    partidos.forEach((p, index) => {
        const div = document.createElement('div');
        div.classList.add('partido-item');
        
        const gamesJ1 = p.gamesJ1 !== null ? p.gamesJ1 : '';
        const gamesJ2 = p.gamesJ2 !== null ? p.gamesJ2 : '';

        div.innerHTML = `
            <p><strong>GRUPO ${p.grupo}:</strong> ${p.j1} vs ${p.j2}</p>
            <input type="number" id="g1-${index}" value="${gamesJ1}" min="0" placeholder="${p.j1}">
            -
            <input type="number" id="g2-${index}" value="${gamesJ2}" min="0" placeholder="${p.j2}">
            <button onclick="registrarResultado(${index})">Guardar</button>
        `;
        contenedor.appendChild(div);
    });
}

function registrarResultado(index) {
    const g1 = parseInt(document.getElementById(`g1-${index}`).value);
    const g2 = parseInt(document.getElementById(`g2-${index}`).value);

    // Validación básica: deben haber ganado al menos 8 games
    if (isNaN(g1) || isNaN(g2) || (g1 < 8 && g2 < 8)) {
        alert("Resultado inválido. El ganador debe tener al menos 8 games (Ej: 8-6, 8-7).");
        return;
    }

    partidos[index].gamesJ1 = g1;
    partidos[index].gamesJ2 = g2;
    
    guardarDatos();
    actualizarRankingYFinales();
    alert(`Resultado guardado: ${partidos[index].j1} ${g1} - ${g2} ${partidos[index].j2}`);
}

// --- 3. CÁLCULO DE RANKING ---

function calcularRanking(grupo) {
    const jugadores = grupo;
    const rankingData = jugadores.map(j => ({
        nombre: j,
        puntos: 0,
        victorias: 0,
        gamesFavor: 0,
        gamesContra: 0,
        juegosDirectos: [] // Para head-to-head
    }));

    partidos.filter(p => p.grupo === (grupo === grupos.A ? 'A' : 'B') && p.gamesJ1 !== null).forEach(p => {
        const r1 = rankingData.find(r => r.nombre === p.j1);
        const r2 = rankingData.find(r => r.nombre === p.j2);

        // Games
        r1.gamesFavor += p.gamesJ1;
        r1.gamesContra += p.gamesJ2;
        r2.gamesFavor += p.gamesJ2;
        r2.gamesContra += p.gamesJ1;

        // Puntos por Games (10 puntos/game)
        r1.puntos += p.gamesJ1 * 10;
        r2.puntos += p.gamesJ2 * 10;

        // Puntos por Victoria (100 puntos)
        if (p.gamesJ1 > p.gamesJ2) {
            r1.puntos += 100;
            r1.victorias += 1;
            r1.juegosDirectos.push({ oponente: p.j2, resultado: 'ganó' });
            r2.juegosDirectos.push({ oponente: p.j1, resultado: 'perdió' });
        } else if (p.gamesJ2 > p.gamesJ1) {
            r2.puntos += 100;
            r2.victorias += 1;
            r2.juegosDirectos.push({ oponente: p.j1, resultado: 'ganó' });
            r1.juegosDirectos.push({ oponente: p.j2, resultado: 'perdió' });
        }
    });

    // Criterios de ordenación:
    rankingData.sort((a, b) => {
        // 1. Puntos Totales
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;

        // Desempate (solo se puede aplicar si la lógica Head-to-Head fuera más compleja)
        // 2. Diferencia de Games
        const diffA = a.gamesFavor - a.gamesContra;
        const diffB = b.gamesFavor - b.gamesContra;
        if (diffB !== diffA) return diffB - diffA;

        // 3. Games a Favor (Mayor cantidad de games ganados)
        return b.gamesFavor - a.gamesFavor;
    });

    return rankingData;
}

function mostrarRanking(ranking, tablaId) {
    const tabla = document.getElementById(tablaId);
    tabla.innerHTML = `
        <tr>
            <th>Pos.</th>
            <th>Jugador</th>
            <th>Puntos</th>
            <th>Victorias</th>
            <th>G-Favor</th>
            <th>G-Contra</th>
            <th>Dif.</th>
        </tr>
    `;

    ranking.forEach((r, index) => {
        const row = tabla.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${r.nombre}</td>
            <td>${r.puntos}</td>
            <td>${r.victorias}</td>
            <td>${r.gamesFavor}</td>
            <td>${r.gamesContra}</td>
            <td>${r.gamesFavor - r.gamesContra}</td>
        `;
        if (index < 2) row.style.backgroundColor = '#d4edda'; // Clasificados
    });
}

// --- 4. FASES FINALES ---

function actualizarRankingYFinales() {
    const rankingA = calcularRanking(grupos.A);
    const rankingB = calcularRanking(grupos.B);

    mostrarRanking(rankingA, 'ranking-a');
    mostrarRanking(rankingB, 'ranking-b');
    
    // Generar Playoffs (requiere que la tabla tenga al menos 2 jugadores con datos)
    if (rankingA.length >= 2 && rankingB.length >= 2) {
        generarPlayoffs(rankingA, rankingB);
    }
}

function generarPlayoffs(rA, rB) {
    const a1 = rA[0].nombre;
    const a2 = rA[1].nombre;
    const b1 = rB[0].nombre;
    const b2 = rB[1].nombre;

    const divPlayoffs = document.getElementById('playoffs');
    divPlayoffs.innerHTML = `
        <h4>Semifinales:</h4>
        <p>SF1: <strong>${a1}</strong> vs <strong>${b2}</strong></p>
        <p>SF2: <strong>${b1}</strong> vs <strong>${a2}</strong></p>
        
        <h4>Finales:</h4>
        <p>Pendiente de resultados de Semifinales...</p>
        
        <p>Para simplificar, registre manualmente el resultado de las Semifinales para definir los 4 finalistas.</p>
    `;
    // Nota: La gestión completa de la fase final con registro de resultados es compleja.
    // Esta versión muestra los cruces y deja al organizador registrar la Final y el 3er/4to puesto.
}

// Cargar datos al cargar la página
window.onload = cargarDatos;
