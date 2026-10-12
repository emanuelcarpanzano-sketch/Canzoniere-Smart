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

