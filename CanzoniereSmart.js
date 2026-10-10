/**
 * CANZONIERE SMART - LOGICA APPLICATIVA E DI CONTROLLO CENTRALIZZATA
 * PARTE 1: STATI GENERALI, EVENTI DOM E CARICAMENTO REPERTORI
 */

// Stati globali condivisi con transposer.js
let currentNotation = 'IT';
let originalText = ""; 
let currentSemitoneShift = 0;

// Variabili di configurazione dei cataloghi dinamici
let cartellaAttiva = "";     
let scriptConfigurato = null; 
let catalogoAttivoRiferimento = null; // Riferimento sicuro per la ricerca senza crash di cache

// Stati dell'Auto-Scroll
let scrollInterval = null;
let currentSpeedMs = 40; // Millisecondi tra gli step (meno ms = più veloce)
let isScrolling = false;

// Stato della scaletta attiva nel sistema
let scalettaCorrenteData = null;
let momentoLiturgicoAttivo = null; 

// Inizializzazione degli eventi HTML al caricamento del DOM
window.addEventListener('DOMContentLoaded', () => {
    // Gestori della schermata Splash
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzoniere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzoniere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);

    // --- GESTORE PER CARICARE LA SCALETTA DAL JSON CON INIEZIONE DINAMICA ---
    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', () => {
        // 1. Rimuoviamo script precedenti se presenti per evitare conflitti di ridefinizione
        if (scriptConfigurato) {
            scriptConfigurato.remove();
            scriptConfigurato = null;
        }

        // 2. Prepariamo la configurazione e i percorsi per il catalogo liturgico
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        // 3. Iniettiamo dinamicamente il catalogo Chiesa con stringa dinamica anti-cache
        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        // 4. Eseguiamo la logica solo quando lo script del catalogo è completamente caricato in memoria
        scriptConfigurato.onload = function() {
            if (window.catalogoChiesa) {
                catalogoAttivoRiferimento = window.catalogoChiesa;
            } else {
                console.error("Errore: Impossibile trovare window.catalogoChiesa su window.");
                alert("Errore nel caricamento del catalogo. Verifica CanzoniereCatalogoChiesa.js");
                return;
            }

            // 5. Carichiamo in modo asincrono il file JSON locale della scaletta
            fetch('scalettaDomenica.json')
                .then(response => {
                    if (!response.ok) throw new Error("Impossibile caricare il file della scaletta");
                    return response.json();
                })
                .then(data => {
                    // Nasconde la Home e mostra lo spartito
                    document.getElementById('splash-screen').style.display = 'none';
                    document.getElementById('song-screen').style.display = 'flex'; 

                    // Inizializza graficamente la barra laterale con i tempi liturgici
                    attivaScalettaLiturgica(data);
                    
                    // Seleziona in automatico il primo canto (Ingresso) per non mostrare la pagina vuota
                    const chiaviTempi = Object.keys(data.brani);
                    if (chiaviTempi.length > 0) {
                        const primoTempoDellaMessa = chiaviTempi[0];
                        selezionaBranoDaScalettaPerTitolo(data.brani[primoTempoDellaMessa]);
                        
                        // Evidenzia visivamente il primo bottone generato nella barra laterale
                        setTimeout(() => {
                            const primoBtn = document.querySelector(".btn-scaletta-item");
                            if (primoBtn) primoBtn.classList.add("tempo-selezionato");
                        }, 50);
                    }
                })
                .catch(error => {
                    console.error("Errore nel caricamento della scaletta:", error);
                    alert("Errore nel caricamento della scaletta. Controlla che il file 'scalettaDomenica.json' sia nella cartella corretta.");
                });
        };

        document.head.appendChild(scriptConfigurato);
    });

    // Gestori della barra di ricerca e navigazione
    document.getElementById('search-input').addEventListener('input', ricercaRapida);
    document.getElementById('btn-elenco-brani').addEventListener('click', tornaAlMenuRicerca);
    
    // Gestori del transposer e della notazione
    document.getElementById('btn-transpose-meno').addEventListener('click', () => transpose(-1));
    document.getElementById('btn-transpose-piu').addEventListener('click', () => transpose(1));
    document.getElementById('radio-it').addEventListener('click', () => changeNotation('IT'));
    document.getElementById('radio-en').addEventListener('click', () => changeNotation('EN'));

    // GESTORE PER IL BOTTONE WCAG COMPATTA TESTO 80 CARATTERI
    const btnWcag = document.getElementById('btn-wcag-toggle');
    if (btnWcag) {
        btnWcag.addEventListener('click', function() {
            wcagCompattatoAttivo = !wcagCompattatoAttivo;
            this.classList.toggle("attivo-accessibile", wcagCompattatoAttivo);
            render();
        });
    }
    
    // Gestori per i controlli dell'Auto-Scroll
    document.getElementById('btn-scroll').addEventListener('click', toggleScroll);
    document.getElementById('btn-scroll-slower').addEventListener('click', () => changeScrollSpeed(5));
    document.getElementById('btn-scroll-faster').addEventListener('click', () => changeScrollSpeed(-5));

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
                stampaASelezionato(); // Sostituire con render() se stampaASelezionato non è definita altrove
            };
            reader.readAsText(files[0]);
        });
    }
});


/**
 * Carica dinamicamente il file del catalogo corretto con logica anti-cache attiva
 */
