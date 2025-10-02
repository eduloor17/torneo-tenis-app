let participantes = [];
let partidos = [];
let grupos = { A: [], B: [] };
let MAX_JUGADORES = 18; // Valor inicial

// --- 1. CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES ---

function cargarDatos() {
    const max = localStorage.getItem('maxJugadores');
    if (max) MAX_JUGADORES = parseInt(max);

    const p = localStorage.getItem('participantes');
    const pa = localStorage.getItem('partidos');
    const g = localStorage.getItem('grupos');
    
    if (p) participantes = JSON.parse(p);
    if (pa) partidos = JSON.parse(pa);
    if (g) grupos = JSON.parse(g);

    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    actualizarIU();
    if (participantes.length === MAX_JUGADORES && grupos.A.length > 0) {
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        generarGruposHTML();
        generarPartidosHTML();
        actualizarRankingYFinales();
    }
}

function guardarDatos() {
    localStorage.setItem('maxJugadores', MAX_JUGADORES);
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
}

function configurarMaxJugadores() {
    const input = document.getElementById('max-jugadores-input');
    const nuevoMax = parseInt(input.value);

    if (nuevoMax < 2 || nuevoMax % 2 !== 0) {
        alert("El número de jugadores debe ser par (2, 4, 6, 8...).");
        return;
    }
    
    if (participantes.length > nuevoMax) {
        alert(`Ya hay ${participantes.length} jugadores. El nuevo máximo debe ser mayor o igual.`);
        input.value = MAX_JUGADORES; // Revierte el valor en el input
        return;
    }

    MAX_JUGADORES = nuevoMax;
    // Limpia datos si el torneo ya había iniciado pero se cambia el max
    partidos = [];
    grupos = { A: [], B: [] };
    
    guardarDatos();
    actualizarIU();
    alert(`Torneo configurado para ${MAX_JUGADORES} jugadores.`);
}

function actualizarIU() {
    const lista = document.getElementById('lista-participantes');
    lista.innerHTML = '';
    participantes.forEach(nombre => {
        const li = document.createElement('li');
        li.textContent = nombre;
        lista.appendChild(li);
    });

    document.getElementById('max-jugadores-actual').textContent = MAX_JUGADORES;
    document.getElementById('max-participantes-display').textContent = MAX_JUGADORES;
    document.getElementById('contador-participantes').textContent = participantes.length;
    
    const btnIniciar = document.getElementById('btn-iniciar');
    if (participantes.length === MAX_JUGADORES && MAX_JUGADORES > 0) {
        btnIniciar.disabled = false;
        btnIniciar.textContent = '¡Iniciar Torneo!';
    } else {
        btnIniciar.disabled = true;
        btnIniciar.textContent = `Iniciar Torneo (Necesita ${MAX_JUGADORES - participantes.length} más)`;
    }
}

function agregarParticipante() {
    const input = document.getElementById('nombre-input');
    const nombre = input.value.trim();

    if (nombre && participantes.length < MAX_JUGADORES && !participantes.includes(nombre)) {
        participantes.push(nombre);
        input.value = '';
        guardarDatos();
        actualizarIU();
    } else if (participantes.length >= MAX_JUGADORES) {
        alert(`Ya se han añadido el máximo de ${MAX_JUGADORES} participantes.`);
    }
}

// --- 2. GENERACIÓN DE GRUPOS Y FIXTURE ---

function generarFixture(grupo) {
    const n = grupo.length;
    if (n === 0) return [];
    
    // Si el número de jugadores es par, se usa el algoritmo de círculo (N-1 rondas)
    // Si el número de jugadores es impar, se usa el algoritmo de descanso (N rondas)
    const isImpar = n % 2 !== 0;
    const fixture = [];
    let jugadores = [...grupo];

    if (!isImpar) {
        // Añadir jugador "fantasma" para que el algoritmo funcione
        jugadores.push('BYE');
    }
    const totalRondas = isImpar ? n : n - 1;
    const numJugadoresRotacion = jugadores.length;
    
    for (let r = 0; r < totalRondas; r++) {
        for (let i = 0; i < numJugadoresRotacion / 2; i++) {
            const j1 = jugadores[i];
            const j2 = jugadores[numJugadoresRotacion - 1 - i];

            // Solo registramos partidos si no involucra al "BYE"
            if (j1 !== 'BYE' && j2 !== 'BYE') {
                // Verificar que el partido no se haya generado ya (para asegurar)
                if (!fixture.find(p => (p.j1 === j1 && p.j2 === j2) || (p.j1 === j2 && p.j2 === j1))) {
                    fixture.push({ j1: j1, j2: j2, grupo: grupo === grupos.A ? 'A' : 'B' });
                }
            }
        }
        
        // Rotar (dejar el primer elemento fijo si es par, o el último si es impar y se añadió BYE)
        if (!isImpar) { // Caso Par (rotar todo menos el primero)
            const ultimo = jugadores.pop();
            jugadores.splice(1, 0, ultimo);
        } else { // Caso Impar (rotar todo excepto el jugador que descansa en cada ronda, si no se usa BYE)
            const ultimo = jugadores.pop();
            jugadores.unshift(ultimo);
        }
    }
    return fixture;
}

