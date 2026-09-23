/**
 * CANZONIERE SMART - FILE DI GESTIONE INTERFACCIA E LOGICA DI NAVIGAZIONE
 * 
 * Filosofia: "Divide et Impera". Questo file si occupa esclusivamente di:
 * 1. Gestire la barra di ricerca rapida testuale e i suoi risultati.
 * 2. Mostrare/Nascondere le schermate del leggio digitale.
 * 3. Coordinare il caricamento dei file .txt (sia online che offline).
 * 4. Inviare gli impulsi di calcolo al motore esterno "transposer.js".
 */

// =========================================================================
// STATI E VARIABILI GLOBALI (Condivise con il motore transposer.js)
// =========================================================================
let currentNotation = 'IT';       // Notazione corrente visualizzata ('IT' o 'EN')
let originalText = "";            // Conserva il testo grezzo originale del file .txt caricato
let currentSemitoneShift = 0;     // Contatore dello spostamento di tonalità corrente (da -5 a +6)

// Inizializzazione sicura: mette il focus sulla barra di ricerca all'apertura
window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search-input');
    if(input) input.focus(); 
});

// =========================================================================
// 1. LOGICA DEL MOTORE DI RICERCA RAPIDA
// =========================================================================

/**
 * Filtra il catalogo in tempo reale in base a ciò che l'utente digita
 */
function ricercaRapida() {
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results');
    if (!input || !resultsContainer) return;
    
    // Pulisce la stringa digitata rimuovendo spazi superflui
    const query = input.value.trim().toLowerCase();
    
    // Se la barra viene svuotata, nasconde immediatamente il pannello dei risultati
    if (query.length < 1) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
        return;
    }
    
    // Cerca corrispondenze sia all'interno del Titolo che dell'Autore
    let risultati = catalogoCanzoni.filter(c => 
        (c.titolo && c.titolo.toLowerCase().includes(query)) || 
        (c.autore && c.autore.toLowerCase().includes(query))
    );
    
    // Ordina i risultati filtrati in rigoroso ordine alfabetico per Titolo
    risultati.sort((a, b) => a.titolo.localeCompare(b.titolo));
    
    // Gestione del caso in cui non ci siano corrispondenze
    if (risultati.length === 0) {
        resultsContainer.innerHTML = "<div class='search-no-result'>Nessun brano trovato...</div>";
        resultsContainer.style.display = "block";
        return;
    }
    
    // Genera l'elenco HTML dinamico dei suggerimenti cliccabili
    let elencoHtml = "";
    risultati.forEach(c => {
        const autoreTesto = c.autore ? ` <small>(${c.autore})</small>` : "";
        
        // RISOLTO: Uso delle virgolette doppie ed escape pulito per evitare interruzioni di stringa
        elencoHtml += "<div class=\"search-item\" onclick=\"apriCanzone('" + c.titolo.replace(/'/g, "\\'") + "', '" + (c.autore ? c.autore.replace(/'/g, "\\'") : "") + "')\"><strong>" + c.titolo + "</strong>" + autoreTesto + "</div>";
    });
    
    resultsContainer.innerHTML = elencoHtml;
    resultsContainer.style.display = "block";
}

// =========================================================================
// 2. NAVIGAZIONE FRA LE SCHERMATE (MENU <-> LEGGIO)
// =========================================================================

/**
 * Configura la transizione grafica dal menu principale alla visualizzazione della canzone
 * @param {string} titolo - Il titolo della canzone selezionata
 * @param {string} autore - L'autore della canzone selezionata
 */
function apriCanzone(titolo, autore) {
    // Pulisce i campi di ricerca per quando si deciderà di tornare indietro
    document.getElementById('search-input').value = "";
    document.getElementById('search-results').style.display = "none";
    
    // Scrive i metadati della canzone negli elementi dedicati della pagina
    document.getElementById('song-title').innerText = titolo;
    document.getElementById('song-author').innerText = autore ? `- ${autore}` : "";
    
    // Gestione visiva dello switch delle schermate
    document.getElementById('menu-screen').style.display = "none";
    document.getElementById('song-screen').style.display = "block";
    
    // Resetta lo stato di trasposizione ad ogni apertura di un nuovo brano
    currentSemitoneShift = 0;
    currentNotation = 'IT'; // Imposta la visualizzazione di partenza predefinita su Italiana
    document.getElementById('radio-it').checked = true;
    
    // Aggiorna l'etichetta visiva dei semitoni trasposti
    aggiornaTestoTonalita();
    
    // Avvia la richiesta di caricamento file (Il titolo coincide con il nomefile.txt)
    loadSong(`${titolo}.txt`);
}

