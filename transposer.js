// Scale musicali per la trasposizione
const noteItaliane = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const noteInglesi  = ["C",  "C#",  "D",  "D#",  "E",  "F",  "F#",  "G",   "G#",   "A",  "A#",  "B"];

// Mappatura per la normalizzazione dei bemolli
const mappaNormalizzazione = {
    "Reb": "Do#", "Mib": "Re#", "Solb": "Fa#", "Lab": "Sol#", "Sib": "La#",
    "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

// LA TUA REGEX AFFINATA
//const regexAccordo = /\b(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(b)?(m|maj|min|dim|aug|sus7|maj7|7|9|4|2)?(?=\s|$)/g;
// REGEX POTENZIATA: Riconosce accordi complessi e combinati come Em7, Lam7, DoM7, Do4, ecc.
//const regexAccordo = /\b(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(b)?(m|min|maj|M|dim|aug|sus)?(7|9|4|2|maj7|min7|sus4)?(?=\s|$)/g;

// REGEX ULTRA-POTENZIATA: Riconosce le estensioni complesse (Em7) e gli accordi con il basso (C/G, Do/Mi)
//const regexAccordo = /\b(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(b)?(m|min|maj|M|dim|aug|sus)?(7|9|4|2|maj7|min7|sus4)?(\/(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(b)?)?(?=\s|$)/g;

// REGEX AGGIORNATA: Inserito il supporto per gli accordi con la sesta (es. D6, Do6, Am6, C6/9)
const regexAccordo = /\b(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(b)?(m|min|maj|M|dim|aug|sus)?(7|9|4|2|6|6\/9|maj7|min7|sus4)?(\/(Do#|Re#|Fa#|Sol#|La#|Do|Re|Mi|Fa|Sol|La|Si|C#|D#|F#|G#|A#|C|D|E|F|G|A|B)(b)?)?(?=\s|$)/g;

// Stato globale per l'accessibilità WCAG 80 caratteri
let wcagCompattatoAttivo = false;

/**
 * Funzione interna che compatta il testo originale a max 80 caratteri 
 * prima di applicare la formattazione dei tag span degli accordi.
 */
function compattaTestoWCAG80(testoGrezzo) {
    const RIGHE_MAX = 80;
    const righe = testoGrezzo.split(/\r?\n/);
    let risultato = [];

    // Helper per capire se una riga contiene prevalentemente accordi usando la tua regex esistente
    function eRigaAccordi(riga) {
        if (!riga.trim()) return false;
        // Rimuove gli spazi e i trattini per vedere se i token rimasti sono tutti accordi validi
        const token = riga.trim().split(/\s+/);
        return token.every(t => {
            if (t === "" || t === "-") return true;
            // Verifica se il token è un accordo pulito (resettando l'indice della regex globale)
            regexAccordo.lastIndex = 0;
            const match = t.match(regexAccordo);
            return match && match[0] === t;
        });
    }

    for (let i = 0; i < righe.length; i++) {
        let rigaCorrente = righe[i];

        if (rigaCorrente.length <= RIGHE_MAX) {
            risultato.push(rigaCorrente);
            continue;
        }

        let rigaSuccessiva = righe[i + 1] || "";

        // Se abbiamo un blocco accoppiato: Riga Accordi + Riga Testo sottostante
        if (eRigaAccordi(rigaCorrente) && !eRigaAccordi(rigaSuccessiva) && rigaSuccessiva.trim() !== "") {
            let accordiRestanti = rigaCorrente;
            let testoRestante = rigaSuccessiva;

            while (testoRestante.length > RIGHE_MAX || accordiRestanti.length > RIGHE_MAX) {
                // Trova l'ultimo spazio utile entro gli 80 caratteri nel testo
                let puntoSpezzo = testoRestante.lastIndexOf(' ', RIGHE_MAX);
                if (puntoSpezzo <= 0) puntoSpezzo = RIGHE_MAX; 

                let testoTroncato = testoRestante.substring(0, puntoSpezzo);
                testoRestante = testoRestante.substring(puntoSpezzo).trimStart();

                // Taglia gli accordi in esatta corrispondenza speculare del testo troncato
                let accordiTroncati = accordiRestanti.substring(0, puntoSpezzo);
                accordiRestanti = accordiRestanti.substring(puntoSpezzo);

                risultato.push(accordiTroncati.trimEnd());
                risultato.push(testoTroncato);
            }

            if (accordiRestanti.trim() || testoRestante.trim()) {
                risultato.push(accordiRestanti.trimEnd());
                risultato.push(testoRestante);
            }
            i++; // Salta la riga del testo perché già elaborata nel blocco
        } else {
            // Riga singola lunga (es: testo senza accordi sopra o riga di commento)
            let testoRestante = rigaCorrente;
            while (testoRestante.length > RIGHE_MAX) {
                let puntoSpezzo = testoRestante.lastIndexOf(' ', RIGHE_MAX);
                if (puntoSpezzo <= 0) puntoSpezzo = RIGHE_MAX;
                risultato.push(testoRestante.substring(0, puntoSpezzo));
                testoRestante = testoRestante.substring(puntoSpezzo).trimStart();
            }
            if (testoRestante) risultato.push(testoRestante);
        }
    }
    return risultato.join('\n');
}



// Questa funzione viene chiamata da CanzoniereSmart.js per elaborare il testo
function render() {
    const container = document.getElementById("song-content");
    if (!container || !originalText) return; 

    const scalaRiferimento = currentNotation === "IT" ? noteItaliane : noteInglesi;

    // --- NUOVA LOGICA WCAG INTERCETTATA QUI ---
    // Se l'opzione è attiva, lavoriamo sulla versione compattata a 80 caratteri di originalText
    let testoDaElaborare = wcagCompattatoAttivo ? compattaTestoWCAG80(originalText) : originalText;

    // Divide la canzone in singole righe (usando testoDaElaborare invece di originalText)
    let righe = testoDaElaborare.split("\n");
    
    let righeElaborate = righe.map(riga => {
        // ... (TUTTO IL RESTO DELLA TUA FUNZIONE RENDER RIMANE IDENTICO E INVARIATO) ...
        let paroleLunge = riga.match(/\b[a-zA-Zàèìòù]{4,}\b/g);
        if (paroleLunge && paroleLunge.length > 0) {
            let contieneSoloEstensioni = paroleLunge.every(p => /^(min7|maj7|sus4|diminuto)$/i.test(p));
            if (!contieneSoloEstensioni) {
                return riga; 
            }
        }

        // Se è una riga di soli accordi, applica la regex ultra-potenziata
        return riga.replace(regexAccordo, (accordoOriginale) => {
            if (accordoOriginale.includes("/")) {
                const parti = accordoOriginale.split("/");
                const infoAccordoPrincipale = analizzaAccordo(parti[0]);
                const infoBasso = analizzaAccordo(parti[1]);
                
                let risultato = "";
                
                if (infoAccordoPrincipale) {
                    let nuovoIndice = (infoAccordoPrincipale.indice + currentSemitoneShift) % 12;
                    if (nuovoIndice < 0) nuovoIndice += 12;
                    risultato += scalaRiferimento[nuovoIndice] + infoAccordoPrincipale.estensione;
                } else {
                    risultato += parti[0];
                }
                
                if (infoBasso) {
                    let nuovoIndiceBasso = (infoBasso.indice + currentSemitoneShift) % 12;
                    if (nuovoIndiceBasso < 0) nuovoIndiceBasso += 12;
                    risultato += "/" + scalaRiferimento[nuovoIndiceBasso] + infoBasso.estensione;
                } else {
                    risultato += "/" + (parti[1] || "");
                }
                
                return `<span class="chord">${risultato}</span>`;
            }

            const infoAccordo = analizzaAccordo(accordoOriginale);
            if (infoAccordo) {
                let nuovoIndice = (infoAccordo.indice + currentSemitoneShift) % 12;
                if (nuovoIndice < 0) nuovoIndice += 12;
                
                return `<span class="chord">${scalaRiferimento[nuovoIndice] + infoAccordo.estensione}</span>`;
            }
            return accordoOriginale;
        });
    });

    // Ricompone il testo unendo le righe elaborate
    container.innerHTML = righeElaborate.join("\n");
}

// Analizzatore dell'accordo (Invariato, mantenuto intatto)
function analizzaAccordo(testo) {
    let notaEstratta = "";
    let estensione = "";
    const tutteLeNote = [...noteItaliane, ...noteInglesi, ...Object.keys(mappaNormalizzazione)];
    
    tutteLeNote.sort((a, b) => b.length - a.length);

    for (let nota of tutteLeNote) {
        if (testo.startsWith(nota)) {
            notaEstratta = nota;
            estensione = testo.substring(nota.length);
            break;
        }
    }

    if (!notaEstratta) return null;

    if (mappaNormalizzazione[notaEstratta]) {
        notaEstratta = mappaNormalizzazione[notaEstratta];
    }

    let indice = noteItaliane.indexOf(notaEstratta);
    if (indice === -1) {
        indice = noteInglesi.indexOf(notaEstratta);
    }

    return { indice, estensione };
}
