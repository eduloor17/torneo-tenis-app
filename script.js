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
    const pl = localStorage.getItem('playoffs'); 
    
    participantes = p ? JSON.parse(p) : [];
    partidos = pa ? JSON.parse(pa) : [];
    grupos = g ? JSON.parse(g) : { A: [], B: [] };
    playoffs = pl ? JSON.parse(pl) : { semifinales: [], tercerPuesto: null, final: null }; 

    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    actualizarIU();
    
    if (participantes.length === MAX_JUGADORES && grupos.A.length > 0) {
        document.getElementById('configuracion').style.display = 'none';
        document.getElementById('registro').style.display = 'none';
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        generarGruposHTML();
        generarPartidosGruposHTML(); // Mostrar partidos de grupos
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
    localStorage.setItem('playoffs', JSON.stringify(playoffs)); 
}

function borrarDatos() {
    if (confirm("⚠️ ¿Estás seguro de que quieres borrar TODOS los datos del torneo (jugadores, resultados y configuración)? Esta acción es irreversible.")) {
        localStorage.clear();
        
        participantes = [];
        partidos = [];
        grupos = { A: [], B: [] };
        playoffs = { semifinales: [], tercerPuesto: null, final: null }; 
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
                    fixture.push({ j1: j1, j2: j2, grupo: grupoKey, tipo: 'Grupo' }); 
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
        p.ganador = null;
        p.perdedor = null;
        p.tipo = 'Grupo'; 
    });
    
    playoffs = { semifinales: [], tercerPuesto: null, final: null };

    guardarDatos();
    document.getElementById('registro').style.display = 'none';
    document.getElementById('configuracion').style.display = 'none';
    document.getElementById('grupos-fixture').style.display = 'block';
    document.getElementById('ranking-finales').style.display = 'block';
    
    generarGruposHTML();
    generarPartidosGruposHTML(); 
    actualizarRankingYFinales();
}

// --- REGISTRO DE RESULTADOS CONSOLIDADO (SIN CAMBIOS) ---

function registrarResultado(index, isPlayoff = false) {
    let partido;
    let baseID;

    if (isPlayoff) {
        baseID = `p-${index}`;
        const matchType = document.getElementById(`type-${index}`).value;
        
        if (matchType.startsWith('SF')) {
            partido = playoffs.semifinales.find(p => p.index === index - partidos.length);
        } else if (matchType === '3P') {
            partido = playoffs.tercerPuesto;
        } else if (matchType === 'FIN') {
            partido = playoffs.final;
        }
    } else {
        partido = partidos[index];
        baseID = `g1-${index}`; 
    }
    
    if (!partido) {
         alert("Error: Partido no encontrado.");
         return;
    }

    const g1 = parseInt(document.getElementById(`${baseID}`).value);
    const g2 = parseInt(document.getElementById(`g2-${index}`).value);

    // Validación según la regla de 8 games o tie-break (7-8/8-7)
    const esTieBreakValido = (g1 === 7 && g2 === 8) || (g1 === 8 && g2 === 7);
    const esVictoriaRegular = (g1 >= 8 || g2 >= 8) && (Math.abs(g1 - g2) >= 2);

    if (isNaN(g1) || isNaN(g2) || g1 === g2 || !(esVictoriaRegular || esTieBreakValido)) {
        alert("Resultado inválido. Debe ser una victoria por 2 games (Ej: 8-6) o un tie-break (8-7 o 7-8).");
        return;
    }

    partido.gamesJ1 = g1;
    partido.gamesJ2 = g2;
    partido.ganador = g1 > g2 ? partido.j1 : partido.j2;
    partido.perdedor = g1 < g2 ? partido.j1 : partido.j2;

    guardarDatos();
    // Es crucial actualizar todo después de guardar un resultado
    actualizarRankingYFinales();
    generarPartidosGruposHTML(); 
    generarPartidosPlayoffHTML(); 
    alert(`Resultado guardado: ${partido.j1} ${g1} - ${g2} ${partido.j2}`);
}