/**
 * Nasconde il foglio della canzone e riproietta l'utente sul motore di ricerca iniziale
 */
function tornaAlMenu() {
    document.getElementById('song-screen').style.display = "none";
    document.getElementById('menu-screen').style.display = "block";
    const input = document.getElementById('search-input');
    if(input) {
        input.value = "";
        input.focus(); // Riattiva il cursore sulla barra per una nuova digitazione rapida
    }
}

// =========================================================================
// 3. SISTEMA DI CARICAMENTO DEI FILE ESTERNI (.TXT)
// =========================================================================

/**
 * Tenta il caricamento automatico asincrono del file dalla cartella CatalogoTxT
 * @param {string} fileName - Nome del file comprensivo di estensione (es. "Albachiara.txt")
 */
async function loadSong(fileName) {
    const percorsoFile = "CatalogoTxT/" + fileName;
    try {
        // Se si è online o su un server locale, effettua la richiesta Fetch
        const response = await fetch(percorsoFile);
        if (!response.ok) throw new Error();
        
        // Estrae il testo puro e lo assegna alla memoria globale
        originalText = await response.text();
        document.getElementById('offline-zone').style.display = "none"; // Nasconde il pannello offline
        
        // Passa la palla al motore di rendering di transposer.js
        if (typeof render === "function") render();
    } catch (error) {
        // Se scatta l'errore di protezione (Offline locale sul tablet), si attiva il selettore Finder
        document.getElementById('song-content').innerHTML = "In attesa del file txt...";
        document.getElementById('target-filename').innerText = fileName;
        document.getElementById('offline-zone').style.display = "block";
    }
}

// Ascoltatore per il caricamento manuale tramite File-Picker (Richiesto in Offline locale)
const fileSelector = document.getElementById('file-selector');
if (fileSelector) {
    fileSelector.addEventListener('change', function(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            // Estrae il testo caricato dall'utente e lo deposita nella variabile globale
            originalText = e.target.result;
            document.getElementById('offline-zone').style.display = "none"; // Nasconde l'avviso giallo
            
            // Innesca la formattazione e la colorazione degli accordi di transposer.js
            if (typeof render === "function") render();
        };
        reader.readAsText(files[0]);
    });
}

// =========================================================================
// 4. INTERFACCIA DEI PULSANTI FLUTTUANTI (CAMBIAMENTI TONALITÀ E NOTAZIONE)
// =========================================================================

/**
 * Gestisce l'incremento o decremento dei semitoni e ne normalizza il giro armonico
 * @param {number} semitones - Valore numerico dello shift (es. +1 o -1)
 */
function transpose(semitones) {
    currentSemitoneShift = (currentSemitoneShift + semitones) % 12;
    
    // Normalizzazione dell'intervallo per una lettura intuitiva sul display (da -5 a +6)
    if (currentSemitoneShift > 6) currentSemitoneShift -= 12;
    if (currentSemitoneShift < -5) currentSemitoneShift += 12;
    
    aggiornaTestoTonalita(); // Aggiorna l'interfaccia numerica
    if (typeof render === "function") render(); // Ricalcola e ridisegna gli accordi a schermo
}

/**
 * Cambia il sistema di visualizzazione alfabetico delle note musicali
 * @param {string} notation - Il sistema scelto ('IT' per Do-Re-Mi, 'EN' per C-D-E)
 */
function changeNotation(notation) {
    currentNotation = notation;
    if (typeof render === "function") render(); // Ridisegna gli accordi nella nuova lingua
}

/**
 * Aggiorna il testo informativo sotto i pulsanti per dare un riscontro visivo immediato delle modifiche
 */
