/**
 * CANZONIERE SMART - LOGICA APPLICATIVA E DI CONTROLLO CENTRALIZZATA
 */

// Stati globali condivisi con transposer.js
let currentNotation = 'IT';
let originalText = ""; 
let currentSemitoneShift = 0;

// Variabili di configurazione dei cataloghi dinamici
let cartellaAttiva = "";     
let scriptConfigurato = null; 

// Stati dell'Auto-Scroll
let scrollInterval = null;
let currentSpeedMs = 40; // Millisecondi tra gli step (meno ms = più veloce)
let isScrolling = false;

// Inizializzazione degli eventi HTML al caricamento del DOM
window.addEventListener('DOMContentLoaded', () => {
    // Gestori della schermata Splash
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzonere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzonere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);
    
    // Gestori della barra di ricerca e navigazione
    document.getElementById('search-input').addEventListener('input', ricercaRapida);
    document.getElementById('btn-elenco-brani').addEventListener('click', tornaAlMenuRicerca);
    
    // Gestori del transposer e della notazione
    document.getElementById('btn-transpose-meno').addEventListener('click', () => transpose(-1));
    document.getElementById('btn-transpose-piu').addEventListener('click', () => transpose(1));
    document.getElementById('radio-it').addEventListener('click', () => changeNotation('IT'));
    document.getElementById('radio-en').addEventListener('click', () => changeNotation('EN'));

    // Gestori per i controlli dell'Auto-Scroll
    document.getElementById('btn-scroll').addEventListener('click', toggleScroll);
    document.getElementById('btn-scroll-slower').addEventListener('click', () => changeScrollSpeed(5)); // +ms = più lento
    document.getElementById('btn-scroll-faster').addEventListener('click', () => changeScrollSpeed(-5)); // -ms = più veloce

    // Lettore manuale Offline locale
    const fileSelector = document.getElementById('file-selector');
    if (fileSelector) {
        fileSelector.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                originalText = event.target.result;
                document.getElementById('offline-zone').style.display = "none";
                stampaASelezionato();
            };
            reader.readAsText(files[0]);
        });
    }
});

/**
 * Carica dinamicamente il file del catalogo corretto
 */
function avviaCanzonere(tipo) {
    if (scriptConfigurato) scriptConfigurato.remove();
    
    scriptConfigurato = document.createElement("script");
    
    if (tipo === 'pop') {
        scriptConfigurato.src = "CanzoniereCatalogo.js"; // Nome file corretto
        cartellaAttiva = "CatalogoTxT/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Pop / Rock";
    } else {
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js"; // Nome file corretto
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";
    }
    
    scriptConfigurato.onload = function() {
        document.getElementById("splash-screen").style.display = "none";
        document.getElementById("menu-screen").style.display = "block";
        const input = document.getElementById('search-input');
        if(input) { input.value = ""; input.focus(); }
    };
    
    document.head.appendChild(scriptConfigurato);
}

function tornaAllaHomeSplash() {
    resetScorrimentoSicuro(); 
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("splash-screen").style.display = "block";
    if (scriptConfigurato) {
        scriptConfigurato.remove();
        scriptConfigurato = null;
    }
    if (typeof catalogoCanzoni !== 'undefined') catalogoCanzoni = [];
}

function tornaAlMenuRicerca() {
    resetScorrimentoSicuro();
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("menu-screen").style.display = "block";
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
    }
    const input = document.getElementById('search-input');
    if (input) { input.value = ""; input.focus(); }
}

/**
 * Gestione Barra di Ricerca
 */
function ricercaRapida() {
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results');
    if (!input || !resultsContainer || typeof catalogoCanzoni === 'undefined') return;
    
    const query = input.value.trim().toLowerCase();
    if (query.length < 1) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
        return;
    }
    
    let risultati = catalogoCanzoni.filter(c => 
        (c.titolo && c.titolo.toLowerCase().includes(query)) || 
        (c.autore && c.autore.toLowerCase().includes(query))
    );
    
    risultati.sort((a, b) => a.titolo.localeCompare(b.titolo));
    
    resultsContainer.innerHTML = "";
    
    if (risultati.length === 0) {
        resultsContainer.innerHTML = "<div class='search-no-result'>Nessun brano trovato</div>";
    } else {
        risultati.forEach(brano => {
            const div = document.createElement('div');
            // Usiamo la classe allineata al CSS
            div.className = 'search-item'; 
            
            // Definiamo la struttura con il titolo e l'autore isolato nel tag <small>
            const autoreTesto = brano.autore ? ` <small>${brano.autore}</small>` : "";
            div.innerHTML = `<strong>${brano.titolo}</strong>${autoreTesto}`;
            
            div.addEventListener('click', () => selezionaCanzone(brano));
            resultsContainer.appendChild(div);
        });
    }
    resultsContainer.style.display = "block";
}