function avviaCanzoniere(tipo) {
    // 1. Rimuoviamo in modo sicuro lo script precedente se esistente nel DOM
    if (scriptConfigurato) {
        scriptConfigurato.remove();
        scriptConfigurato = null;
    }
    
    // 2. Pulizia preventiva dello stato della ricerca precedente
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
    }
    
    // Nelle normali navigazioni da catalogo nascondiamo il pannello scaletta per pulizia UI
    const panel = document.getElementById("scaletta-panel");
    if (panel) panel.style.display = "none";
    
    // 3. Configurazione dinamica dei percorsi e delle chiavi inserite su window
    let sorgenteScript = "";
    let chiaveFinestra = "";
    
    if (tipo === 'pop') {
        sorgenteScript = "CanzoniereCatalogo.js";
        chiaveFinestra = "catalogoPopRock"; 
        cartellaAttiva = "CatalogoTxT/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Pop / Rock";
    } else {
        sorgenteScript = "CanzoniereCatalogoChiesa.js";
        chiaveFinestra = "catalogoChiesa";   
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";
    }
    
    // 4. Generazione del tag script con stringa dinamica anti-cache
    scriptConfigurato = document.createElement("script");
    scriptConfigurato.src = sorgenteScript + "?_=" + new Date().getTime();
    
    // 5. Callback ad iniezione completata ed eseguita in memoria
    scriptConfigurato.onload = function() {
        if (window[chiaveFinestra]) {
            catalogoAttivoRiferimento = window[chiaveFinestra];
        } else {
            console.error("Errore: Impossibile trovare la chiave " + chiaveFinestra + " su window.");
        }

        document.getElementById("splash-screen").style.display = "none";
        document.getElementById("menu-screen").style.display = "block";
        document.getElementById("song-screen").style.display = "none";
        const input = document.getElementById('search-input');
        if(input) { input.value = ""; input.focus(); }
    };
    
    document.head.appendChild(scriptConfigurato);
}

/**
 * Inizializza graficamente la barra laterale con i tempi liturgici
 */
function attivaScalettaLiturgica(jsonScaletta) {
    scalettaCorrenteData = jsonScaletta;
    
    const panel = document.getElementById("scaletta-panel");
    const titoloScaletta = document.getElementById("scaletta-nome-titolo");
    const containerBottoni = document.getElementById("scaletta-bottoni-container");
    
    if (!panel || !containerBottoni) return;

    titoloScaletta.textContent = jsonScaletta.nomeScaletta;
    containerBottoni.innerHTML = "";
    
    panel.style.display = "block";

    Object.keys(jsonScaletta.brani).forEach(tempo => {
        const nomeCanzone = jsonScaletta.brani[tempo];
        
        const btn = document.createElement("button");
        btn.className = "btn-scaletta-item";
        btn.innerHTML = `<span class="tempo-label">${tempo}</span><br><span class="titolo-label">${nomeCanzone}</span>`;
        
        btn.addEventListener("click", () => {
            document.querySelectorAll(".btn-scaletta-item").forEach(b => b.classList.remove("tempo-selezionato"));
            btn.classList.add("tempo-selezionato");
            
            momentoLiturgicoAttivo = tempo;
            selezionaBranoDaScalettaPerTitolo(nomeCanzone);
        });
        
        containerBottoni.appendChild(btn);
    });
}

/**
 * Cerca un brano nel catalogo attivo usando solo il titolo e gestisce l'assegnazione adattiva del testo
 */
function selezionaBranoDaScalettaPerTitolo(titoloDaCercare) {
    if (!catalogoAttivoRiferimento) {
        console.error("Nessun catalogo attivo configurato.");
        return;
    }
    
    const titoloPulito = titoloDaCercare.trim().toLowerCase();
    
    const branoTrovato = catalogoAttivoRiferimento.find(brano => 
        brano.titolo.trim().toLowerCase() === titoloPulito
    );
    
    if (branoTrovato) {
        // Lettura robusta sia per .testo che per .testoGrezzo
        originalText = branoTrovato.testo || branoTrovato.testoGrezzo || ""; 
        
        document.getElementById("song-title").textContent = branoTrovato.titolo;
        document.getElementById("song-author").textContent = branoTrovato.autore ? ` - ${branoTrovato.autore}` : "";
        
        const targetFilename = document.getElementById("target-filename");
        if (targetFilename) {
            targetFilename.textContent = branoTrovato.nomeFile || `${branoTrovato.titolo}.txt`;
        }
        
        currentSemitoneShift = 0;
        document.getElementById("info-tonalita").textContent = "Tonalità: Originale";
        
        // Esegue il rendering attraverso il motore integrato in transposer.js
        render();
    } else {
        console.warn(`Brano non trovato nel catalogo: ${titoloDaCercare}`);
        alert(`Il brano "${titoloDaCercare}" non è presente nel Canzoniere Liturgico caricato.`);
    }
}

function tornaAllaHomeSplash() {
    resetScorrimentoSicuro(); 
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("splash-screen").style.display = "block";
}

// Stub di sicurezza per funzioni di ricerca / scorrimento richiamate dagli eventi
function ricercaRapida() { /* TUA LOGICA DI RICERCA ESISTENTE - LASCIA IL TUO CODICE ORIGINALE */ }
function tornaAlMenuRicerca() {
    resetScorrimentoSicuro();
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("menu-screen").style.display = "block";
}
function transpose(semitoni) { /* TUA LOGICA TRANSPOSE ESISTENTE - LASCIA IL TUO CODICE ORIGINALE */ }
function changeNotation(tipo) { /* TUA LOGICA NOTATION ESISTENTE - LASCIA IL TUO CODICE ORIGINALE */ }
function toggleScroll() { /* TUA LOGICA SCROLL ESISTENTE - LASCIA IL TUO CODICE ORIGINALE */ }
function changeScrollSpeed(delta) { /* TUA LOGICA VELOCITA ESISTENTE - LASCIA IL TUO CODICE ORIGINALE */ }
function resetScorrimentoSicuro() { if(scrollInterval) clearInterval(scrollInterval); isScrolling = false; }



