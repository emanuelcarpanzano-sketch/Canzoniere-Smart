/**
 * CANZONIERE SMART - LOGICA APPLICATIVA
 * PARTE 1 DI 2 - EVENTI DOM E AVVIO CATALOGHI
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

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzoniere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzoniere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);

    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', function() {
        if (scriptConfigurato) { scriptConfigurato.remove(); scriptConfigurato = null; }
        document.body.classList.add('theme-liturgico');
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        scriptConfigurato.onload = function() {
            if (window.catalogoChiesa) { catalogoAttivoRiferimento = window.catalogoChiesa; } else { return; }
            fetch('scalettaDomenica.json')
                .then(res => res.json())
                .then(data => {
                    document.getElementById('splash-screen').style.display = 'none';
                    document.getElementById('song-screen').style.display = 'flex'; 
                    if (document.getElementById('btn-toggle-scaletta')) document.getElementById('btn-toggle-scaletta').style.display = 'block';
                    attivaScalettaLiturgica(data);
                    const chiavi = Object.keys(data.brani);
                    if (chiavi.length > 0) {
                        selezionaBranoDaScalettaPerTitolo(data.brani[chiavi[0]]);
                        setTimeout(() => { if (document.querySelector(".btn-scaletta-item")) document.querySelector(".btn-scaletta-item").classList.add("tempo-selezionato"); }, 50);
                    }
                }).catch(err => console.error(err));
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
/**
 * CANZONIERE SMART - LOGICA APPLICATIVA
 * PARTE 2 DI 2 - LOGICA INTERNA E BOTTOM SHEET
 */

function selezionaBranoDaScalettaPerTitolo(titolo) {
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
    const s = e.target.value.trim().toLowerCase(); const container = document.getElementById('search-results'); if (!container || !catalogoAttivoRiferimento) return;
    if (s.length === 0) { container.innerHTML = ""; container.style.display = "none"; return; }
    const filtrati = catalogoAttivoRiferimento.filter(b => (b.titolo||"").toLowerCase().includes(s) || (b.autore||"").toLowerCase().includes(s));
    container.innerHTML = ""; if (filtrati.length === 0) { container.innerHTML = "<div class='no-results'>Nessun brano trovato</div>"; container.style.display = "block"; return; }
    filtrati.forEach(b => {
        const div = document.createElement('div'); div.className = 'search-result-item'; div.innerHTML = `<strong>${b.titolo}</strong> ${b.autore ? ' - ' + b.autore : ''}`;
        div.addEventListener('click', () => { document.getElementById('menu-screen').style.display = 'none'; document.getElementById('song-screen').style.display = 'flex'; if (document.getElementById("scaletta-panel")) document.getElementById("scaletta-panel").style.display = "none"; selezionaBranoDaScalettaPerTitolo(b.titolo); });
        container.appendChild(div);
    });
    container.style.display = "block";
}

function tornaAlMenuRicerca() { resetScorrimentoSicuro(); document.getElementById("song-screen").style.display = "none"; document.getElementById("menu-screen").style.display = "block"; if (document.getElementById('search-input')) { document.getElementById('search-input').value = ""; document.getElementById('search-input').focus(); } if (document.getElementById('search-results')) { document.getElementById('search-results').innerHTML = ""; document.getElementById('search-results').style.display = "none"; } }
function tornaAllaHomeSplash() { resetScorrimentoSicuro(); document.body.classList.remove('theme-liturgico'); document.getElementById("menu-screen").style.display = "none"; document.getElementById("song-screen").style.display = "none"; document.getElementById("splash-screen").style.display = "block"; }
function transpose(n) { currentSemitoneShift += n; let s = currentSemitoneShift > 0 ? "+" : ""; if (document.getElementById("info-tonalita")) document.getElementById("info-tonalita").textContent = currentSemitoneShift === 0 ? "Tonalità: Originale" : `Tonalità: ${s}${currentSemitoneShift} Semitoni`; render(); }
function changeNotation(n) { currentNotation = n; render(); }
function toggleScroll() { const b = document.getElementById("btn-scroll"); if (!b) return; if (isScrolling) { resetScorrimentoSicuro(); } else { isScrolling = true; b.textContent = "⏸ Pausa"; scrollInterval = setInterval(() => { window.scrollBy(0, 1); }, currentSpeedMs); } }
function changeScrollSpeed(d) { currentSpeedMs += d; if (currentSpeedMs < 10) currentSpeedMs = 10; if (currentSpeedMs > 150) currentSpeedMs = 150; if (document.getElementById("info-velocita")) document.getElementById("info-velocita").textContent = `Velocità: ${Math.round((40 / currentSpeedMs) * 10) / 10}x`; if (isScrolling) { clearInterval(scrollInterval); scrollInterval = setInterval(() => { window.scrollBy(0, 1); }, currentSpeedMs); } }
function resetScorrimentoSicuro() { if (scrollInterval) clearInterval(scrollInterval); isScrolling = false; if (document.getElementById("btn-scroll")) document.getElementById("btn-scroll").textContent = "▶ Auto-Scroll"; }

