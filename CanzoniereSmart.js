/**
 * CANZONIERE SMART - CORE APPLICATION LOGIC
 * Architettura Unificata, Resiliente ed Esente da Crash - Ottobre 2026
 * TRANCHE 1 DI 4 - CONFIGURAZIONE, STATO GLOBALE E RENDERING UI SCALETTE
 */

// ==========================================
// 1. CONFIGURAZIONE & STATO APPLICAZIONE GLOBALE
// ==========================================
let currentNotation = 'IT';
let originalText = ""; 
let currentSemitoneShift = 0;
let wcagCompattatoAttivo = false; 

let cartellaAttiva = "";     
let scriptConfigurato = null; 
let catalogoAttivoRiferimento = null; 

let scrollInterval = null;
let currentSpeedMs = 40; 
let isScrolling = false;

let scalettaCorrenteData = null;
let momentoSelezionatoAttivo = null; 

// Stato di blocco per la sicurezza sul palco e chiave Storage Dinamica
let isScalettaLocked = false;
let currentStorageKey = 'canzoniere_smart_local_backup'; 

// ==========================================
// 2. MOTORE CORE DI RENDERING INTERFACCIA E SCALETTE
// ==========================================
function attivaScalettaUI(data) { 
    if (!data || !data.brani) return;
    
    scalettaCorrenteData = data;
    
    const titoloScaletta = document.getElementById('scaletta-nome-titolo');
    if (titoloScaletta) titoloScaletta.innerText = data.nomeScaletta || "Scaletta Attiva";
    
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
            <div class="tempo-label">${momento.trim().toUpperCase()}</div>
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
    
    console.log("Rendering Scaletta completato correttamente.");
}

function elaboraEAttivaScaletta(data) {
    document.getElementById('splash-screen').style.display = 'none';
    document.getElementById('song-screen').style.display = 'flex'; 
    if (document.getElementById('btn-toggle-scaletta')) document.getElementById('btn-toggle-scaletta').style.display = 'block';
    
    if (data.nomeScaletta && data.nomeScaletta.toLowerCase().includes("concerto")) {
        currentStorageKey = 'canzoniere_smart_concerto_backup';
    } else {
        currentStorageKey = 'canzoniere_smart_local_backup';
    }
    
    attivaScalettaUI(data);
    
    const chiavi = Object.keys(data.brani);
    if (chiavi.length > 0) {
        selezionaBranoDaScalettaPerTitolo(data.brani[chiavi[0]]);
        setTimeout(() => { if (document.querySelector(".btn-scaletta-item")) document.querySelector(".btn-scaletta-item").classList.add("tempo-selezionato"); }, 50);
    }
}