function generarPartidosGruposHTML() {
    const contenedor = document.getElementById('partidos-registro-grupos');
    contenedor.innerHTML = '<h4>Registre los resultados (Ej: 8-3, 8-6, 4-8, etc.). Si queda 7-7, el tie-break se registra como **7-8** o **8-7** (según el ganador).</h4>';
    
    // 1. Partidos de Fase de Grupos
    partidos.forEach((p, index) => {
        const gamesJ1 = p.gamesJ1 !== null ? p.gamesJ1 : '';
        const gamesJ2 = p.gamesJ2 !== null ? p.gamesJ2 : '';
        const isCompleted = p.ganador !== null;
        const color = isCompleted ? '#e0f7fa' : '';

        contenedor.innerHTML += `
            <div class="partido-item" style="background-color: ${color}; padding: 10px; margin-bottom: 5px; border-radius: 4px;">
                <p><strong>GRUPO ${p.grupo}:</strong> ${p.j1} vs ${p.j2}</p>
                <input type="number" id="g1-${index}" value="${gamesJ1}" min="0" placeholder="${p.j1}" style="width: 50px;">
                -
                <input type="number" id="g2-${index}" value="${gamesJ2}" min="0" placeholder="${p.j2}" style="width: 50px;">
                <button onclick="registrarResultado(${index}, false)">Guardar</button>
                ${isCompleted ? `<strong>Resultado: ${p.gamesJ1}-${p.gamesJ2}</strong>` : ''}
            </div>
        `;
    });
}

function generarPartidosPlayoffHTML() {
    const contenedor = document.getElementById('playoffs-registro');
    contenedor.innerHTML = '<h3>Registro de Resultados de Playoff</h3>';
    
    if (playoffs.semifinales.length === 0 && !playoffs.tercerPuesto && !playoffs.final) {
        contenedor.style.display = 'none';
        return;
    }
    
    contenedor.style.display = 'block';

    const allPlayoffMatches = [...playoffs.semifinales, playoffs.tercerPuesto, playoffs.final].filter(p => p);
    const pendingPlayoffMatches = allPlayoffMatches.filter(p => !p.ganador); 
    
    if (pendingPlayoffMatches.length > 0) {
        
        contenedor.innerHTML += '<h4>Complete los resultados pendientes:</h4>';
        
        pendingPlayoffMatches.forEach((p) => {
            const gamesJ1 = p.gamesJ1 !== null ? p.gamesJ1 : '';
            const gamesJ2 = p.gamesJ2 !== null ? p.gamesJ2 : '';
            
            const uniqueIndex = partidos.length + p.index; 
            
            let typeAbbrev;
            if (p.tipo.startsWith('SF')) {
                typeAbbrev = 'SF';
            } else if (p.tipo.startsWith('3er')) {
                typeAbbrev = '3P';
            } else if (p.tipo.startsWith('Final')) {
                typeAbbrev = 'FIN';
            }

            contenedor.innerHTML += `
                <div class="partido-item" style="background-color: #ffe0b2; padding: 10px; margin-bottom: 5px; border-radius: 4px;">
                    <p><strong>${p.tipo}:</strong> ${p.j1} vs ${p.j2}</p>
                    <input type="hidden" id="type-${uniqueIndex}" value="${typeAbbrev}"> 
                    <input type="number" id="p-${uniqueIndex}" value="${gamesJ1}" min="0" placeholder="${p.j1}" style="width: 50px;">
                    -
                    <input type="number" id="g2-${uniqueIndex}" value="${gamesJ2}" min="0" placeholder="${p.j2}" style="width: 50px;">
                    <button onclick="registrarResultado(${uniqueIndex}, true)">Guardar</button>
                </div>
            `;
        });
    } else if (playoffs.final && playoffs.final.ganador) {
        contenedor.innerHTML += '<p style="color: green;">✅ Todos los partidos del Playoff han sido completados.</p>';
    }
}


// --- CÁLCULO DE RANKING DE GRUPOS Y GLOBAL (MÉTRICAS) ---

