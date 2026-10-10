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
                render(); 
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
        document.getElementById("song-title").textContent = branoTrovato.titolo;
        document.getElementById("song-author").textContent = branoTrovato.autore ? ` - ${branoTrovato.autore}` : "";
        
        const nomeFileTxt = branoTrovato.nomeFile || `${branoTrovato.titolo}.txt`;
        const targetFilename = document.getElementById("target-filename");
        if (targetFilename) {
            targetFilename.textContent = nomeFileTxt;
        }
        
        currentSemitoneShift = 0;
        document.getElementById("info-tonalita").textContent = "Tonalità: Originale";
        
        const percorsoCompletoFile = cartellaAttiva + nomeFileTxt;
        document.getElementById("song-content").textContent = "Caricamento file .txt in corso...";

        // Caricamento automatico asincrono del file .txt
        fetch(percorsoCompletoFile)
            .then(res => {
                if (!res.ok) throw new Error("File non accessibile direttamente");
                return res.text();
            })
            .then(testoEstratto => {
                originalText = testoEstratto; 
                document.getElementById('offline-zone').style.display = "none";
                render(); 
            })
            .catch(err => {
                console.log("Auto-fetch non riuscito, attivo modalità manuale:", err.message);
                originalText = "";
                document.getElementById('offline-zone').style.display = "block";
                document.getElementById("song-content").textContent = `Seleziona il file "${nomeFileTxt}" usando il bottone qui sopra per visualizzare lo spartito.`;
            });

    } else {
        alert(`Il brano "${titoloDaCercare}" non è presente nel Canzoniere.`);
    }
}

/**
 * Filtra dinamicamente i brani del catalogo attivo in base a quanto digitato dall'utente
 */
function ricercaRapida(event) {
    const stringaRicerca = event.target.value.trim().toLowerCase();
    const containerRisultati = document.getElementById('search-results');
    
    if (!containerRisultati) return;

    // Se l'input è vuoto, svuota e nascondi l'elenco dei risultati
    if (stringaRicerca.length === 0) {
        containerRisultati.innerHTML = "";
        containerRisultati.style.display = "none";
        return;
    }

    if (!catalogoAttivoRiferimento) {
        console.warn("Nessun catalogo attivo da scansionare.");
        return;
    }

    // Filtra i brani verificando la presenza della stringa nel titolo o nell'autore
    const braniFiltrati = catalogoAttivoRiferimento.filter(brano => {
        const titolo = brano.titolo ? brano.titolo.toLowerCase() : "";
        const autore = brano.autore ? brano.autore.toLowerCase() : "";
        return titolo.includes(stringaRicerca) || autore.includes(stringaRicerca);
    });

    // Svuotamento preventivo del DOM per evitare rallentamenti su tablet
    containerRisultati.innerHTML = "";

    if (braniFiltrati.length === 0) {
        containerRisultati.innerHTML = "<div class='no-results'>Nessun brano trovato</div>";
        containerRisultati.style.display = "block";
        return;
    }

    // Genera la lista dei brani trovati
    braniFiltrati.forEach(brano => {
        const elementoBrano = document.createElement('div');
        elementoBrano.className = 'search-result-item';
        elementoBrano.style.padding = "10px";
        elementoBrano.style.borderBottom = "1px solid #eee";
        elementoBrano.style.cursor = "pointer";
        
        elementoBrano.innerHTML = `<strong>${brano.titolo}</strong> ${brano.autore ? ' - ' + brano.autore : ''}`;
        
        // Al click sul brano trovato, lo carichiamo nello spartito
        elementoBrano.addEventListener('click', () => {
            document.getElementById('menu-screen').style.display = 'none';
            document.getElementById('song-screen').style.display = 'flex';
            
            // Nasconde la sidebar della scaletta se stiamo navigando dal catalogo generale
            const panelScaletta = document.getElementById("scaletta-panel");
            if (panelScaletta) panelScaletta.style.display = "none";
            
            // Sfrutta la logica di caricamento per titolo che abbiamo reso robusta
            selezionaBranoDaScalettaPerTitolo(brano.titolo);
        });

        containerRisultati.appendChild(elementoBrano);
    });

    containerRisultati.style.display = "block";
}

/**
 * Gestore per il pulsante "⬅ Elenco Brani" che pulisce gli stati e mostra il menu di ricerca
 */
function tornaAlMenuRicerca() {
    resetScorrimentoSicuro();
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("menu-screen").style.display = "block";
    
    // Rimette il focus sulla barra di ricerca per una digitazione immediata
    const input = document.getElementById('search-input');
    if (input) {
        input.value = "";
        input.focus();
    }
    
    // Nasconde i vecchi risultati della ricerca precedente
    const containerRisultati = document.getElementById('search-results');
    if (containerRisultati) {
        containerRisultati.innerHTML = "";
        containerRisultati.style.display = "none";
    }
}

/**
 * Gestore per tornare alla schermata Home / Splash pulendo gli stati di scorrimento
 */
function tornaAllaHomeSplash() {
    resetScorrimentoSicuro(); 
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("splash-screen").style.display = "block";
}

// ================= GESTIONE TRASPOSIZIONE E NOTAZIONE =================
function transpose(semitoni) {
    currentSemitoneShift += semitoni;
    let segno = currentSemitoneShift > 0 ? "+" : "";
    const infoTonalita = document.getElementById("info-tonalita");
    if (infoTonalita) {
        infoTonalita.textContent = currentSemitoneShift === 0 ? "Tonalità: Originale" : `Tonalità: ${segno}${currentSemitoneShift} Semitoni`;
    }
    render();
}

function changeNotation(notazione) {
    currentNotation = notazione;
    render();
}

// ================= GESTIONE AUTO-SCROLL INTERFACCIA =================
function toggleScroll() {
    const btn = document.getElementById("btn-scroll");
    if (!btn) return;
    
    if (isScrolling) {
        resetScorrimentoSicuro();
    } else {
        isScrolling = true;
        btn.textContent = "⏸ Pausa";
        scrollInterval = setInterval(() => {
            window.scrollBy(0, 1);
        }, currentSpeedMs);
    }
}

function changeScrollSpeed(delta) {
    currentSpeedMs += delta;
    if (currentSpeedMs < 10) currentSpeedMs = 10; // Limite di velocità massima
    if (currentSpeedMs > 150) currentSpeedMs = 150; // Limite di lentezza massima
    
    const infoVelocita = document.getElementById("info-velocita");
    if (infoVelocita) {
        let visualSpeed = Math.round((40 / currentSpeedMs) * 10) / 10;
        infoVelocita.textContent = `Velocità: ${visualSpeed}x`;
    }
    
    if (isScrolling) {
        clearInterval(scrollInterval);
        scrollInterval = setInterval(() => {
            window.scrollBy(0, 1);
        }, currentSpeedMs);
    }
}

function resetScorrimentoSicuro() {
    if (scrollInterval) clearInterval(scrollInterval);
    isScrolling = false;
    const btn = document.getElementById("btn-scroll");
    if (btn) btn.textContent = "▶ Auto-Scroll";
}

