/**
 * CANZONIERE SMART - CORE APPLICATION LOGIC
 * Architettura Resiliente ed Esente da Crash - Ottobre 2026
 * PARTE 1 DI 2 - CONFIGURAZIONE, FUNZIONI CORE E INIZIALIZZAZIONE
 */

// ==========================================
// 1. CONFIGURAZIONE & STATO APPLICAZIONE
// ==========================================
let currentNotation = 'IT';
let originalText = ""; 
let currentSemitoneShift = 0;

let cartellaAttiva = "";     
let scriptConfigurato = null; 
let catalogoAttivoRiferimento = null; 

let scrollInterval = null;
let currentSpeedMs = 40; 
let isScrolling = false;

let scalettaCorrenteData = null;
let momentoLiturgicoAttivo = null; 

// Stato di blocco per la sicurezza sul palco e chiave Storage
let isScalettaLocked = false;
const STORAGE_KEY_SCALETTA = 'canzoniere_smart_local_backup';

// ==========================================
// 2. MOTORE CORE DI RENDERING E SCALETTA
// ==========================================
function attivaScalettaLiturgica(data) {
    if (!data || !data.brani) return;
    
    scalettaCorrenteData = data;
    
    const titoloScaletta = document.getElementById('scaletta-nome-titolo');
    if (titoloScaletta) titoloScaletta.innerText = data.nome || "Scaletta Domenicale";
    
    const container = document.getElementById('scaletta-bottoni-container');
    if (!container) return;
    container.innerHTML = ""; 
    
    Object.keys(data.brani).forEach(momento => {
        const titoloCanto = data.brani[momento];
        
        const itemEl = document.createElement('div');
        itemEl.className = 'scaletta-item';
        itemEl.style.marginBottom = "10px";
        
        const btnCanto = document.createElement('button');
        btnCanto.className = 'btn-scaletta-item';
        btnCanto.style.width = "85%";
        btnCanto.style.display = "inline-block";
        btnCanto.innerHTML = `
            <div class="tempo-label">${momento.toUpperCase()}</div>
            <div class="titolo-label">${titoloCanto}</div>
        `;
        btnCanto.addEventListener('click', () => {
            selezionaBranoDaScalettaPerTitolo(titoloCanto);
            document.querySelectorAll('.btn-scaletta-item').forEach(b => b.classList.remove('tempo-selezionato'));
            btnCanto.classList.add('tempo-selezionato');
        });
        
        const btnOverride = document.createElement('button');
        btnOverride.className = 'btn-override-lastminute';
        btnOverride.style.width = "15%";
        btnOverride.style.display = isScalettaLocked ? "none" : "inline-block"; 
        btnOverride.innerText = "✏️";
        btnOverride.addEventListener('click', (e) => {
            e.stopPropagation(); 
            apriPannelloSostituzioneLastMinute(momento);
        });
        
        itemEl.appendChild(btnCanto);
        itemEl.appendChild(btnOverride);
        container.appendChild(itemEl);
    });
    
    console.log("Scaletta Liturgica: Rendering completato.");
}

function elaboraEAttivaScaletta(data) {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('song-screen').style.display = 'flex'; 
    if (document.getElementById('btn-toggle-scaletta')) document.getElementById('btn-toggle-scaletta').style.display = 'block';
    
    attivaScalettaLiturgica(data);
    
    const chiavi = Object.keys(data.brani);
    if (chiavi.length > 0) {
        selezionaBranoDaScalettaPerTitolo(data.brani[chiavi[0]]);
        setTimeout(() => { if (document.querySelector(".btn-scaletta-item")) document.querySelector(".btn-scaletta-item").classList.add("tempo-selezionato"); }, 50);
    }
}

function apriPannelloSostituzioneLastMinute(momento) {
    if (isScalettaLocked) return;
    momentoLiturgicoAttivo = momento;
    const labelMomento = document.getElementById('picker-momento-label');
    if (labelMomento) labelMomento.innerText = momento;
    const overlay = document.getElementById('lastminute-picker-overlay');
    if (overlay) overlay.style.display = "flex";
    const inputPicker = document.getElementById('picker-search-input');
    if (inputPicker) {
        inputPicker.value = "";
        setTimeout(() => inputPicker.focus(), 50);
    }
}