function aggiornaTestoTonalita() {
    const infoTonalita = document.getElementById("info-tonalita");
    if (!infoTonalita) return;
    
    if (currentSemitoneShift === 0) {
        infoTonalita.innerText = "Tonalità: Originale";
        infoTonalita.style.color = "#555"; // Grigio neutro quando il brano non è alterato
    } else {
        const segno = currentSemitoneShift > 0 ? "+" : "";
        infoTonalita.innerText = `Tonalità: ${segno}${currentSemitoneShift} semitoni`;
        infoTonalita.style.color = "#d32f2f"; // Diventa rosso per segnalare un cambio di tonalità attivo
    }
}

// =========================================================================
// NUOVO: LOGICA DI GESTIONE DELLO SCORRIMENTO AUTOMATICO (AUTO-SCROLL)
// =========================================================================

let scrollInterval = null; // Memorizza il timer dello scorrimento
let isScrolling = false;   // Stato dello scorrimento (attivo/disattivo)
let scrollIntervalTime = 40; // Tempo in millisecondi tra uno scorrimento e l'altro (più basso = più veloce)
let speedLevel = 1;        // Livello visivo della velocità da mostrare a schermo

/**
 * Attiva o disattiva lo scorrimento automatico della pagina
 */
function toggleScroll() {
    const btn = document.getElementById('btn-scroll');
    if (!btn) return;

    if (isScrolling) {
        // Se sta scorrendo, ferma il timer
        clearInterval(scrollInterval);
        scrollInterval = null;
        isScrolling = false;
        btn.innerText = "▶ Auto-Scroll";
        btn.style.backgroundColor = ""; // Ripristina colore default
        btn.style.color = "";
    } else {
        // Se è fermo, avvia lo scorrimento continuo della finestra
        isScrolling = true;
        btn.innerText = "⏸ Pausa";
        btn.style.backgroundColor = "#28a745"; // Diventa verde per indicare che è attivo
        btn.style.color = "white";
        
        scrollInterval = setInterval(() => {
            window.scrollBy(0, 1); // Sposta la finestra in basso di 1 pixel ad ogni intervallo
        }, scrollIntervalTime);
    }
}

/**
 * Modifica la velocità dello scorrimento variando l'intervallo di tempo del timer
 * @param {number} delta - Variazione di tempo (valori negativi velocizzano, positivi rallentano)
 */
function changeScrollSpeed(delta) {
    // Al contrario logicamente: meno millisecondi passano, più il testo scorre velocemente
    // delta positivo (+5) significa che l'utente vuole andare più veloce -> diminuiamo i ms
    // delta negativo (-5) significa che vuole andare più lento -> aumentiamo i ms
    
    if (delta > 0) {
        if (scrollIntervalTime > 10) { // Limite massimo di velocità (10ms)
            scrollIntervalTime -= 5;
            speedLevel++;
        }
    } else {
        if (scrollIntervalTime < 100) { // Limite minimo di velocità (100ms)
            scrollIntervalTime += 5;
            speedLevel--;
        }
    }
    
    // Aggiorna l'indicatore grafico della velocità
    const infoVel = document.getElementById('info-velocita');
    if (infoVel) {
        infoVel.innerText = `Velocità: ${speedLevel}x`;
    }

    // Se lo scorrimento era già attivo, riavvia il timer con la nuova velocità aggiornata
    if (isScrolling) {
        clearInterval(scrollInterval);
        scrollInterval = setInterval(() => {
            window.scrollBy(0, 1);
        }, scrollIntervalTime);
    }
}

// INTEGRAZIONE DI SICUREZZA: Reset dello scorrimento se si torna al menu
// Cerca la tua vecchia funzione tornaAlMenu() in CanzoniereSmart.js e aggiungi queste righe dentro:
const vecchiaFunzioneTornaAlMenu = tornaAlMenu;
tornaAlMenu = function() {
    if (isScrolling) {
        toggleScroll(); // Disattiva lo scorrimento prima di uscire
    }
    scrollIntervalTime = 40; // Resetta la velocità al valore iniziale
    speedLevel = 1;
    const infoVel = document.getElementById('info-velocita');
    if (infoVel) infoVel.innerText = "Velocità: 1x";
    
    vecchiaFunzioneTornaAlMenu(); // Lancia il vecchio comportamento di ritorno
};