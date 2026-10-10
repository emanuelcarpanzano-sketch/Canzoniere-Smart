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

// Inizializzazione degli eventi HTML al caricamento del DOM
window.addEventListener('DOMContentLoaded', () => {
    // Gestori della schermata Splash
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzoniere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzoniere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);

    // --- NUOVO GESTORE PER CARICARE LA SCALETTA DAL JSON (CORRETTO & CORRETTO) ---
    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', () => {
        // 1. Rimuoviamo script precedenti se presenti per evitare conflitti
        if (scriptConfigurato) {
            scriptConfigurato.remove();
            scriptConfigurato = null;
        }

        // 2. Iniettiamo dinamicamente il catalogo Chiesa con logica anti-cache
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        // 3. Eseguiamo la logica della scaletta SOLO quando il catalogo è effettivamente in memoria
        scriptConfigurato.onload = function() {
            if (window.catalogoChiesa) {
                catalogoAttivoRiferimento = window.catalogoChiesa;
            } else {
                console.error("Errore: Impossibile caricare window.catalogoChiesa.");
                alert("Errore nel caricamento del catalogo. Verifica CanzoniereCatalogoChiesa.js");
                return;
            }

            // 4. Ora che il catalogo è pronto, carichiamo il file JSON locale della scaletta
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
                    
                    // Seleziona in automatico il primo canto (Ingresso)
                    const primoTempo = Object.keys(data.brani)[0];
                    if (primoTempo) {
                        selezionaBranoDaScalettaPerTitolo(data.brani[primoTempo]);
                        
                        // Evidenzia visivamente il primo bottone generato
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

    // --- AGGIUNTO QUESTO EVENTO PER IL BOTTONE WCAG ---
    const btnWcag = document.getElementById('btn-wcag-toggle');
    if (btnWcag) {
        btnWcag.addEventListener('click', function() {
            // Inverte lo stato booleano (definito in transposer.js)
            wcagCompattatoAttivo = !wcagCompattatoAttivo;
            
            // Aggiunge o rimuove una classe CSS per colorare il bottone quando attivo
            this.classList.toggle("attivo-accessibile", wcagCompattatoAttivo);
            
            // Sfrutta il motore esistente per ripulire e stampare nuovamente lo spartito
            render();
        });
    }
    
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
    
    // 3. Configurazione dinamica dei percorsi e delle chiavi inserite su window
    let sorgenteScript = "";
    let chiaveFinestra = "";
    
    if (tipo === 'pop') {
        sorgenteScript = "CanzoniereCatalogo.js";
        chiaveFinestra = "catalogoPopRock"; // Corrisponde a window.catalogoPopRock
        cartellaAttiva = "CatalogoTxT/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Pop / Rock";
    } else {
        sorgenteScript = "CanzoniereCatalogoChiesa.js";
        chiaveFinestra = "catalogoChiesa";   // Corrisponde a window.catalogoChiesa
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";
    }
    
    // 4. Generazione del tag script con stringa dinamica anti-cache (?_=timestamp)
    scriptConfigurato = document.createElement("script");
    scriptConfigurato.src = sorgenteScript + "?_=" + new Date().getTime();
    
    // 5. Callback ad iniezione completata ed eseguita in memoria
    scriptConfigurato.onload = function() {
        // Leggiamo la proprietà dinamica da window assegnandola al riferimento sicuro
        if (window[chiaveFinestra]) {
            catalogoAttivoRiferimento = window[chiaveFinestra];
        } else {
            console.error("Errore: Impossibile trovare la chiave " + chiaveFinestra + " su window.");
        }

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
    
    // Rimozione dello script e svuotamento del riferimento di ricerca
    if (scriptConfigurato) {
        scriptConfigurato.remove();
        scriptConfigurato = null;
    }
    catalogoAttivoRiferimento = null;
    
    // Pulizia visiva dei vecchi risultati di ricerca rimasti appesi nel DOM
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
    }
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
 * CANZONIERE SMART - LOGICA APPLICATIVA E DI CONTROLLO CENTRALIZZATA
 * PARTE 2: MOTORE DI RICERCA, GESTIONE BRANI E CONTROLLO AUTO-SCROLL
 */

/**
 * Gestione Barra di Ricerca Centralizzata
 */
function ricercaRapida() {
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results');
    if (!input || !resultsContainer || !catalogoAttivoRiferimento) return;
    
    const query = input.value.trim().toLowerCase();
    if (query.length < 1) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
        return;
    }
    
    let risultati = catalogoAttivoRiferimento.filter(c => 
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
            div.className = 'search-item'; 
            
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
    
    const nomeFileReale = `${brano.titolo}.txt`;
    document.getElementById("target-filename").innerText = nomeFileReale;
    
    currentSemitoneShift = 0;
    if (typeof aggiornaInfoTonalita === 'function') aggiornaInfoTonalita();
    
    document.getElementById("song-content").innerText = "Caricamento brano dal server...";
    
    const percorsoFile = cartellaAttiva + nomeFileReale;
    const urlAntiCache = percorsoFile + "?_=" + new Date().getTime();
    
    fetch(urlAntiCache)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Risposta del server NON valida (Codice HTTP: ${response.status})`);
            }
            return response.text();
        })
        .then(testoOttenuto => {
            document.getElementById("offline-zone").style.display = "none";
            originalText = testoOttenuto;
            
            if (typeof stampaASelezionato === 'function') {
                stampaASelezionato();
            } else {
                document.getElementById("song-content").innerText = originalText;
            }
        })
        .catch(error => {
            console.error("Errore riscontrato nella Fetch:", error);
            document.getElementById("song-content").innerText = "Errore di caricamento. Usa il selettore offline.";
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

/**
 * Aggiorna l'etichetta visiva della tonalità corrente sul DOM
 */
function aggiornaInfoTonalita() {
    const info = document.getElementById('info-tonalita');
    if (!info) return;
    if (currentSemitoneShift === 0) {
        info.innerText = "Tonalità: Originale";
    } else {
        info.innerText = `Tonalità: ${currentSemitoneShift > 0 ? '+' : ''}${currentSemitoneShift} Semitoni`;
    }
}

function stampaASelezionato() {
    if (typeof render === "function") {
        render();
    }
}

// Stato della scaletta attiva nel sistema
let scalettaCorrenteData = null;
let momentoLiturgicoAttivo = null; 

/**
 * Carica e renderizza una scaletta liturgica da una struttura dati JSON
 * @param {Object} jsonScaletta - Il file o l'oggetto JSON della scaletta
 */
function attivaScalettaLiturgica(jsonScaletta) {
    scalettaCorrenteData = jsonScaletta;
    
    const panel = document.getElementById("scaletta-panel");
    const titoloScaletta = document.getElementById("scaletta-nome-titolo");
    const containerBottoni = document.getElementById("scaletta-bottoni-container");
    
    if (!panel || !containerBottoni) return;

    // Imposta il titolo e svuota vecchi pulsanti per evitare memory leak sul tablet
    titoloScaletta.textContent = jsonScaletta.nomeScaletta;
    containerBottoni.innerHTML = "";
    
    // Mostra il pannello della scaletta
    panel.style.display = "block";

    // Cicla sui brani definiti nel JSON e genera i pulsanti della sequenza liturgica
    Object.keys(jsonScaletta.brani).forEach(tempo => {
        const nomeCanzone = jsonScaletta.brani[tempo];
        
        const btn = document.createElement("button");
        btn.className = "btn-scaletta-item";
        btn.innerHTML = `<span class="tempo-label">${tempo}</span><br><span class="titolo-label">${nomeCanzone}</span>`;
        
        // Evento di selezione del tempo liturgico al click sul tablet
        btn.addEventListener("click", () => {
            // Rimuove la classe attiva dai vecchi bottoni della scaletta e la assegna al corrente
            document.querySelectorAll(".btn-scaletta-item").forEach(b => b.classList.remove("tempo-selezionato"));
            btn.classList.add("tempo-selezionato");
            
            momentoLiturgicoAttivo = tempo;
            selezionaBranoDaScalettaPerTitolo(nomeCanzone);
        });
        
        containerBottoni.appendChild(btn);
    });
}

/**
 * Cerca un brano nel catalogo attivo usando solo il titolo e lo invia al rendering
 * @param {string} titoloDaCercare - Il titolo esatto scritto nel JSON
 */
function selezionaBranoDaScalettaPerTitolo(titoloDaCercare) {
    if (!catalogoAttivoRiferimento) {
        console.error("Nessun catalogo attivo configurato.");
        return;
    }
    
    // Normalizzazione per evitare problemi di maiuscole/minuscole o spazi extra
    const titoloPulito = titoloDaCercare.trim().toLowerCase();
    
    // Ricerca nel catalogo attivo (Pop/Rock o Chiesa legato a window)
    const branoTrovato = catalogoAttivoRiferimento.find(brano => 
        brano.titolo.trim().toLowerCase() === titoloPulito
    );
    
    if (branoTrovato) {
        // Assegna il brano trovato alla variabile che usi per tracciare lo spartito corrente
        // e imposta il testo originale per far lavorare il Transposer
        originalText = branoTrovato.testoGrezzo || branoTrovato.testo || ""; 
        
        // Aggiorna i testi dell'interfaccia utente
        document.getElementById("song-title").textContent = branoTrovato.titolo;
        document.getElementById("song-author").textContent = branoTrovato.autore ? ` - ${branoTrovato.autore}` : "";
        
        // Se usi la modalità offline locale, prepariamo il nome file atteso
        const targetFilename = document.getElementById("target-filename");
        if (targetFilename) {
            targetFilename.textContent = branoTrovato.nomeFile || `${branoTrovato.titolo}.txt`;
        }
        
        // Resetta lo shift del transposer all'ingresso di un nuovo brano per sicurezza
        currentSemitoneShift = 0;
        document.getElementById("info-tonalita").textContent = "Tonalità: Originale";
        
        // Esegue il rendering finale dello spartito (gestito da transposer.js)
        render();
    } else {
        alert(`Attenzione: Il brano "${titoloDaCercare}" non è stato trovato nel catalogo attualmente attivo.`);
    }
}