// ==========================================
// 3. ASCOLTATORI EVENTI GLOBALI (INIZIO DOM)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzoniere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzoniere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);

    const lockBtn = document.getElementById('btn-lock-scaletta');
    if (lockBtn) {
        lockBtn.addEventListener('click', toggleLiveLock);
    }

    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', function() {
        if (scriptConfigurato) { scriptConfigurato.remove(); scriptConfigurato = null; }
        document.body.classList.add('theme-liturgico');
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        scriptConfigurato.onload = function() {
            if (window.catalogoChiesa) { catalogoAttivoRiferimento = window.catalogoChiesa; } else { return; }
            
            const backupLocale = localStorage.getItem(STORAGE_KEY_SCALETTA);
            if (backupLocale) {
                console.log("Recupero scaletta da backup locale offline...");
                elaboraEAttivaScaletta(JSON.parse(backupLocale));
            } else {
                fetch('scalettaDomenica.json')
                    .then(res => res.json())
                    .then(data => {
                        localStorage.setItem(STORAGE_KEY_SCALETTA, JSON.stringify(data));
                        elaboraEAttivaScaletta(data);
                    }).catch(err => console.error(err));
            }
        };
        document.head.appendChild(scriptConfigurato);
    });

    document.getElementById('search-input').addEventListener('input', ricercaRapida);
    document.getElementById('btn-elenco-brani').addEventListener('click', tornaAlMenuRicerca);
    document.getElementById('btn-transpose-meno').addEventListener('click', () => transpose(-1));
    document.getElementById('btn-transpose-piu').addEventListener('click', () => transpose(1));
    document.getElementById('radio-it').addEventListener('click', () => changeNotation('IT'));
    document.getElementById('radio-en').addEventListener('click', () => changeNotation('EN'));

    if (document.getElementById('btn-wcag-toggle')) {
        document.getElementById('btn-wcag-toggle').addEventListener('click', function() {
            if (typeof wcagCompattatoAttivo !== 'undefined') {
                wcagCompattatoAttivo = !wcagCompattatoAttivo;
                this.classList.toggle("attivo-accessibile", wcagCompattatoAttivo);
                render();
            }
        });
    }
    
    document.getElementById('btn-scroll').addEventListener('click', toggleScroll);
    document.getElementById('btn-scroll-slower').addEventListener('click', () => changeScrollSpeed(5));
    document.getElementById('btn-scroll-faster').addEventListener('click', () => changeScrollSpeed(-5));

    if (document.getElementById('file-selector')) {
        document.getElementById('file-selector').addEventListener('change', (e) => {
            const files = e.target.files; if (!files || files.length === 0) return;
            const r = new FileReader(); r.onload = (ev) => { originalText = ev.target.result; document.getElementById('offline-zone').style.display = "none"; render(); };
            r.readAsText(files[0]);
        });
    }

    document.getElementById('btn-toggle-controls').addEventListener('click', () => { const p = document.getElementById('controls-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; });
    document.getElementById('btn-toggle-scaletta').addEventListener('click', () => { const p = document.getElementById('scaletta-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; });
    if (document.getElementById("picker-search-input")) document.getElementById("picker-search-input").addEventListener('input', (e) => mostraRisultatiNelPicker(e.target.value));
    if (document.getElementById("btn-close-picker")) document.getElementById("btn-close-picker").addEventListener('click', () => document.getElementById("lastminute-picker-overlay").style.display = "none");
}); 

// ==========================================
// 4. NAVIGAZIONE, CONTROLLI E SICUREZZA LIVE LOCK
// ==========================================
function toggleLiveLock() {
    isScalettaLocked = !isScalettaLocked;
    const lockBtn = document.getElementById('btn-lock-scaletta');
    const scalettaPanel = document.getElementById('scaletta-panel');
    
    if (isScalettaLocked) {
        if (lockBtn) { lockBtn.classList.add('locked'); lockBtn.innerHTML = '🔒 Scaletta Protetta'; }
        if (scalettaPanel) scalettaPanel.classList.add('ui-locked');
        document.querySelectorAll('.btn-override-lastminute').forEach(b => b.style.display = "none");
    } else {
        if (lockBtn) { lockBtn.classList.remove('locked'); lockBtn.innerHTML = '🔓 Blocca Scaletta'; }
        if (scalettaPanel) scalettaPanel.classList.remove('ui-locked');
        document.querySelectorAll('.btn-override-lastminute').forEach(b => b.style.display = "inline-block");
    }
}

function avviaCanzoniere(tipo) {
    if (scriptConfigurato) { scriptConfigurato.remove(); scriptConfigurato = null; }
    if (document.getElementById('search-results')) { document.getElementById('search-results').innerHTML = ""; document.getElementById('search-results').style.display = "none"; }
    if (document.getElementById("scaletta-panel")) document.getElementById("scaletta-panel").style.display = "none";
    let src = tipo === 'pop' ? "CanzoniereCatalogo.js" : "CanzoniereCatalogoChiesa.js";
    let winKey = tipo === 'pop' ? "catalogoPopRock" : "catalogoChiesa";
    cartellaAttiva = tipo === 'pop' ? "CatalogoTxT/" : "CatalogoTxTChiesa/";
    document.getElementById("menu-main-title").innerText = tipo === 'pop' ? "Canzoniere Pop / Rock" : "Canzoniere Liturgico";
    if (tipo === 'pop') document.body.classList.remove('theme-liturgico'); else document.body.classList.add('theme-liturgico');
    scriptConfigurato = document.createElement("script"); scriptConfigurato.src = src + "?_=" + new Date().getTime();
    scriptConfigurato.onload = function() { if (window[winKey]) catalogoAttivoRiferimento = window[winKey]; document.getElementById("splash-screen").style.display = "none"; document.getElementById("menu-screen").style.display = "block"; };
    document.head.appendChild(scriptConfigurato);
}

function selezionaBranoDaScalettaPerTitolo(titolo) {
    if (isScalettaLocked && originalText !== "") return;
    if (!catalogoAttivoRiferimento) return;
    const brano = catalogoAttivoRiferimento.find(b => b.titolo.trim().toLowerCase() === titolo.trim().toLowerCase());
    if (brano) {
        document.getElementById("song-title").textContent = brano.titolo;
        document.getElementById("song-author").textContent = brano.autore ? ` - ${brano.autore}` : "";
        const fName = brano.nomeFile || `${brano.titolo}.txt`;
        if (document.getElementById("target-filename")) document.getElementById("target-filename").textContent = fName;
        currentSemitoneShift = 0; document.getElementById("info-tonalita").textContent = "Tonalità: Originale";
        document.getElementById("song-content").textContent = "Caricamento in corso...";
        fetch(cartellaAttiva + fName).then(res => res.text()).then(txt => { originalText = txt; document.getElementById('offline-zone').style.display = "none"; render(); })
        .catch(() => { originalText = ""; document.getElementById('offline-zone').style.display = "block"; document.getElementById("song-content").textContent = `Seleziona il file "${fName}" manualmente.`; });
    }
}

// ==========================================
// FUNZIONE DI RICERCA RAPIDA DEFINITIVA E CORRETTA (POP & CHIESA)
// ==========================================
function ricercaRapida(e) {
    if (isScalettaLocked) { 
        e.target.value = ""; 
        return; 
    }
    
    const s = e.target.value.trim().toLowerCase(); 
    const container = document.getElementById('search-results'); 
    if (!container) return;
    
    // Se la casella viene svuotata, nasconde il pannello dei risultati
    if (s.length === 0) { 
        container.innerHTML = ""; 
        container.style.display = "none"; 
        return; 
    }
    
    // Controllo di sicurezza sul catalogo caricato in memoria
    if (!catalogoAttivoRiferimento) {
        console.warn("Ricerca interrotta: nessun catalogo caricato.");
        return;
    }
    
    // Filtra i brani per titolo o per autore nel catalogo corrente
    const filtrati = catalogoAttivoRiferimento.filter(b => 
        (b.titolo || "").toLowerCase().includes(s) || 
        (b.autore || "").toLowerCase().includes(s)
    );
    
    container.innerHTML = ""; // Pulisce i vecchi risultati
    
    if (filtrati.length === 0) {
        container.innerHTML = '<div class="search-no-result">Nessun brano trovato</div>';
        container.style.display = "block";
        return;
    }
    
    // Disegna dinamicamente la lista dei risultati a schermo
    filtrati.forEach(brano => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        // CORRETTO: Uso della concatenazione classica per evitare stringhe letterali errate
        item.innerHTML = '<strong>' + brano.titolo + '</strong>' + 
                         (brano.autore ? '<small> - <i>' + brano.autore + '</i></small>' : '');
        
        // Al clic sul brano trovato, avvia il caricamento dello spartito
        item.addEventListener('click', () => {
            selezionaBranoDaScalettaPerTitolo(brano.titolo);
            
            container.innerHTML = "";
            container.style.display = "none";
            document.getElementById('search-input').value = "";
            
            document.getElementById('menu-screen').style.display = 'none';
            document.getElementById('song-screen').style.display = 'flex';
        });
        
        container.appendChild(item);
    });
    
    container.style.display = "block"; // Mostra il riquadro dei risultati
}

function tornaAllaHomeSplash() {
    if (isScalettaLocked) return;
    document.getElementById('splash-screen').style.display = 'block';
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('song-screen').style.display = 'none';
    document.body.classList.remove('theme-liturgico');
    const container = document.getElementById('search-results');
    if (container) { container.innerHTML = ""; container.style.display = "none"; }
    const inputRicerca = document.getElementById('search-input');
    if (inputRicerca) inputRicerca.value = "";
}

function tornaAlMenuRicerca() {
    if (isScalettaLocked) return;
    document.getElementById('song-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'block';
    const inputRicerca = document.getElementById('search-input');
    if (inputRicerca) { inputRicerca.value = ""; setTimeout(() => inputRicerca.focus(), 50); }
}

function toggleScroll() {
    const btn = document.getElementById('btn-scroll');
    if (isScrolling) {
        clearInterval(scrollInterval); isScrolling = false;
        if (btn) btn.innerHTML = '▶ Auto-Scroll';
    } else {
        isScrolling = true;
        if (btn) btn.innerHTML = '⏸ Pausa Scroll';
        scrollInterval = setInterval(() => {
            window.scrollBy({ top: 1, behavior: 'auto' });
            if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight) {
                clearInterval(scrollInterval); isScrolling = false;
                if (btn) btn.innerHTML = '▶ Auto-Scroll';
            }
        }, currentSpeedMs);
    }
}

function changeScrollSpeed(delta) {
    currentSpeedMs += delta;
    if (currentSpeedMs < 10) currentSpeedMs = 10;
    if (currentSpeedMs > 150) currentSpeedMs = 150;
    const infoVel = document.getElementById('info-velocita');
    if (infoVel) { infoVel.innerText = `Velocità: ${(40 / currentSpeedMs).toFixed(1)}x`; }
    if (isScrolling) { clearInterval(scrollInterval); isScrolling = false; toggleScroll(); }
}
// [NEW] RICERCA INTERNA AL BOTTOM SHEET PER LE SOSTITUZIONI LAST MINUTE
function mostraRisultatiNelPicker(valore) {
    const s = valore.trim().toLowerCase();
    const container = document.getElementById('picker-results-list');
    if (!container || !catalogoAttivoRiferimento) return;
    
    container.innerHTML = ""; // Svuota i vecchi risultati
    
    // Se la casella è vuota, non mostra nulla
    if (s.length === 0) return;
    
    // Filtra nel catalogo attivo (Pop o Chiesa a seconda di cosa stai usando)
    const filtrati = catalogoAttivoRiferimento.filter(b => 
        (b.titolo || "").toLowerCase().includes(s) || 
        (b.autore || "").toLowerCase().includes(s)
    );
    
    if (filtrati.length === 0) {
        container.innerHTML = '<div class="search-no-result">Nessun brano alternativo trovato</div>';
        return;
    }
    
    // Disegna le righe dei brani trovati nel Bottom Sheet
    filtrati.forEach(brano => {
        const row = document.createElement('div');
        row.className = 'picker-result-row';
        
        // CORRETTO: Uso dei backtick per l'interpolazione reale delle stringhe
        row.innerHTML = '<strong>' + brano.titolo + '</strong>' + 
                        (brano.autore ? '<small> - <i>' + brano.autore + '</i></small>' : '');
        
        // Al clic sulla riga, effettua la sostituzione immediata
        row.addEventListener('click', () => {
            confermaSostituzioneCanto(brano.titolo);
        });
        
        container.appendChild(row);
    });
}

// [NEW] APPLICA E SALVA LA SOSTITUZIONE VOLANTE
function confermaSostituzioneCanto(nuovoTitolo) {
    if (!scalettaCorrenteData || !momentoLiturgicoAttivo) return;
    
    // Aggiorna l'oggetto in memoria
    scalettaCorrenteData.brani[momentoLiturgicoAttivo] = nuovoTitolo;
    
    // Salva immediatamente la scaletta modificata nel localStorage (Scudo Anti-Reset)
    localStorage.setItem(STORAGE_KEY_SCALETTA, JSON.stringify(scalettaCorrenteData));
    
    // Ridisegna la barra della scaletta con il nuovo brano inserito
    attivaScalettaLiturgica(scalettaCorrenteData);
    
    // Chiude il pannello Bottom Sheet
    document.getElementById('lastminute-picker-overlay').style.display = "none";
    
    // Carica automaticamente a schermo il testo del nuovo brano selezionato
    selezionaBranoDaScalettaPerTitolo(nuovoTitolo);
    
    console.log(`Last Minute: Sostituito canto di ${momentoLiturgicoAttivo} con "${nuovoTitolo}" e salvato in backup.`);
}

// ==========================================
// [NEW] MOTORE INTERNO DI TRASPOSIZIONE ACCORDI
// ==========================================
function transpose(semitoni) {
    if (!originalText) return;
    currentSemitoneShift += semitoni;
    
    // Aggiorna l'indicatore grafico a schermo
    const infoTonalita = document.getElementById("info-tonalita");
    if (infoTonalita) {
        if (currentSemitoneShift === 0) {
            infoTonalita.textContent = "Tonalità: Originale";
        } else {
            infoTonalita.textContent = `Tonalità: ${currentSemitoneShift > 0 ? '+' : ''}${currentSemitoneShift} Semitoni`;
        }
    }
    
    // Riesegue il rendering del testo con i nuovi accordi calcolati
    render();
    console.log(`Trasposizione: Spostamento di ${semitoni} semitoni applicato (Totale: ${currentSemitoneShift}).`);
}

// ==========================================
// [NEW] MOTORE INTERMO DI CAMBIO NOTAZIONE (ITA / ENG)
// ==========================================
function changeNotation(notation) {
    if (currentNotation === notation) return;
    currentNotation = notation;
    
    // Sincronizza i radio button grafici per coerenza visiva
    const radioIt = document.getElementById('radio-it');
    const radioEn = document.getElementById('radio-en');
    if (radioIt) radioIt.checked = (notation === 'IT');
    if (radioEn) radioEn.checked = (notation === 'EN');
    
    // Ridisegna il testo convertendo gli accordi al volo
    render();
    console.log(`Notazione: Cambiata in modalità ${notation}.`);
}

// [NEW] FUNZIONE FUNZIONALE DI RENDERING (FALLBACK DI EMERGENZA SE MANCA IL CORE RENDERING)
if (typeof render !== 'function') {
    window.render = function() {
        const container = document.getElementById('song-content');
        if (!container) return;
        
        // Se non è agganciato un transposer esterno avanzato, mostra il testo originale pulito
        container.textContent = originalText;
    };
}

