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

    // --- GESTORE SCALETTA CON MESSAGGI DI CONTROLLO ---
    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', () => {
        console.log("👉 PASSO 1: Pulsante viola cliccato!");

        if (scriptConfigurato) {
            scriptConfigurato.remove();
            scriptConfigurato = null;
        }

        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        scriptConfigurato.onload = function() {
            console.log("👉 PASSO 2: Script CanzoniereCatalogoChiesa.js caricato in memoria!");
            
            if (window.catalogoChiesa) {
                catalogoAttivoRiferimento = window.catalogoChiesa;
                console.log("👉 PASSO 3: Il catalogo Chiesa è valido! Numero brani:", catalogoAttivoRiferimento.length);
            } else {
                console.error("❌ ERRORE al PASSO 3: window.catalogoChiesa è undefined!");
                alert("Errore: il catalogo Chiesa non è stato popolato correttamente.");
                return;
            }

            console.log("👉 PASSO 4: Avvio la fetch di scalettaDomenica.json...");
            fetch('scalettaDomenica.json')
                .then(response => {
                    if (!response.ok) throw new Error("File scalettaDomenica.json non trovato o non accessibile");
                    return response.json();
                })
                .then(data => {
                    console.log("👉 PASSO 5: JSON della scaletta scaricato con successo!", data);
                    
                    document.getElementById('splash-screen').style.display = 'none';
                    document.getElementById('song-screen').style.display = 'flex'; 

                    attivaScalettaLiturgica(data);
                    console.log("👉 PASSO 6: Barra laterale della scaletta iniettata nel DOM!");
                    
                    const chiaviTempi = Object.keys(data.brani);
                    if (chiaviTempi.length > 0) {
                        const primoTempoDellaMessa = chiaviTempi[0];
                        const primoTitolo = data.brani[primoTempoDellaMessa];
                        console.log(`👉 PASSO 7: Provo a caricare in automatico il primo brano: "${primoTitolo}"`);
                        
                        selezionaBranoDaScalettaPerTitolo(primoTitolo);
                    }
                })
                .catch(error => {
                    console.error("❌ ERRORE nel flusso della scaletta o nella fetch:", error);
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
}); // Fine di DOMContentLoaded


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
/**
 * Cerca un brano nel catalogo attivo usando solo il titolo e tenta il caricamento automatico o manuale del TXT
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
        // Aggiorna l'interfaccia con i metadati
        document.getElementById("song-title").textContent = branoTrovato.titolo;
        document.getElementById("song-author").textContent = branoTrovato.autore ? ` - ${branoTrovato.autore}` : "";
        
        // Determina il nome del file .txt atteso (es. "Ecco lo sposo.txt")
        // Se nel tuo catalogo JS c'è una proprietà specifica (es. branoTrovato.nomeFile) usa quella, altrimenti il titolo
        const nomeFileTxt = branoTrovato.nomeFile || `${branoTrovato.titolo}.txt`;
        
        const targetFilename = document.getElementById("target-filename");
        if (targetFilename) {
            targetFilename.textContent = nomeFileTxt;
        }
        
        currentSemitoneShift = 0;
        document.getElementById("info-tonalita").textContent = "Tonalità: Originale";
        
        // Costruiamo il percorso completo del file (es: "CatalogoTxTChiesa/Ecco lo sposo.txt")
        const percorsoCompletoFile = cartellaAttiva + nomeFileTxt;
        
        document.getElementById("song-content").textContent = "Caricamento file .txt in corso...";

        // --- TENTATIVO DI CARICAMENTO AUTOMATICO ---
        fetch(percorsoCompletoFile)
            .then(res => {
                if (!res.ok) throw new Error("File non accessibile direttamente");
                return res.text();
            })
            .then(testoEstratto => {
                // Se il fetch automatico ha successo, carichiamo il testo e disegnamo lo spartito
                originalText = testoEstratto;
                document.getElementById('offline-zone').style.display = "none";
                render();
            })
            .catch(err => {
                // Se fallisce (es. protocollo file:// locale del tablet senza server), passiamo al selettore manuale
                console.log("Richiesta diretta fallita, attivo selettore manuale locale:", err.message);
                originalText = "";
                document.getElementById('offline-zone').style.display = "block";
                document.getElementById("song-content").textContent = `Seleziona il file "${nomeFileTxt}" usando il bottone qui sopra per visualizzare lo spartito.`;
            });

    } else {
        alert(`Il brano "${titoloDaCercare}" non è presente nel Canzoniere Liturgico.`);
    }
}

function tornaAllaHomeSplash() {
    resetScorrimentoSicuro(); 
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("splash-screen").style.display = "block";
}

// Stub di sicurezza per funzioni richiamate dagli eventi del DOM
function ricercaRapida() { /* Lascia intatta la tua funzione di ricerca originale in questo punto */ }
function tornaAlMenuRicerca() {
    resetScorrimentoSicuro();
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("menu-screen").style.display = "block";
}
function transpose(semitoni) { /* Lascia intatta la tua funzione transpose originale in questo punto */ }
function changeNotation(tipo) { /* Lascia intatta la tua funzione changeNotation originale in questo punto */ }
function toggleScroll() { /* Lascia intatta la tua funzione toggleScroll originale in questo punto */ }
function changeScrollSpeed(delta) { /* Lascia intatta la tua funzione changeScrollSpeed originale in questo punto */ }
function resetScorrimentoSicuro() { if(scrollInterval) clearInterval(scrollInterval); isScrolling = false; }