function apriPannelloSostituzioneLastMinute(momento) {
    if (isScalettaLocked) return;
    momentoSelezionatoAttivo = momento;
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

    // Gestore riutilizzabile per il caricamento delle scalette offline/online
    function caricaScalettaSpecificata(tipoScaletta, fileJson, cartellaCatalogo, fileScriptCatalogo, winKeyCatalogo, classeTema) {
        if (scriptConfigurato) { scriptConfigurato.remove(); scriptConfigurato = null; }
        
        // Reset e impostazione dinamica del tema grafico
        if (classeTema) {
            document.body.classList.add(classeTema);
            document.body.classList.remove('theme-pop');
        } else {
            document.body.classList.remove('theme-liturgico');
            document.body.classList.add('theme-pop');
        }
        
        cartellaAttiva = cartellaCatalogo;
        document.getElementById("menu-main-title").innerText = tipoScaletta === 'pop' ? "Canzoniere Pop / Rock" : "Canzoniere Liturgico";

        // Configurazione dello Storage Key impostato prima del caricamento
        currentStorageKey = tipoScaletta === 'pop' ? 'canzoniere_smart_concerto_backup' : 'canzoniere_smart_local_backup';

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = fileScriptCatalogo + "?_=" + new Date().getTime();

        scriptConfigurato.onload = function() {
            if (window[winKeyCatalogo]) { 
                catalogoAttivoRiferimento = window[winKeyCatalogo]; 
            } else { 
                console.error("Errore: Catalogo non trovato in window." + winKeyCatalogo);
                return; 
            }
            
            // Failsafe offline adattivo tramite la chiave corretta
            const backupLocale = localStorage.getItem(currentStorageKey);
            if (backupLocale) {
                console.log(`[Offline] Recupero scaletta ${tipoScaletta} da backup locale...`);
                elaboraEAttivaScaletta(JSON.parse(backupLocale));
            } else {
                fetch(fileJson)
                    .then(res => res.json())
                    .then(data => {
                        localStorage.setItem(currentStorageKey, JSON.stringify(data));
                        elaboraEAttivaScaletta(data);
                    }).catch(err => console.error("Impossibile caricare il JSON della scaletta:", err));
            }
        };
        document.head.appendChild(scriptConfigurato);
    }

    // Listener Scaletta Liturgica
    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', function() {
        caricaScalettaSpecificata('chiesa', 'scalettaDomenica.json', 'CatalogoTxTChiesa/', 'CanzoniereCatalogoChiesa.js', 'catalogoChiesa', 'theme-liturgico');
    });

    // Listener Scaletta Concerto Pop/Rock
    document.getElementById('btn-load-scaletta-concerto').addEventListener('click', function() {
        caricaScalettaSpecificata('pop', 'scalettaConcerto.json', 'CatalogoTxT/', 'CanzoniereCatalogo.js', 'catalogoPopRock', null);
    });

    document.getElementById('search-input').addEventListener('input', ricercaRapida);
    document.getElementById('btn-elenco-brani').addEventListener('click', tornaAlMenuRicerca);
    document.getElementById('btn-transpose-meno').addEventListener('click', () => { transpose(-1); if (typeof window.render === 'function') window.render(); });
    document.getElementById('btn-transpose-piu').addEventListener('click', () => { transpose(1); if (typeof window.render === 'function') window.render(); });
    document.getElementById('radio-it').addEventListener('click', () => { changeNotation('IT'); if (typeof window.render === 'function') window.render(); });
    document.getElementById('radio-en').addEventListener('click', () => { changeNotation('EN'); if (typeof window.render === 'function') window.render(); });

    if (document.getElementById('btn-wcag-toggle')) {
        document.getElementById('btn-wcag-toggle').addEventListener('click', function() {
            wcagCompattatoAttivo = !wcagCompattatoAttivo;
            this.classList.toggle("attivo-accessibile", wcagCompattatoAttivo);
            if (typeof window.render === 'function') window.render();
        });
    }
    
    document.getElementById('btn-scroll').addEventListener('click', toggleScroll);
    document.getElementById('btn-scroll-slower').addEventListener('click', () => changeScrollSpeed(5));
    document.getElementById('btn-scroll-faster').addEventListener('click', () => changeScrollSpeed(-5));

    if (document.getElementById('file-selector')) {
        document.getElementById('file-selector').addEventListener('change', (e) => {
            const files = e.target.files; if (!files || files.length === 0) return;
            const r = new FileReader(); r.onload = (ev) => { originalText = ev.target.result; document.getElementById('offline-zone').style.display = "none"; if (typeof window.render === 'function') window.render(); };
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
    
    // CORRETTO: Gestione speculare di entrambe le identità grafiche di catalogo
    if (tipo === 'pop') {
        document.body.classList.remove('theme-liturgico');
        document.body.classList.add('theme-pop');
    } else {
        document.body.classList.remove('theme-pop');
        document.body.classList.add('theme-liturgico');
    }
    
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

        fetch(cartellaAttiva + fName)
            .then(res => res.text())
            .then(txt => { 
                originalText = txt; 
                document.getElementById('offline-zone').style.display = "none"; 
    
                // Controlla se la funzione è pronta prima di lanciarla, evitando l'undefined
                if (typeof window.render === 'function') {
                    window.render();
                } else {
                    setTimeout(() => { if (typeof window.render === 'function') window.render(); }, 60);
                }
            })
            .catch(() => { 
                originalText = ""; 
                document.getElementById('offline-zone').style.display = "block"; 
                document.getElementById("song-content").textContent = `Seleziona il file "${fName}" manualmente.`; 
            });
    }
}

// ==========================================
// FUNZIONE DI RICERCA RAPIDA DEFINITIVA E CORRETTA (POP & CHIESA)
// ==========================================
function ricercaRapida(e) {
    if (isScalettaLocked) { e.target.value = ""; return; }
    const s = e.target.value.trim().toLowerCase(); 
    const container = document.getElementById('search-results'); 
    if (!container) return;
    if (s.length === 0) { container.innerHTML = ""; container.style.display = "none"; return; }
    if (!catalogoAttivoRiferimento) return;
    
    const filtrati = catalogoAttivoRiferimento.filter(b => 
        (b.titolo || "").toLowerCase().includes(s) || (b.autore || "").toLowerCase().includes(s)
    );
    container.innerHTML = "";
    
    if (filtrati.length === 0) {
        container.innerHTML = '<div class="search-no-result">Nessun brano trovato</div>';
        container.style.display = "block";
        return;
    }
    
    filtrati.forEach(brano => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = '<strong>' + brano.titolo + '</strong>' + (brano.autore ? '<small> - <i>' + brano.autore + '</i></small>' : '');
        item.addEventListener('click', () => {
            selezionaBranoDaScalettaPerTitolo(brano.titolo);
            container.innerHTML = ""; container.style.display = "none";
            document.getElementById('search-input').value = "";
            document.getElementById('menu-screen').style.display = 'none';
            document.getElementById('song-screen').style.display = 'flex';
        });
        container.appendChild(item);
    });
    container.style.display = "block";
}





