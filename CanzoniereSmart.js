/**
 * CANZONIERE SMART - LOGICA APPLICATIVA CENTRALIZZATA
 * PARTE 1 DI 2 - EVENTI E CONFIGURAZIONE CATALOGHI
 */

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
let momentoLiturgicoAttivo = null; 

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-load-pop').addEventListener('click', () => avviaCanzoniere('pop'));
    document.getElementById('btn-load-chiesa').addEventListener('click', () => avviaCanzoniere('chiesa'));
    document.getElementById('btn-home-splash').addEventListener('click', tornaAllaHomeSplash);

    document.getElementById('btn-load-scaletta-domenica').addEventListener('click', function() {
        if (scriptConfigurato) {
            scriptConfigurato.remove();
            scriptConfigurato = null;
        }

        document.body.classList.add('theme-liturgico');
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";

        scriptConfigurato = document.createElement("script");
        scriptConfigurato.src = "CanzoniereCatalogoChiesa.js?_=" + new Date().getTime();

        scriptConfigurato.onload = function() {
            if (window.catalogoChiesa) {
                catalogoAttivoRiferimento = window.catalogoChiesa;
            } else {
                console.error("Errore: catalogoChiesa non trovato su window.");
                return;
            }

            fetch('scalettaDomenica.json')
                .then(response => {
                    if (!response.ok) throw new Error("File scaletta non accessibile");
                    return response.json();
                })
                .then(data => {
                    document.getElementById('splash-screen').style.display = 'none';
                    document.getElementById('song-screen').style.display = 'flex'; 

                    const btnToggle = document.getElementById('btn-toggle-scaletta');
                    if (btnToggle) btnToggle.style.display = 'block';

                    attivaScalettaLiturgica(data);
                    
                    const chiaviTempi = Object.keys(data.brani);
                    if (chiaviTempi.length > 0) {
                        const primoTempo = chiaviTempi[0];
                        selezionaBranoDaScalettaPerTitolo(data.brani[primoTempo]);
                        
                        setTimeout(() => {
                            const primoBtn = document.querySelector(".btn-scaletta-item");
                            if (primoBtn) primoBtn.classList.add("tempo-selezionato");
                        }, 50);
                    }
                })
                .catch(error => console.error("Errore caricamento scaletta:", error));
        };
        document.head.appendChild(scriptConfigurato);
    });

    document.getElementById('search-input').addEventListener('input', ricercaRapida);
    document.getElementById('btn-elenco-brani').addEventListener('click', tornaAlMenuRicerca);
    
    document.getElementById('btn-transpose-meno').addEventListener('click', () => transpose(-1));
    document.getElementById('btn-transpose-piu').addEventListener('click', () => transpose(1));
    document.getElementById('radio-it').addEventListener('click', () => changeNotation('IT'));
    document.getElementById('radio-en').addEventListener('click', () => changeNotation('EN'));

    const btnWcag = document.getElementById('btn-wcag-toggle');
    if (btnWcag) {
        btnWcag.addEventListener('click', function() {
            wcagCompattatoAttivo = !wcagCompattatoAttivo;
            this.classList.toggle("attivo-accessibile", wcagCompattatoAttivo);
            render();
        });
    }
    
    document.getElementById('btn-scroll').addEventListener('click', toggleScroll);
    document.getElementById('btn-scroll-slower').addEventListener('click', () => changeScrollSpeed(5));
    document.getElementById('btn-scroll-faster').addEventListener('click', () => changeScrollSpeed(-5));

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

    document.getElementById('btn-toggle-controls').addEventListener('click', () => {
        const ctrlPanel = document.getElementById('controls-panel');
        ctrlPanel.style.display = ctrlPanel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-toggle-scaletta').addEventListener('click', () => {
        const scalettaPanel = document.getElementById('scaletta-panel');
        scalettaPanel.style.display = scalettaPanel.style.display === 'none' ? 'block' : 'none';
    });

    const pickerSearch = document.getElementById("picker-search-input");
    if (pickerSearch) {
        pickerSearch.addEventListener('input', (e) => mostraRisultatiNelPicker(e.target.value));
    }
    const btnClosePicker = document.getElementById("btn-close-picker");
    if (btnClosePicker) {
        btnClosePicker.addEventListener('click', () => {
            document.getElementById("lastminute-picker-overlay").style.display = "none";
        });
    }
}); 

function avviaCanzoniere(tipo) {
    if (scriptConfigurato) {
        scriptConfigurato.remove();
        scriptConfigurato = null;
    }
    
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
    }
    
    const panel = document.getElementById("scaletta-panel");
    if (panel) panel.style.display = "none";
    
    let sorgenteScript = "";
    let chiaveFinestra = "";
    
    if (tipo === 'pop') {
        document.body.classList.remove('theme-liturgico');
        sorgenteScript = "CanzoniereCatalogo.js";
        chiaveFinestra = "catalogoPopRock"; 
        cartellaAttiva = "CatalogoTxT/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Pop / Rock";
    } else {
        document.body.classList.add('theme-liturgico');
        sorgenteScript = "CanzoniereCatalogoChiesa.js";
        chiaveFinestra = "catalogoChiesa";   
        cartellaAttiva = "CatalogoTxTChiesa/";
        document.getElementById("menu-main-title").innerText = "Canzoniere Liturgico";
    }
    
    scriptConfigurato = document.createElement("script");
    scriptConfigurato.src = sorgenteScript + "?_=" + new Date().getTime();
    
    scriptConfigurato.onload = function() {
        if (window[chiaveFinestra]) {
            catalogoAttivoRiferimento = window[chiaveFinestra];
        }
        document.getElementById("splash-screen").style.display = "none";
        document.getElementById("menu-screen").style.display = "block";
    };
    document.head.appendChild(scriptConfigurato);
}
/**
 * CANZONIERE SMART - LOGICA APPLICATIVA CENTRALIZZATA
 * PARTE 2 DI 2 - OPERAZIONI SUI BRANI, SCALETTE E BOTTOM SHEET
 */