function calcularRanking(jugadores, calcularGlobal = false) {
    const rankingData = jugadores.map(j => ({
        nombre: j,
        puntos: 0,
        victorias: 0,
        gamesFavor: 0,
        gamesContra: 0
    }));

    let partidosACalcular = [...partidos];
    if (calcularGlobal) {
        const playoffMatches = [...playoffs.semifinales, playoffs.tercerPuesto, playoffs.final].filter(p => p && p.ganador);
        partidosACalcular = partidosACalcular.concat(playoffMatches);
    } else {
        const grupoKey = grupos.A.includes(jugadores[0]) ? 'A' : 'B';
        partidosACalcular = partidosACalcular.filter(p => p.grupo === grupoKey);
    }


    partidosACalcular.filter(p => p.gamesJ1 !== null).forEach(p => {
        const r1 = rankingData.find(r => r.nombre === p.j1);
        const r2 = rankingData.find(r => r.nombre === p.j2);

        if (r1 && r2) {
            r1.gamesFavor += p.gamesJ1;
            r1.gamesContra += p.gamesJ2;
            r2.gamesFavor += p.gamesJ2;
            r2.gamesContra += p.gamesJ1;
            
            if (p.gamesJ1 > p.gamesJ2) {
                r1.victorias += 1;
            } else if (p.gamesJ2 > p.gamesJ1) {
                r2.victorias += 1;
            }
            
            if (p.tipo === 'Grupo') {
                r1.puntos += p.gamesJ1 * 10;
                r2.puntos += p.gamesJ2 * 10;
                if (p.gamesJ1 > p.gamesJ2) {
                    r1.puntos += 100;
                } else if (p.gamesJ2 > p.gamesJ1) {
                    r2.puntos += 100;
                }
            }
        }
    });

    rankingData.forEach(r => {
        r.dif = r.gamesFavor - r.gamesContra;
    });

    if (!calcularGlobal) {
        rankingData.sort((a, b) => {
            if (b.puntos !== a.puntos) return b.puntos - a.puntos;
            if (b.dif !== a.dif) return b.dif - a.dif;
            return b.gamesFavor - a.gamesFavor;
        });
    }

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
            <td>${r.dif}</td>
        `;
        if (index < 2) row.style.backgroundColor = '#d4edda';
    });
}

// --- GENERACIÓN DE PLAYOFFS Y RANKING FINAL (FLUJO CORREGIDO) ---

function generarPlayoffs(rA, rB) {
    const a1 = rA[0].nombre;
    const a2 = rA[1].nombre;
    const b1 = rB[0].nombre;
    const b2 = rB[1].nombre;
    
    const divPlayoffs = document.getElementById('playoffs');
    // **CORRECCIÓN:** Limpiar divPlayoffs solo al inicio de la generación de la fase final
    divPlayoffs.innerHTML = ''; 
    
    const todosLosPartidosJugados = partidos.every(p => p.ganador);

    if (todosLosPartidosJugados) {
        
        // 1. Generar Semifinales (Paso 5)
        if (playoffs.semifinales.length === 0) {
            playoffs.semifinales = [
                { j1: a1, j2: b2, tipo: 'SF1', gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, index: 0 },
                { j1: b1, j2: a2, tipo: 'SF2', gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, index: 1 }
            ];
            guardarDatos();
            generarPartidosPlayoffHTML(); 
        }
        
        const sf1 = playoffs.semifinales.find(p => p.tipo === 'SF1');
        const sf2 = playoffs.semifinales.find(p => p.tipo === 'SF2');

        divPlayoffs.innerHTML += `
            <h4>Paso 5: Semifinales</h4>
            <p>SF1: **${sf1.j1}** vs **${sf1.j2}** (${sf1.ganador ? `Ganador: **${sf1.ganador}** (${sf1.gamesJ1}-${sf1.gamesJ2})` : 'Pendiente'})</p>
            <p>SF2: **${sf2.j1}** vs **${sf2.j2}** (${sf2.ganador ? `Ganador: **${sf2.ganador}** (${sf2.gamesJ1}-${sf2.gamesJ2})` : 'Pendiente'})</p>
        `;
        
        // 2. Generar Final y 3er Puesto
