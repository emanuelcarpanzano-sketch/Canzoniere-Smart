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



// Questa funzione viene chiamata da CanzoniereSmart.js per elaborare il testo
function render() {
    const container = document.getElementById("song-content");
    if (!container || !originalText) return; 

    const scalaRiferimento = currentNotation === "IT" ? noteItaliane : noteInglesi;

    // Divide la canzone in singole righe
    let righe = originalText.split("\n");
    
    let righeElaborate = righe.map(riga => {
        // REGOLA DI SICUREZZA: Se la riga contiene parole più lunghe di 4 caratteri 
        // che NON sono estensioni note, è una riga di testo. Non toccarla.
        // Cerca parole comuni come "cantina", "dove", "buia", "giorni"
        let paroleLunge = riga.match(/\b[a-zA-Zàèìòù]{4,}\b/g);
        
        // Se ci sono parole lunghe nel testo, restituisce la riga intatta senza cercare accordi
        if (paroleLunge && paroleLunge.length > 0) {
            // Unica eccezione: verifica se la parola lunga non sia un'estensione come "maj7" o "min7" isolata
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