function selezionaBranoDaScalettaPerTitolo(titoloDaCercare) {
    if (!catalogoAttivoRiferimento) return;
    
    const titoloPulito = titoloDaCercare.trim().toLowerCase();
    const branoTrovato = catalogoAttivoRiferimento.find(b => 
        b.titolo.trim().toLowerCase() === titoloPulito
    );
    
    if (branoTrovato) {
        document.getElementById("song-title").textContent = branoTrovato.titolo;
        document.getElementById("song-author").textContent = branoTrovato.autore ? ` - ${branoTrovato.autore}` : "";
        
        const nomeFileTxt = branoTrovato.nomeFile || `${branoTrovato.titolo}.txt`;
        const targetFilename = document.getElementById("target-filename");
        if (targetFilename) targetFilename.textContent = nomeFileTxt;
        
        currentSemitoneShift = 0;
        document.getElementById("info-tonalita").textContent = "Tonalità: Originale";
        
        const percorsoCompletoFile = cartellaAttiva + nomeFileTxt;
        document.getElementById("song-content").textContent = "Caricamento file .txt in corso...";

        fetch(percorsoCompletoFile)
            .then(res => {
                if (!res.ok) throw new Error("File non accessibile");
                return res.text();
            })
            .then(testoEstratto => {
                originalText = testoEstratto; 
                document.getElementById('offline-zone').style.display = "none";
                render(); 
            })
            .catch(err => {
                originalText = "";
                document.getElementById('offline-zone').style.display = "block";
                document.getElementById("song-content").textContent = `Seleziona il file "${nomeFileTxt}" manualmente.`;
            });
    }
}

function ricercaRapida(event) {
    const stringaRicerca = event.target.value.trim().toLowerCase();
    const containerRisultati = document.getElementById('search-results');
    
    if (!containerRisultati || !catalogoAttivoRiferimento) return;
    if (stringaRicerca.length === 0) {
        containerRisultati.innerHTML = "";
        containerRisultati.style.display = "none";
        return;
    }

    const braniFiltrati = catalogoAttivoRiferimento.filter(b => {
        const tit = b.titolo ? b.titolo.toLowerCase() : "";
        const aut = b.autore ? b.autore.toLowerCase() : "";
        return tit.includes(stringaRicerca) || aut.includes(stringaRicerca);
    });

    containerRisultati.innerHTML = "";

    if (braniFiltrati.length === 0) {
        containerRisultati.innerHTML = "<div class='no-results'>Nessun brano trovato</div>";
        containerRisultati.style.display = "block";
        return;
    }

    braniFiltrati.forEach(b => {
        const elementoBrano = document.createElement('div');
        elementoBrano.className = 'search-result-item';
        elementoBrano.innerHTML = `<strong>${b.titolo}</strong> ${b.autore ? ' - ' + b.autore : ''}`;
        
        elementoBrano.addEventListener('click', () => {
            document.getElementById('menu-screen').style.display = 'none';
            document.getElementById('song-screen').style.display = 'flex';
            const panelScaletta = document.getElementById("scaletta-panel");
            if (panelScaletta) panelScaletta.style.display = "none";
            selezionaBranoDaScalettaPerTitolo(b.titolo);
        });
        containerRisultati.appendChild(elementoBrano);
    });
    containerRisultati.style.display = "block";
}

function tornaAlMenuRicerca() {
    resetScorrimentoSicuro();
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("menu-screen").style.display = "block";
    const input = document.getElementById('search-input');
    if (input) { input.value = ""; input.focus(); }
    const containerRisultati = document.getElementById('search-results');
    if (containerRisultati) { containerRisultati.innerHTML = ""; containerRisultati.style.display = "none"; }
}

function tornaAllaHomeSplash() {
    resetScorrimentoSicuro(); 
    document.body.classList.remove('theme-liturgico');
    document.getElementById("menu-screen").style.display = "none";
    document.getElementById("song-screen").style.display = "none";
    document.getElementById("splash-screen").style.display = "block";
}

function transpose(semitoni) {
    currentSemitoneShift += semitoni;
    let segno = currentSemitoneShift > 0 ? "+" : "";
    const infoTonalita = document.getElementById("info-tonalita");
    if (infoTonalita) {
        infoTonalita.textContent = currentSemitoneShift === 0 ? "Tonalità: Originale" : `Tonalità: ${segno}${currentSemitoneShift} Semitoni`;
    }
    render();
}

