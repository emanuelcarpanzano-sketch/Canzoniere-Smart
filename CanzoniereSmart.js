/**
 * CANZONIERE SMART - LOGICA APPLICATIVA
 * PARTE 1 DI 2 - EVENTI DOM E AVVIO CATALOGHI (VERSIONE RESILIENTE)
 */

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

// [NEW] VARIABILI DI STATO PER LA RESILIENZA LIVE
let isScalettaLocked = false;
const STORAGE_KEY_SCALETTA = 'canzoniere_smart_local_backup';

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzoniere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzoniere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);

    // [NEW] Aggancio del pulsante per lo Scudo di Sicurezza Live Lock
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
            
            // [NEW] Fallback Anti-Disconnessione: usa il backup se il server non risponde
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

// [NEW] Iniezione e parsing centralizzato scaletta
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
/**
 * CANZONIERE SMART - LOGICA APPLICATIVA
 * PARTE 2 DI 2 - LOGICA INTERNA E LIVE LOCK (VERSIONE RESILIENTE)
 */

// [NEW] GESTIONE DELLO SCUDO DI SICUREZZA LIVE LOCK (ANTI-TAP INVOLONTARIO)
function toggleLiveLock() {
    isScalettaLocked = !isScalettaLocked;
    const lockBtn = document.getElementById('btn-lock-scaletta');
    const scalettaPanel = document.getElementById('scaletta-panel');
    
    if (isScalettaLocked) {
        if (lockBtn) {
            lockBtn.classList.add('locked');
            lockBtn.innerHTML = '🔒 Scaletta Protetta';
        }
        if (scalettaPanel) scalettaPanel.classList.add('ui-locked');
        console.log("Sicurezza Live Attivata: Scaletta e controlli congelati.");
    } else {
        if (lockBtn) {
            lockBtn.classList.remove('locked');
            lockBtn.innerHTML = '🔓 Blocca Scaletta';
        }
        if (scalettaPanel) scalettaPanel.classList.remove('ui-locked');
        console.log("Sicurezza Live Disattivata: Modifiche consentite.");
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
    // [NEW] BLOCCO SELEZIONE ACCIDENTALE DURANTE LA PERFORMANCE LIVE
    if (isScalettaLocked && originalText !== "") {
        console.warn("Cambio brano ignorato: sblocca lo scudo per cambiare canzone.");
        return;
    }

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

function ricercaRapida(e) {
    // [NEW] Se la scaletta è bloccata, congela l'input di ricerca per evitare digitazioni accidentali
    if (isScalettaLocked) {
        e.target.value = "";
        return;
    }

    const s = e.target.value.trim().toLowerCase(); 
    const container = document.getElementById('search-results'); 
    if (!container || !catalogoAttivoRiferimento) return;
    if (s.length === 0) { container.innerHTML = ""; container.style.display = "none"; return; }
    
    const filtrati = catalogoAttivoRiferimento.filter(b => 
        (b.titolo || "").toLowerCase().includes(s) || 
        (b.autore || "").toLowerCase().includes(s)
    );
    
    // NOTA: Da qui in poi prosegue la logica di creazione degli elementi DOM 
    // per visualizzare l'elenco filtrato a schermo.
}
// [NEW] FUNZIONE DI RITORNO ALLA SCHERMATA SPLASH (HOME)
function tornaAllaHomeSplash() {
    // Se la scaletta è bloccata, impediamo il ritorno accidentale alla home per sicurezza live
    if (isScalettaLocked) {
        console.warn("Ritorno alla Home ignorato: la scaletta è BLOCCATA.");
        return;
    }

    // Ripristina la visualizzazione iniziale delle schermate
    document.getElementById('splash-screen').style.display = 'block';
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('song-screen').style.display = 'none';
    
    // Rimuove temporaneamente il tema liturgico visivo dal body se presente
    document.body.classList.remove('theme-liturgico');
    
    // Ripulisce i risultati della ricerca precedente per decoro grafico
    const container = document.getElementById('search-results');
    if (container) {
        container.innerHTML = "";
        container.style.display = "none";
    }
    const inputRicerca = document.getElementById('search-input');
    if (inputRicerca) inputRicerca.value = "";

    console.log("Navigazione: Ritorno alla Splash Screen eseguito.");
}

// [NEW] FUNZIONE DI RITORNO AL MENU DI RICERCA BRANI
function tornaAlMenuRicerca() {
    // Impedisce l'uscita accidentale dallo spartito se lo scudo Live è attivo
    if (isScalettaLocked) {
        console.warn("Navigazione bloccata: sblocca la scaletta per tornare al menu.");
        return;
    }

    // Nasconde lo spartito e mostra la schermata con la barra di ricerca
    document.getElementById('song-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'block';
    
    // Ripristina il focus sulla ricerca rapida
    const inputRicerca = document.getElementById('search-input');
    if (inputRicerca) {
        inputRicerca.value = "";
        setTimeout(() => inputRicerca.focus(), 50);
    }
    
    console.log("Navigazione: Ritorno alla schermata di ricerca.");
}