function apriLastMinutePicker(tempo) {
    momentoLiturgicoAttivo = tempo; document.getElementById("picker-momento-label").textContent = tempo; document.getElementById("lastminute-picker-overlay").style.display = "flex";
    const inp = document.getElementById("picker-search-input"); if (inp) { inp.value = ""; mostraRisultatiNelPicker(""); setTimeout(() => inp.focus(), 150); }
}

function mostraRisultatiNelPicker(filtro) {
    const container = document.getElementById("picker-results-list"); if (!container || !catalogoAttivoRiferimento) return; container.innerHTML = "";
    const filtrati = catalogoAttivoRiferimento.filter(b => b.titolo.toLowerCase().includes(filtro.toLowerCase()));
    if (filtrati.length === 0) { container.innerHTML = "<div style='padding:15px; color:#999; font-style:italic;'>Nessun brano trovato</div>"; return; }
    filtrati.forEach(b => {
        const row = document.createElement("div"); row.className = "picker-result-row"; row.innerHTML = `<strong>${b.titolo}</strong> ${b.autore ? ' - <small>' + b.autore + '</small>' : ''}`;
        row.addEventListener('click', () => {
            if (scalettaCorrenteData && momentoLiturgicoAttivo) {
                scalettaCorrenteData.brani[momentoLiturgicoAttivo] = b.titolo; document.getElementById("lastminute-picker-overlay").style.display = "none";
                attivaScalettaLiturgica(scalettaCorrenteData); selezionaBranoDaScalettaPerTitolo(b.titolo);
                setTimeout(() => { document.querySelectorAll('.btn-scaletta-item').forEach(btn => { const lbl = btn.querySelector('.tempo-label'); if (lbl && lbl.textContent === momentoLiturgicoAttivo) btn.classList.add('tempo-selezionato'); }); }, 50);
            }
        });
        container.appendChild(row);
    });
}

function attivaScalettaLiturgica(data) {
    scalettaCorrenteData = data; if (document.getElementById("scaletta-nome-titolo")) document.getElementById("scaletta-nome-titolo").textContent = data.nome || "Messa del Giorno";
    const container = document.getElementById("scaletta-bottoni-container"); if (!container) return; container.innerHTML = "";
    Object.keys(data.brani).forEach(tempo => {
        const titoloBrano = data.brani[tempo]; const item = document.createElement("div"); item.className = "btn-scaletta-item"; item.style.display = "flex"; item.style.justifyContent = "space-between"; item.style.alignItems = "center";
        const clickArea = document.createElement("div"); clickArea.style.flex = "1"; clickArea.style.cursor = "pointer"; clickArea.innerHTML = `<div class="tempo-label">${tempo}</div><div class="titolo-label">${titoloBrano}</div>`;
        clickArea.addEventListener("click", () => { document.querySelectorAll(".btn-scaletta-item").forEach(b => b.classList.remove("tempo-selezionato")); item.classList.add("tempo-selezionato"); selezionaBranoDaScalettaPerTitolo(titoloBrano); });
        const editBtn = document.createElement("button"); editBtn.className = "btn-override-lastminute"; editBtn.innerHTML = "✏️"; editBtn.title = `Sostituisci ${tempo}`;
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); apriLastMinutePicker(tempo); });
        item.appendChild(clickArea); item.appendChild(editBtn); container.appendChild(item);
    });
}

if (typeof window.render !== "function") {
    window.render = function() {
        const area = document.getElementById("song-content");
        if (area && originalText) { if (typeof window.trasponiTestoNotazione === "function") { area.innerHTML = window.trasponiTestoNotazione(originalText, currentSemitoneShift, currentNotation); } else { area.textContent = originalText; } }
    };
}