function generarGruposHTML() {
    const contenedor = document.getElementById('grupos-container');
    contenedor.innerHTML = '';
    
    // Generar HTML dinámicamente para los grupos
    for (const grupoKey in grupos) {
        const grupo = grupos[grupoKey];
        if (grupo.length > 0) {
            const div = document.createElement('div');
            div.innerHTML = `
                <h3>Grupo ${grupoKey}</h3>
                <div id="grupo-${grupoKey.toLowerCase()}-list" class="grupo-box">
                    <ul>
                        ${grupo.map(j => `<li>${j}</li>`).join('')}
                    </ul>
                </div>
            `;
            contenedor.appendChild(div);
        }
    }
}

function iniciarTorneo() {
    if (participantes.length !== MAX_JUGADORES) {
        alert(`El torneo requiere exactamente ${MAX_JUGADORES} jugadores.`);
        return;
    }

    // Mezclar y dividir en 2 grupos iguales
    const mezclados = participantes.sort(() => Math.random() - 0.5);
    const mitad = MAX_JUGADORES / 2;
    grupos.A = mezclados.slice(0, mitad);
    grupos.B = mezclados.slice(mitad, MAX_JUGADORES);

    // Generar el fixture completo
    partidos = generarFixture(grupos.A).concat(generarFixture(grupos.B));
    partidos.forEach(p => {
        p.gamesJ1 = null;
        p.gamesJ2 = null;
    });

    guardarDatos();
    document.getElementById('registro').style.display = 'none';
    document.getElementById('configuracion').style.display = 'none';
    document.getElementById('grupos-fixture').style.display = 'block';
    document.getElementById('ranking-finales').style.display = 'block';
    
    generarGruposHTML();
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

    // Validación según la regla: el ganador debe tener al menos 8 games
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
        gamesContra: 0
    }));

    partidos.filter(p => p.grupo === (grupo === grupos.A ? 'A' : 'B') && p.gamesJ1 !== null).forEach(p => {
        const r1 = rankingData.find(r => r.nombre === p.j1);
        const r2 = rankingData.find(r => r.nombre === p.j2);

        // Games y Puntos por Games (10 puntos/game)
        r1.gamesFavor += p.gamesJ1;
        r1.gamesContra += p.gamesJ2;
        r2.gamesFavor += p.gamesJ2;
        r2.gamesContra += p.gamesJ1;
        r1.puntos += p.gamesJ1 * 10;
        r2.puntos += p.gamesJ2 * 10;

        // Puntos por Victoria (100 puntos)
        if (p.gamesJ1 > p.gamesJ2) {
            r1.puntos += 100;
            r1.victorias += 1;
        } else if (p.gamesJ2 > p.gamesJ1) {
            r2.puntos += 100;
            r2.victorias += 1;
        }
    });

    // Criterios de ordenación:
    rankingData.sort((a, b) => {
        // 1. Puntos Totales
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;

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
    if (!tabla) return;
    
    tabla.innerHTML = `
        <tr>
            <th>Pos.</th>
            <th>Jugador</th>
            <th>Puntos</th>
            <th>Vics</th>
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

    const rankingsContainer = document.getElementById('rankings-container');
    rankingsContainer.innerHTML = `
        <div>
            <h3>Ranking Grupo A</h3>
            <table id="ranking-a" class="ranking-table"></table>
        </div>
        <div>
            <h3>Ranking Grupo B</h3>
            <table id="ranking-b" class="ranking-table"></table>
        </div>
    `;

    mostrarRanking(rankingA, 'ranking-a');
    mostrarRanking(rankingB, 'ranking-b');
    
    // Generar Playoffs solo si los grupos tienen jugadores
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
        <p>SF1: **${a1}** vs **${b2}**</p>
        <p>SF2: **${b1}** vs **${a2}**</p>
        
        <p>Para simplificar la gestión en la web, el organizador debe registrar manualmente los resultados de estas Semifinales para definir el 1er, 2do, 3ro y 4to puesto.</p>
        
        <h4>Cruces Finales:</h4>
        <p>3er Lugar: Perdedor SF1 vs Perdedor SF2</p>
        <p>Final (1er Lugar): Ganador SF1 vs Ganador SF2</p>
    `;
}

// Cargar datos al cargar la página
window.onload = cargarDatos;
