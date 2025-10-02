let participantes = [];
let partidos = []; // Partidos de Fase de Grupos
let grupos = { A: [], B: [] };
let playoffs = { // Nueva estructura para Playoff
    semifinales: [],
    tercerPuesto: null,
    final: null
};
let MAX_JUGADORES = 10; // VALOR INICIAL

// --- GESTIÓN DE DATOS Y ESTADO ---

function cargarDatos() {
    const max = localStorage.getItem('maxJugadores');
    if (max) MAX_JUGADORES = parseInt(max);
    
    const p = localStorage.getItem('participantes');
    const pa = localStorage.getItem('partidos');
    const g = localStorage.getItem('grupos');
    const pl = localStorage.getItem('playoffs'); // Cargar datos de playoff
    
    participantes = p ? JSON.parse(p) : [];
    partidos = pa ? JSON.parse(pa) : [];
    grupos = g ? JSON.parse(g) : { A: [], B: [] };
    playoffs = pl ? JSON.parse(pl) : { semifinales: [], tercerPuesto: null, final: null }; // Inicializar playoff si no existe

    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    actualizarIU();
    
    if (participantes.length === MAX_JUGADORES && grupos.A.length > 0) {
        document.getElementById('configuracion').style.display = 'none';
        document.getElementById('registro').style.display = 'none';
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        generarGruposHTML();
        generarPartidosHTML();
        actualizarRankingYFinales();
    } else {
        document.getElementById('configuracion').style.display = 'block';
        document.getElementById('registro').style.display = 'block';
        document.getElementById('grupos-fixture').style.display = 'none';
        document.getElementById('ranking-finales').style.display = 'none';
    }
}

function guardarDatos() {
    localStorage.setItem('maxJugadores', MAX_JUGADORES);
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
    localStorage.setItem('playoffs', JSON.stringify(playoffs)); // Guardar datos de playoff
}

function borrarDatos() {
    if (confirm("⚠️ ¿Estás seguro de que quieres borrar TODOS los datos del torneo (jugadores, resultados y configuración)? Esta acción es irreversible.")) {
        localStorage.clear();
        
        participantes = [];
        partidos = [];
        grupos = { A: [], B: [] };
        playoffs = { semifinales: [], tercerPuesto: null, final: null }; // Resetear playoff
        MAX_JUGADORES = 10; 

        alert("✅ Todos los datos han sido borrados. La aplicación se ha reiniciado.");
        location.reload(); 
    }
}

// --- CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES (SIN CAMBIOS) ---