// ==========================================
// 5. STRUMENTI AUSILIARI DI NAVIGAZIONE E AUTO-SCROLL
// ==========================================
function tornaAllaHomeSplash() {
    if (isScalettaLocked) return;
    document.getElementById('splash-screen').style.display = 'block';
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('song-screen').style.display = 'none';
    
    // CORRETTO: Pulisce accuratamente entrambi i contesti grafici per la splash
    document.body.classList.remove('theme-liturgico');
    document.body.classList.remove('theme-pop');
    
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

// ==========================================
// 6. MODULO DI SOSTITUZIONE VOLANTE (BOTTOM SHEET)
// ==========================================
function mostraRisultatiNelPicker(valore) {
    const s = valore.trim().toLowerCase();
    const container = document.getElementById('picker-results-list');
    if (!container || !catalogoAttivoRiferimento) return;
    
    container.innerHTML = ""; 
    if (s.length === 0) return;
    
    const filtrati = catalogoAttivoRiferimento.filter(b => 
        (b.titolo || "").toLowerCase().includes(s) || (b.autore || "").toLowerCase().includes(s)
    );
    
    if (filtrati.length === 0) {
        container.innerHTML = '<div class="search-no-result">Nessun brano alternativo trovato</div>';
        return;
    }
    
    filtrati.forEach(brano => {
        const row = document.createElement('div');
        row.className = 'picker-result-row';
        row.innerHTML = '<strong>' + brano.titolo + '</strong>' + (brano.autore ? '<small> - <i>' + brano.autore + '</i></small>' : '');
        row.addEventListener('click', () => { confermaSostituzioneCanto(brano.titolo); });
        container.appendChild(row);
    });
}

function confermaSostituzioneCanto(nuovoTitolo) {
    if (!scalettaCorrenteData || !momentoSelezionatoAttivo) return;
    
    scalettaCorrenteData.brani[momentoSelezionatoAttivo] = nuovoTitolo;
    localStorage.setItem(currentStorageKey, JSON.stringify(scalettaCorrenteData));
    
    attivaScalettaUI(scalettaCorrenteData);
    document.getElementById('lastminute-picker-overlay').style.display = "none";
    selezionaBranoDaScalettaPerTitolo(nuovoTitolo);
    
    console.log(`Last Minute: Sostituito brano in ${momentoSelezionatoAttivo} con "${nuovoTitolo}".`);
}

// ==========================================
// 7. MOTORE DI TRASPOSIZIONE E CAMBIO NOTAZIONE
// ==========================================
function transpose(semitoni) {
    if (!originalText) return;
    currentSemitoneShift += semitoni;
    
    const infoTonalita = document.getElementById("info-tonalita");
    if (infoTonalita) {
        if (currentSemitoneShift === 0) infoTonalita.textContent = "Tonalità: Originale";
        else infoTonalita.textContent = `Tonalità: ${currentSemitoneShift > 0 ? '+' : ''}${currentSemitoneShift} Semitoni`;
    }
    
    if (typeof window.render === 'function') window.render();
}

function changeNotation(notation) {
    if (currentNotation === notation) return;
    currentNotation = notation;
    
    const radioIt = document.getElementById('radio-it');
    const radioEn = document.getElementById('radio-en');
    if (radioIt) radioIt.checked = (notation === 'IT');
    if (radioEn) radioEn.checked = (notation === 'EN');
    
    if (typeof window.render === 'function') window.render();
    console.log(`Notazione: Cambiata in modalità ${notation}.`);
}

// ==========================================
// 🛠️ INTERMEDIO DI RENDERING INTEGRATO ED ALTO CONTRASTO
// ==========================================
window.render = function() {
    const container = document.getElementById('song-content');
    if (!container) return;
    if (!originalText) {
        container.textContent = "Nessun testo caricato.";
        return;
    }

    const noteITA = ["DO", "DO#", "RE", "RE#", "MI", "FA", "FA#", "SOL", "SOL#", "LA", "LA#", "SI"];
    const noteENG = ["C",  "C#",  "D",  "D#",  "E",  "F",  "F#",  "G",   "G#",   "A",  "A#",  "B"];

    function trovaIndiceNota(nota) {
        const n = nota.toUpperCase().trim();
        let idx = noteENG.indexOf(n);
        if (idx !== -1) return idx;
        idx = noteITA.indexOf(n);
        return idx;
    }

    function elaboraAccordo(accordoPuro) {
        const match = accordoPuro.match(/^([A-G]|DO|RE|MI|FA|SOL|LA|SI)(#|b)?(.*)/i);
        if (!match) return accordoPuro;

        let notaFondamentale = match[1];
        let alterazione = match[2] || "";
        let estensione = match[3] || "";

        let idx = trovaIndiceNota(notaFondamentale);
        if (idx === -1) return accordoPuro;

        if (alterazione.toLowerCase() === 'b') {
            idx = (idx - 1 + 12) % 12;
            alterazione = ""; 
        }

        let nuovoIdx = (idx + currentSemitoneShift) % 12;
        if (nuovoIdx < 0) nuovoIdx += 12;

        let notaConvertita = (currentNotation === 'EN') ? noteENG[nuovoIdx] : noteITA[nuovoIdx];
        return notaConvertita + alterazione + estensione;
    }

    let testoElaborato = originalText.replace(/\[([^\]]+)\]/g, (match, accordo) => {
        let accordoFinale = accordo;
        if (accordo.includes('/')) {
            accordoFinale = accordo.split('/').map(elaboraAccordo).join('/');
        } else {
            accordoFinale = elaboraAccordo(accordo);
        }
        return '<span class="chord">' + accordoFinale + '</span>';
    });

    if (wcagCompattatoAttivo) {
        testoElaborato = testoElaborato.split('\n').map(linea => {
            if (linea.length > 80) return linea.substring(0, 77) + "...";
            return linea;
        }).join('\n');
    }

    container.innerHTML = testoElaborato;
};

// ACCOPPIAMENTO CRITICO: Forza la coesistenza visiva agganciando i vecchi richiami
if (typeof render === 'undefined' || render !== window.render) {
    var render = window.render;
}