/**
 * Selezione del brano dal catalogo con generazione automatica del nome file dal titolo
 */
function selezionaCanzone(brano) {
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("song-screen").style.display = "block";
    
    document.getElementById("song-title").innerText = brano.titolo;
    document.getElementById("song-author").innerText = brano.autore ? ` (${brano.autore})` : "";
    
    // STRATEGIA: Se manca la proprietà file, usiamo il titolo aggiungendo ".txt"
    // Es: "Yesterday" diventa "Yesterday.txt"
    const nomeFileReale = brano.file || brano.nomeFile || brano.url || `${brano.titolo}.txt`;
    
    document.getElementById("target-filename").innerText = nomeFileReale;
    
    currentSemitoneShift = 0;
    if (typeof aggiornaInfoTonalita === 'function') aggiornaInfoTonalita();
    
    document.getElementById("song-content").innerText = "Caricamento brano dal server...";
    
    // Costruiamo il percorso completo (es: CatalogoTxT/Yesterday.txt)
    const percorsoFile = cartellaAttiva + nomeFileReale;
    const urlAntiCache = percorsoFile + "?_=" + new Date().getTime();
    
    fetch(urlAntiCache)
        .then(response => {
            if (!response.ok) {
                throw new Error(`File non trovato sul server GitHub (Codice: ${response.status})`);
            }
            return response.text();
        })
        .then(testoOttenuto => {
            document.getElementById("offline-zone").style.display = "none";
            originalText = testoOttenuto;
            
            if (typeof stampaASelezionato === 'function') {
                stampaASelezionato();
            } else if (typeof renderChords === 'function') {
                renderChords();
            } else {
                document.getElementById("song-content").innerText = originalText;
            }
        })
        .catch(error => {
            console.error("Errore riscontrato nella Fetch:", error);
            originalText = `⚠️ ERRORE DOWNLOAD AUTOMATICO\n` +
                           `----------------------------------------\n` +
                           `Percorso cercato: ${percorsoFile}\n` +
                           `Dettaglio Errore: ${error.message}\n` +
                           `----------------------------------------\n` +
                           `⚠️ IMPORTANTE: Verifica che nella cartella '${cartellaAttiva}' su GitHub \n` +
                           `ci sia un file chiamato esattamente '${nomeFileReale}' (rispetta maiuscole e minuscole).\n\n` +
                           `Puoi comunque caricare il file manualmente da qui sotto:`;
                           
            document.getElementById("song-content").innerText = originalText;
            document.getElementById("offline-zone").style.display = "block";
        });
}
/**
 * Gestione Auto-Scroll unificato
 */
function toggleScroll() {
    const btn = document.getElementById('btn-scroll');
    if (isScrolling) {
        pausaScorrimento();
        btn.innerText = "▶ Auto-Scroll";
    } else {
        avviaScorrimento();
        btn.innerText = "⏸ Pausa";
    }
}

function avviaScorrimento() {
    if (scrollInterval) clearInterval(scrollInterval);
    isScrolling = true;
    scrollInterval = setInterval(() => {
        window.scrollBy(0, 1);
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
            pausaScorrimento();
            document.getElementById('btn-scroll').innerText = "▶ Auto-Scroll";
        }
    }, currentSpeedMs);
}

function pausaScorrimento() {
    isScrolling = false;
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
}

function changeScrollSpeed(delta) {
    currentSpeedMs += delta;
    if (currentSpeedMs < 5) currentSpeedMs = 5; 
    if (currentSpeedMs > 150) currentSpeedMs = 150; 
    
    const visualSpeed = (40 / currentSpeedMs).toFixed(1);
    document.getElementById('info-velocita').innerText = `Velocità: ${visualSpeed}x`;
    
    if (isScrolling) {
        avviaScorrimento(); 
    }
}

function resetScorrimentoSicuro() {
    pausaScorrimento();
    window.scrollTo(0, 0);
    document.getElementById('btn-scroll').innerText = "▶ Auto-Scroll";
    currentSpeedMs = 40;
    document.getElementById('info-velocita').innerText = "Velocità: 1x";
}

/**
 * Funzioni ponte per chiamare l'elaborazione del transposer
 */
function transpose(semitoni) {
    currentSemitoneShift += semitoni;
    aggiornaInfoTonalita();
    stampaASelezionato();
}

function changeNotation(notation) {
    currentNotation = notation;
    stampaASelezionato();
}

function aggiornaInfoTonalita() {
    const info = document.getElementById('info-tonalita');
    if (currentSemitoneShift === 0) {
        info.innerText = "Tonalità: Originale";
    } else {
        info.innerText = `Tonalità: ${currentSemitoneShift > 0 ? '+' : ''}${currentSemitoneShift} Semitoni`;
    }
}

// Chiama la funzione render() globale situata in transposer.js
function stampaASelezionato() {
    if (typeof render === "function") {
        render();
    }
}