function configurarMaxJugadores() {
    const input = document.getElementById('max-jugadores-input');
    const nuevoMax = parseInt(input.value);

    if (nuevoMax < 2 || nuevoMax % 2 !== 0) {
        alert("El número de jugadores debe ser par (2, 4, 6, 8...).");
        input.value = MAX_JUGADORES;
        return;
    }
    
    if (participantes.length > nuevoMax) {
        alert(`Ya hay ${participantes.length} jugadores registrados. El nuevo máximo debe ser mayor o igual.`);
        input.value = MAX_JUGADORES; 
        return;
    }

    MAX_JUGADORES = nuevoMax;
    partidos = [];
    grupos = { A: [], B: [] };
    playoffs = { semifinales: [], tercerPuesto: null, final: null };
    
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

// --- GENERACIÓN DE GRUPOS Y FIXTURE (SIN CAMBIOS EN LA ROTACIÓN) ---

function generarFixture(grupo) {
    const n = grupo.length;
    if (n === 0) return [];
    
    const fixture = [];
    let jugadores = [...grupo];

    const isImpar = n % 2 !== 0;
    if (isImpar) {
        jugadores.push(null); 
    }
    const numJugadoresRotacion = jugadores.length;
    const totalRondas = numJugadoresRotacion - 1; 
    const grupoKey = grupo === grupos.A ? 'A' : 'B';

    for (let r = 0; r < totalRondas; r++) {
        for (let i = 0; i < numJugadoresRotacion / 2; i++) {
            const j1 = jugadores[i];
            const j2 = jugadores[numJugadoresRotacion - 1 - i];

            if (j1 !== null && j2 !== null && j1 !== j2) {
                if (!fixture.find(p => (p.j1 === j1 && p.j2 === j2) || (p.j1 === j2 && p.j2 === j1))) {
                    fixture.push({ j1: j1, j2: j2, grupo: grupoKey, tipo: 'Grupo' }); // Añadir tipo
                }
            }
        }
        
        // ROTACIÓN DEL CÍRCULO
        if (numJugadoresRotacion > 2) {
            const primerJugador = jugadores[0];
            const ultimoDelResto = jugadores[numJugadoresRotacion - 1]; 
            
            for (let i = numJugadoresRotacion - 1; i > 1; i--) {
                jugadores[i] = jugadores[i - 1];
            }
            
            jugadores[1] = ultimoDelResto;
            jugadores[0] = primerJugador;
        }
    }
    return fixture;
}

function generarGruposHTML() {
    const contenedor = document.getElementById('grupos-container');
    contenedor.innerHTML = '';
    
    for (const grupoKey in grupos) {
        const grupo = grupos[grupoKey];
        if (grupo.length > 0) {
            const div = document.createElement('div');
            div.innerHTML = `
                <h3>Grupo ${grupoKey} (${grupo.length} jugadores)</h3>
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

    const mezclados = participantes.sort(() => Math.random() - 0.5);
    const mitad = MAX_JUGADORES / 2;
    grupos.A = mezclados.slice(0, mitad);
    grupos.B = mezclados.slice(mitad, MAX_JUGADORES);

    partidos = generarFixture(grupos.A).concat(generarFixture(grupos.B));
    partidos.forEach(p => {
        p.gamesJ1 = null;
        p.gamesJ2 = null;
        p.tipo = 'Grupo'; // Aseguramos el tipo
    });
    
    // Resetear playoffs al iniciar un nuevo torneo
    playoffs = { semifinales: [], tercerPuesto: null, final: null };

    guardarDatos();
    document.getElementById('registro').style.display = 'none';
    document.getElementById('configuracion').style.display = 'none';
    document.getElementById('grupos-fixture').style.display = 'block';
    document.getElementById('ranking-finales').style.display = 'block';
    
    generarGruposHTML();
    generarPartidosHTML();
    actualizarRankingYFinales();
}

// --- REGISTRO DE RESULTADOS CONSOLIDADO ---

function registrarResultado(index, isPlayoff = false) {
    let partido;
    let baseID;

    if (isPlayoff) {
        // Para Semifinales, 3er Puesto y Final
        baseID = `p-${index}`;
        const matchType = document.getElementById(`type-${index}`).value;
        
        if (matchType === 'SF') {
            partido = playoffs.semifinales.find(p => p.index === index);
        } else if (matchType === '3P') {
            partido = playoffs.tercerPuesto;
        } else if (matchType === 'FIN') {
            partido = playoffs.final;
        }
    } else {
        // Para Fase de Grupos
        partido = partidos[index];
        baseID = `g1-${index}`; // Usamos g1-index para obtener el índice de forma simple
    }
    
    // Obtener los valores de los inputs
    const g1 = parseInt(document.getElementById(`${baseID}`).value);
    const g2 = parseInt(document.getElementById(`g2-${index}`).value);

    // Validación según la regla de 8 games o tie-break (7-8/8-7)
    const esTieBreakValido = (g1 === 7 && g2 === 8) || (g1 === 8 && g2 === 7);
    const esVictoriaRegular = (g1 >= 8 || g2 >= 8) && (Math.abs(g1 - g2) >= 2);

    if (isNaN(g1) || isNaN(g2) || g1 === g2 || !(esVictoriaRegular || esTieBreakValido)) {
        alert("Resultado inválido. Debe ser una victoria por 2 games (Ej: 8-6) o un tie-break (8-7 o 7-8).");
        return;
    }

    if (partido) {
        partido.gamesJ1 = g1;
        partido.gamesJ2 = g2;
        partido.ganador = g1 > g2 ? partido.j1 : partido.j2;
        partido.perdedor = g1 < g2 ? partido.j1 : partido.j2;

        guardarDatos();
        actualizarRankingYFinales();
        alert(`Resultado guardado: ${partido.j1} ${g1} - ${g2} ${partido.j2}`);
    } else {
        alert("Error al encontrar el partido. Inténtelo de nuevo.");
    }
}

function generarPartidosHTML() {
    const contenedor = document.getElementById('partidos-registro');
    contenedor.innerHTML = '<h4>Registre los resultados (Ej: 8-3, 8-6, 4-8, etc.). Si queda 7-7, el tie-break se registra como **7-8** o **8-7** (según el ganador).</h4>';
    
    // 1. Partidos de Fase de Grupos
    partidos.forEach((p, index) => {
        const gamesJ1 = p.gamesJ1 !== null ? p.gamesJ1 : '';
        const gamesJ2 = p.gamesJ2 !== null ? p.gamesJ2 : '';

        contenedor.innerHTML += `
            <div class="partido-item">
                <p><strong>GRUPO ${p.grupo}:</strong> ${p.j1} vs ${p.j2}</p>
                <input type="number" id="g1-${index}" value="${gamesJ1}" min="0" placeholder="${p.j1}">
                -
                <input type="number" id="g2-${index}" value="${gamesJ2}" min="0" placeholder="${p.j2}">
                <button onclick="registrarResultado(${index}, false)">Guardar</button>
            </div>
        `;
    });
    
    // 2. Partidos de Playoff (Solo si existen)
    if (playoffs.semifinales.length > 0) {
        contenedor.innerHTML += '<h3>Registro de Resultados de Playoff</h3>';
        
        // Iterar sobre todos los partidos de playoff (SF, 3P, FIN)
        [...playoffs.semifinales, playoffs.tercerPuesto, playoffs.final].filter(p => p).forEach((p, index) => {
            const gamesJ1 = p.gamesJ1 !== null ? p.gamesJ1 : '';
            const gamesJ2 = p.gamesJ2 !== null ? p.gamesJ2 : '';
            
            // Usamos un índice dinámico para evitar conflictos con los índices de la Fase de Grupos
            // y usamos un input oculto para pasar el tipo de partido
            const uniqueIndex = index + partidos.length; 
            
            contenedor.innerHTML += `
                <div class="partido-item">
                    <p><strong>${p.tipo}:</strong> ${p.j1} vs ${p.j2}</p>
                    <input type="hidden" id="type-${uniqueIndex}" value="${p.tipo.substring(0, p.tipo.length < 4 ? p.tipo.length : 3).toUpperCase()}"> 
                    <input type="number" id="p-${uniqueIndex}" value="${gamesJ1}" min="0" placeholder="${p.j1}">
                    -
                    <input type="number" id="g2-${uniqueIndex}" value="${gamesJ2}" min="0" placeholder="${p.j2}">
                    <button onclick="registrarResultado(${uniqueIndex}, true)">Guardar</button>
                </div>
            `;
        });
    }
}


// --- CÁLCULO DE RANKING DE GRUPOS (SIN CAMBIOS) ---

function calcularRanking(grupo) {
    // ... [La lógica de cálculo de ranking de grupos permanece sin cambios] ...
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

        r1.gamesFavor += p.gamesJ1;
        r1.gamesContra += p.gamesJ2;
        r2.gamesFavor += p.gamesJ2;
        r2.gamesContra += p.gamesJ1;
        r1.puntos += p.gamesJ1 * 10;
        r2.puntos += p.gamesJ2 * 10;

        if (p.gamesJ1 > p.gamesJ2) {
            r1.puntos += 100;
            r1.victorias += 1;
        } else if (p.gamesJ2 > p.gamesJ1) {
            r2.puntos += 100;
            r2.victorias += 1;
        }
    });

    rankingData.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        const diffA = a.gamesFavor - a.gamesContra;
        const diffB = b.gamesFavor - b.gamesContra;
        if (diffB !== diffA) return diffB - diffA;
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
        if (index < 2) row.style.backgroundColor = '#d4edda';
    });
}

// --- GENERACIÓN DE PLAYOFFS Y RANKING FINAL ---

function generarPlayoffs(rA, rB) {
    const a1 = rA[0].nombre;
    const a2 = rA[1].nombre;
    const b1 = rB[0].nombre;
    const b2 = rB[1].nombre;
    
    const divPlayoffs = document.getElementById('playoffs');
    divPlayoffs.innerHTML = '';
    
    const todosLosPartidosJugados = partidos.every(p => p.ganador);

    if (todosLosPartidosJugados) {
        
        // 1. Generar Semifinales (Solo si es la primera vez)
        if (playoffs.semifinales.length === 0) {
            playoffs.semifinales = [
                { j1: a1, j2: b2, tipo: 'SF1', gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, index: 0 },
                { j1: b1, j2: a2, tipo: 'SF2', gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, index: 1 }
            ];
            guardarDatos();
            generarPartidosHTML(); // Refrescar para mostrar los inputs
        }
        
        const sf1 = playoffs.semifinales.find(p => p.tipo === 'SF1');
        const sf2 = playoffs.semifinales.find(p => p.tipo === 'SF2');

        divPlayoffs.innerHTML += `
            <h4>Paso 5: Semifinales</h4>
            <p>SF1: **${sf1.j1}** vs **${sf1.j2}** (${sf1.ganador ? 'Ganador: ' + sf1.ganador : 'Pendiente'})</p>
            <p>SF2: **${sf2.j1}** vs **${sf2.j2}** (${sf2.ganador ? 'Ganador: ' + sf2.ganador : 'Pendiente'})</p>
        `;
        
        // 2. Generar Final y 3er Puesto (Cuando las SF estén terminadas)
        if (sf1.ganador && sf2.ganador) {
            
            // Generar 3er puesto
            if (!playoffs.tercerPuesto) {
                playoffs.tercerPuesto = { 
                    j1: sf1.perdedor, 
                    j2: sf2.perdedor, 
                    tipo: '3er Puesto', 
                    gamesJ1: null, gamesJ2: null, 
                    ganador: null, perdedor: null, 
                    index: 2
                };
            }
            // Generar Final
            if (!playoffs.final) {
                playoffs.final = { 
                    j1: sf1.ganador, 
                    j2: sf2.ganador, 
                    tipo: 'Final', 
                    gamesJ1: null, gamesJ2: null, 
                    ganador: null, perdedor: null, 
                    index: 3
                };
            }
            
            guardarDatos();
            generarPartidosHTML(); // Refrescar para mostrar los inputs de las finales

            divPlayoffs.innerHTML += `
                <h4>Paso 6: Finales</h4>
                <p>3er Puesto: **${playoffs.tercerPuesto.j1}** vs **${playoffs.tercerPuesto.j2}** (${playoffs.tercerPuesto.ganador ? 'Ganador: ' + playoffs.tercerPuesto.ganador : 'Pendiente'})</p>
                <p>Final: **${playoffs.final.j1}** vs **${playoffs.final.j2}** (${playoffs.final.ganador ? 'Ganador: ' + playoffs.final.ganador : 'Pendiente'})</p>
            `;
            
            // 3. Mostrar Ranking Final (Cuando las Finales estén terminadas)
            if (playoffs.tercerPuesto.ganador && playoffs.final.ganador) {
                mostrarRankingFinal(rA.slice(0, 2).concat(rB.slice(0, 2)));
            }

        }
    } else {
        divPlayoffs.innerHTML = '<p>Complete todos los resultados de la Fase de Grupos para generar las Semifinales.</p>';
    }
}

function mostrarRankingFinal(clasificados) {
    const divPlayoffs = document.getElementById('playoffs');
    
    // Recopilar los resultados de las finales
    const final = playoffs.final;
    const tercerPuesto = playoffs.tercerPuesto;
    const sf = playoffs.semifinales;
    
    // Clasificación:
    const ranking = [
        { puesto: 1, nombre: final.ganador },
        { puesto: 2, nombre: final.perdedor },
        { puesto: 3, nombre: tercerPuesto.ganador },
        { puesto: 4, nombre: tercerPuesto.perdedor }
    ];
    
    // Puestos del 5to en adelante (Basados en el ranking de grupos)
    const top4Nombres = ranking.map(r => r.nombre);
    
    // Jugadores eliminados en grupos que no pasaron a Playoff
    const noClasificados = participantes
        .filter(nombre => !top4Nombres.includes(nombre))
        .map(nombre => {
            // Encontrar su posición en el ranking de su grupo (para desempate)
            const rA = calcularRanking(grupos.A);
            const rB = calcularRanking(grupos.B);
            const rJugador = rA.find(r => r.nombre === nombre) || rB.find(r => r.nombre === nombre);
            return { nombre: nombre, puntos: rJugador.puntos, diff: rJugador.gamesFavor - rJugador.gamesContra };
        })
        .sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            return b.diff - a.diff;
        })
        .map((j, index) => ({ puesto: 5 + index, nombre: j.nombre }));


    // Unir el ranking final completo
    const rankingFinalCompleto = ranking.concat(noClasificados);


    divPlayoffs.innerHTML += `
        <hr>
        <h3>🏆 Ranking Final del Torneo 🏆</h3>
        <table class="ranking-table" style="width: 50%;">
            <tr>
                <th>Puesto</th>
                <th>Jugador</th>
            </tr>
            ${rankingFinalCompleto.map(r => `
                <tr style="background-color: ${r.puesto <= 4 ? (r.puesto === 1 ? '#ffcc0040' : '#d4edda') : 'none'};">
                    <td>${r.puesto}</td>
                    <td>${r.nombre}</td>
                </tr>
            `).join('')}
        </table>
    `;
}

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
    
    if (rankingA.length >= 2 && rankingB.length >= 2) {
        generarPlayoffs(rankingA, rankingB);
    } else {
        document.getElementById('playoffs').innerHTML = '<p>Complete todos los resultados de la Fase de Grupos para generar las Semifinales.</p>';
    }
}

// Cargar datos al cargar la página
window.onload = cargarDatos;
