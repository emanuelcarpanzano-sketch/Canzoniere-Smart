
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
        if (scriptConfigurato) {
            scriptConfigurato.remove();
            scriptConfigurato = null;
        }

        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        scriptConfigurato.onload = function() {
            if (window.catalogoChiesa) {
                catalogoAttivoRiferimento = window.catalogoChiesa;
            } else {
                console.error("Errore: Impossibile trovare window.catalogoChiesa su window.");
                alert("Errore nel caricamento del catalogo. Verifica CanzoniereCatalogoChiesa.js");
                return;
            }

            fetch('scalettaDomenica.json')
                .then(response => {
                    if (!response.ok) throw new Error("Impossibile caricare il file della scaletta");
                    return response.json();
                })
                .then(data => {
                    document.getElementById('splash-screen').style.display = 'none';
                    document.getElementById('song-screen').style.display = 'flex'; 

                    // MOSTRIAMO IL PULSANTE NELLA BARRA IN ALTO PERCHÈ LA SCALETTA È ATTIVA
                    const btnToggle = document.getElementById('btn-toggle-scaletta');
                    if (btnToggle) btnToggle.style.display = 'block';

                    attivaScalettaLiturgica(data);
                    
                    const chiaviTempi = Object.keys(data.brani);
                    if (chiaviTempi.length > 0) {
                        const primoTempoDellaMessa = chiaviTempi[0];
                        selezionaBranoDaScalettaPerTitolo(data.brani[primoTempoDellaMessa]);
                        
                        setTimeout(() => {
                            const primoBtn = document.querySelector(".btn-scaletta-item");
                            if (primoBtn) primoBtn.classList.add("tempo-selezionato");
                        }, 50);
                    }
                })
                .catch(error => {
                    console.error("Errore nel caricamento della scaletta:", error);
                    alert("Errore nel caricamento della scaletta.");
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

    // Gestore bottone WCAG
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

    // --- SEZIONE TOGGLE DEI PANNELLI LATERALI (AGGIUNTI QUI DENTRO NATURALE) ---
    document.getElementById('btn-toggle-controls').addEventListener('click', () => {
        const ctrlPanel = document.getElementById('controls-panel');
        ctrlPanel.style.display = ctrlPanel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-toggle-scaletta').addEventListener('click', () => {
        const scalettaPanel = document.getElementById('scaletta-panel');
        scalettaPanel.style.display = scalettaPanel.style.display === 'none' ? 'block' : 'none';
    });
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



/**
 * CANZONIERE SMART - PARTE AGGIUNTIVA (LAST MINUTE OVERRIDE)
 * TRANCHE 1: GESTIONE DELLO STATO E RENDERING DINAMICO DELLA SCALETTA
 */

// Stato volatile della scaletta per le modifiche al volo del don
window.currentScaletta = null;
window.momentoInModifica = null;

/**
 * Attiva e renderizza graficamente la scaletta liturgica sul tablet.
 * Sostituisce la vecchia implementazione statica abilitando le modifiche Last Minute.
 * @param {Object} data - I dati grezzi letti dal file scalettaDomenica.json
 */
function attivaScalettaLiturgica(data) {
    // Se la variabile globale di sessione non è ancora inizializzata, copiamo i dati passati
    if (!window.currentScaletta) {
        window.currentScaletta = JSON.parse(JSON.stringify(data));
    }

    const container = document.getElementById('scaletta-panel');
    if (!container) return;

    // Svuotiamo il pannello salvando l'eventuale titolo o pulsante di chiusura se presente
    container.innerHTML = "";

    // 1. Creazione dell'Header con il titolo della Domenica
    const header = document.createElement("div");
    header.className = "scaletta-header-container";
    header.innerHTML = `
        <h3 class="scaletta-main-title" style="color: #fff; margin: 10px; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
            🟪 ${window.currentScaletta.nomeScaletta || "Scaletta Messa"}
        </h3>
    `;
    container.appendChild(header);

    // 2. Creazione della lista dei brani con approccio Object.entries (coerente con il tuo JSON piatto)
    const listaBraniContainer = document.createElement("div");
    listaBraniContainer.className = "scaletta-brani-lista";
    listaBraniContainer.style.padding = "0 10px";

    Object.entries(window.currentScaletta.brani).forEach(([chiave, titolo]) => {
        const itemRow = document.createElement("div");
        itemRow.className = "btn-scaletta-item";
        itemRow.style.display = "flex";
        itemRow.style.alignItems = "center";
        itemRow.style.justify = "space-between";
        itemRow.style.marginBottom = "10px";
        itemRow.style.padding = "8px 12px";
        itemRow.style.borderRadius = "8px";
        itemRow.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        itemRow.setAttribute("data-tempo", chiave);

        // Se questo è il brano attualmente visualizzato sullo schermo, evidenzialo
        if (momentoLiturgicoAttivo === chiave) {
            itemRow.classList.add("tempo-selezionato");
        }

        // Parte sinistra: Informazioni sul momento liturgico e titolo del canto (cliccabile per caricare il .txt)
        const infoZone = document.createElement("div");
        infoZone.className = "scaletta-item-info";
        infoZone.style.flexGrow = "1";
        infoZone.style.cursor = "pointer";
        infoZone.style.display = "flex";
        infoZone.style.flexDirection = "column";
        infoZone.innerHTML = `
            <span style="font-size: 0.75rem; font-weight: bold; opacity: 0.8; text-transform: uppercase; color: #f1c40f;">${chiave}</span>
            <span style="font-size: 1.05rem; font-weight: 500; color: #fff; margin-top: 2px;">${titolo || '<i>Scegli un brano...</i>'}</span>
        `;
        
        // Al click sulla parte testuale, si attiva il tuo meccanismo nativo di caricamento
        infoZone.addEventListener('click', () => {
            // Rimuove la classe di selezione da tutti gli altri elementi
            document.querySelectorAll(".btn-scaletta-item").forEach(el => el.classList.remove("tempo-selezionato"));
            itemRow.classList.add("tempo-selezionato");
            
            momentoLiturgicoAttivo = chiave;
            selezionaBranoDaScalettaPerTitolo(titolo);
        });

        // Parte destra: Pulsante di modifica rapida a prova di tocco errato sul tablet
        const editBtn = document.createElement("button");
        editBtn.className = "btn-override-lastminute";
        editBtn.innerHTML = "✏️";
        editBtn.style.background = "#34495e";
        editBtn.style.border = "none";
        editBtn.style.color = "white";
        editBtn.style.padding = "10px";
        editBtn.style.borderRadius = "6px";
        editBtn.style.cursor = "pointer";
        editBtn.style.marginLeft = "10px";
        editBtn.style.minWidth = "40px";
        editBtn.style.height = "40px";

        // Impediamo al click sul bottone di triggerare il click sulla riga intera
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            apriMenuSostituzione(chiave);
        });

        itemRow.appendChild(infoZone);
        itemRow.appendChild(editBtn);
        listaBraniContainer.appendChild(itemRow);
    });

    container.appendChild(listaBraniContainer);
}


/**
 * Inietta l'HTML dinamico del Bottom Sheet di sostituzione e lo mostra a schermo.
 * @param {string} chiave - La chiave della riga selezionata (es. "4) Offertorio")
 */
function apriMenuSostituzione(chiave) {
    window.momentoInModifica = chiave;
    
    let overlay = document.getElementById('lastminute-picker-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lastminute-picker-overlay';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div class="picker-sheet">
            <div class="picker-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; font-size:1.2rem; color:#2c3e50;">Cambia: <span style="color:#8e44ad;">${chiave}</span></h3>
                <button onclick="chiudiMenuSostituzione()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#7f8c8d; padding:5px 10px;">✕</button>
            </div>
            <div class="picker-search-box" style="margin-bottom:15px;">
                <input type="text" id="picker-search-input" 
                       placeholder="Scrivi per filtrare il catalogo..." 
                       autocomplete="off" spellcheck="false"
                       style="width:100%; padding:12px; font-size:1.1rem; border:2px solid #bdc3c7; border-radius:8px; box-sizing:border-box;"
                       oninput="filtraCatalogoLastMinute(this.value)">
            </div>
            <div id="picker-results-list" style="max-height:300px; overflow-y:auto; border-radius:6px; background:#f8f9fa; padding:5px;">
                <!-- Risultati iniettati dalla Tranche 2 -->
            </div>
        </div>
    `;
    
    overlay.style.display = 'flex';
    
    // Focus ritardato per tastiera tablet
    setTimeout(() => {
        const input = document.getElementById('picker-search-input');
        if (input) input.focus();
    }, 150);

    // Mostra subito l'intero catalogo per scorrimento rapido
    filtraCatalogoLastMinute('');
}

/**
 * Chiude la finestra di sostituzione e ripulisce lo stato temporaneo
 */
function chiudiMenuSostituzione() {
    const overlay = document.getElementById('lastminute-picker-overlay');
    if (overlay) overlay.style.display = 'none';
    window.momentoInModifica = null;
}

/**
 * Fine prima tranche
 */
 
 /**
 * CANZONIERE SMART - PARTE AGGIUNTIVA (LAST MINUTE OVERRIDE)
 * TRANCHE 2: FILTRAGGIO DEL CATALOGO CHIESA E SOVRASCRITTURA IN MEMORIA
 */

/**
 * Filtra in tempo reale i brani del catalogo liturgico in base al testo inserito dall'utente.
 * Sfrutta la struttura nativa a chiavi (Titoli) del tuo catalogo parrocchiale.
 * @param {string} query - Il testo digitato nella barra di ricerca del picker
 */
function filtraCatalogoLastMinute(query) {
    const listContainer = document.getElementById('picker-results-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const cleanQuery = query.toLowerCase().trim();

    // Recupera in modo sicuro il catalogo attivo della chiesa
    const catalogo = catalogoAttivoRiferimento || window.catalogoChiesa;
    
    if (!catalogo) {
        listContainer.innerHTML = '<div style="padding:15px; color:#c0392b; font-weight:bold;">Errore: Catalogo Chiesa non caricato.</div>';
        return;
    }

    // Estrae i titoli (le chiavi) presenti nel file CanzoniereCatalogoChiesa.js
    const tuttiITitoli = Object.keys(catalogo);
    
    // Filtra i titoli che contengono la query digitata
    const titoliFiltrati = tuttiITitoli.filter(titolo => 
        titolo.toLowerCase().includes(cleanQuery)
    );

    if (titoliFiltrati.length === 0) {
        listContainer.innerHTML = '<div style="padding:15px; color:#7f8c8d; text-align:center;">Nessun canto trovato nel catalogo.</div>';
        return;
    }

    // Genera i pulsanti per ogni brano corrispondente
    titoliFiltrati.forEach(titolo => {
        const rowBtn = document.createElement('button');
        rowBtn.className = 'picker-result-row';
        rowBtn.style.width = '100%';
        rowBtn.style.textAlign = 'left';
        rowBtn.style.padding = '14px 16px'; // Generoso per il tocco su tablet
        rowBtn.style.marginBottom = '6px';
        rowBtn.style.border = 'none';
        rowBtn.style.borderRadius = '6px';
        rowBtn.style.backgroundColor = '#ffffff';
        rowBtn.style.fontSize = '1.05rem';
        rowBtn.style.color = '#2c3e50';
        rowBtn.style.cursor = 'pointer';
        rowBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        rowBtn.style.display = 'block';

        rowBtn.innerHTML = `🎵 <strong>${titolo}</strong>`;

        // Al click sul brano trovato, esegue l'override immediato
        rowBtn.addEventListener('click', () => {
            confermaSostituzioneLastMinute(titolo);
        });

        listContainer.appendChild(rowBtn);
    });
}

/**
 * Applica la modifica strutturale alla scaletta attiva in memoria e aggiorna la UI
 * @param {string} nuovoTitolo - Il titolo del brano selezionato dal catalogo
 */
function confermaSostituzioneLastMinute(nuovoTitolo) {
    const chiave = window.momentoInModifica;
    
    if (!chiave || !window.currentScaletta || !window.currentScaletta.brani) {
        console.error("Impossibile applicare la modifica: stato mancante.");
        chiudiMenuSostituzione();
        return;
    }

    // 1. Applica la sovrascrittura nell'oggetto in memoria
    window.currentScaletta.brani[chiave] = nuovoTitolo;

    // 2. Forza il re-rendering visivo della sidebar liturgica con i dati aggiornati
    attivaScalettaLiturgica(window.currentScaletta);

    // 3. Se il momento modificato era proprio quello attivo a schermo,
    // carichiamo subito il nuovo spartito .txt tramite l'Auto-Fetch nativo
    if (momentoLiturgicoAttivo === chiave) {
        selezionaBranoDaScalettaPerTitolo(nuovoTitolo);
    }

    console.log(`[Last Minute] Commutato con successo [${chiave}] -> ${nuovoTitolo}`);
    
    // Chiude il pannello di controllo
    chiudiMenuSostituzione();
}

/**
 * Fine seconda tranche
 */
}
