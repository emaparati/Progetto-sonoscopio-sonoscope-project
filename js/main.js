// =====================================================================
// SONOSCOPIO - analizzatore audio in tempo reale
// =====================================================================
//
// COSA FA QUESTO PROGRAMMA
//   Ascolta un suono (da un file o dal microfono), lo scompone nelle
//   sue frequenze e lo disegna in tre modi diversi: barre, curva dello
//   spettro e sonogramma. In più misura il livello complessivo (RMS e
//   picco), come uno strumento da studio di mastering.
//
// COME È ORGANIZZATO (leggilo come un indice)
//   Sezione 1  Riferimenti agli elementi della pagina
//   Sezione 2  Impostazioni (valori che puoi modificare)
//   Sezione 3  Stato del programma (variabili che cambiano)
//   Sezione 4  Preparazione dell'audio (i "cavi" tra i componenti)
//   Sezione 5  Funzioni di supporto (calcoli, colori, testi)
//   Sezione 6  Le tre modalità di disegno
//   Sezione 7  Il ciclo di animazione (ripetuto ~60 volte al secondo)
//   Sezione 8  Gestione delle sorgenti: file, microfono, slider
//   Sezione 9  Avvio
//
// CONVENZIONI DI SCRITTURA USATE
//   - NOMI_IN_MAIUSCOLO sono costanti: impostazioni che non cambiano
//     mentre il programma gira.
//   - nomiInCamelCase sono variabili e funzioni. Le funzioni hanno un
//     verbo ("disegnaBarre", "caricaFileAudio") perché FANNO qualcosa.
//   - "const" dichiara un nome il cui valore non verrà riassegnato;
//     "let" un nome che invece cambierà durante l'esecuzione.
//   - Un commento inizia con "//": il browser lo ignora.
// =====================================================================


// =====================================================================
// SEZIONE 1: RIFERIMENTI AGLI ELEMENTI DELLA PAGINA
// ---------------------------------------------------------------------
// Nell'HTML abbiamo scritto gli elementi (tela, pulsanti...), ognuno con
// un "id". Qui li andiamo a "prendere" una volta sola e li salviamo in
// costanti con un nome comodo, così il resto del codice li usa senza
// doverli cercare ogni volta.
// =====================================================================

// getElementById cerca nella pagina l'elemento con quell'id.
const tela = document.getElementById("tela");

// Per disegnare su un canvas serve il suo "contesto di disegno" 2D:
// è il nostro pennello. Tutte le istruzioni di disegno passano da qui.
const pennello = tela.getContext("2d");

const selettoreFile = document.getElementById("selettoreFile");       // campo di scelta del file
const pulsanteMicrofono = document.getElementById("pulsanteMicrofono"); // pulsante del microfono
const lettore = document.getElementById("lettore");                   // il lettore audio <audio>
const menuModalita = document.getElementById("menuModalita");         // menu delle modalità
const cursoreFluidita = document.getElementById("cursoreFluidita");   // slider della fluidità
const valoreFluidita = document.getElementById("valoreFluidita");     // numero accanto allo slider
const testoMessaggio = document.getElementById("messaggio");          // paragrafo dei messaggi


// =====================================================================
// SEZIONE 2: IMPOSTAZIONI
// ---------------------------------------------------------------------
// Qui stanno tutti i numeri "regolabili" del programma. Averli in un
// unico punto significa che per cambiare l'aspetto o il comportamento
// basta modificare una riga qui, senza cercare nel resto del codice.
// =====================================================================

// ----- Analisi audio -------------------------------------------------

// Quanti campioni audio l'analizzatore usa per ogni analisi. Deve essere
// una potenza di 2. Più è alto, più dettaglio sulle frequenze ma anche
// più lentezza nella risposta: 4096 campioni a 44.100 Hz sono circa 93 ms.
const DIMENSIONE_FFT = 4096;

// Fluidità iniziale di barre e spettro, da 0 (reazioni nervose, istantanee)
// a 0.95 (movimenti molto morbidi). È un valore di partenza: l'utente
// lo può cambiare con lo slider.
const FLUIDITA_INIZIALE = 0.85;

// Il sonogramma vuole poca "sfocatura nel tempo", altrimenti i dettagli
// ritmici si impastano. Per questo ha una fluidità fissa e più bassa.
const FLUIDITA_SONOGRAMMA = 0.4;

// L'analizzatore converte ogni livello in un numero da 0 a 255. Questi due
// valori dicono a quali decibel corrispondono gli estremi: -100 dB è
// "silenzio" (0), -30 dB è "massimo" (255). Le scale dei grafici li usano.
const DB_MINIMO = -100;
const DB_MASSIMO = -30;

// ----- Barre e curva ---------------------------------------------------

const NUMERO_BARRE = 32;   // quante barre disegnare nella modalità "Barre"
const NUMERO_PUNTI = 64;   // quanti punti compongono la curva "Spettro"

// ----- Area dei grafici (misure in pixel della tela) ---------------------
// Lasciamo dei margini attorno al grafico per far posto alle scritte.

const GRAFICO_X = 56;           // distanza dal bordo sinistro della tela
const GRAFICO_Y = 16;           // distanza dal bordo superiore
const GRAFICO_LARGHEZZA = 720;  // larghezza del grafico del sonogramma
const GRAFICO_ALTEZZA = 430;    // altezza del grafico (uguale in tutte le modalità)

// Larghezza del grafico di barre e spettro: tutta la tela meno il margine
// sinistro e un margine destro di 24 pixel. Il sonogramma è più stretto
// perché a destra ha il pannello con scala colori e misuratore.
const LARGHEZZA_SPETTRO = tela.width - GRAFICO_X - 24;

// ----- Scale di frequenza e di tempo --------------------------------------

const PIXEL_AL_SECONDO = 90;  // velocità di scorrimento del sonogramma
                              // (720 pixel / 90 = 8 secondi visibili)
const FREQ_MINIMA = 20;       // frequenza più bassa mostrata, in Hz
const FREQ_MASSIMA = 20000;   // frequenza più alta mostrata, in Hz

// Le frequenze che avranno una linea di griglia e una scritta sugli assi.
// Ogni elemento è una coppia [valore in Hz, testo da scrivere].
const ETICHETTE_FREQUENZA = [
  [20, "20"], [50, "50"], [100, "100"], [200, "200"], [500, "500"],
  [1000, "1k"], [2000, "2k"], [5000, "5k"], [10000, "10k"], [20000, "20k"]
];

// ----- Sonogramma: pannello di destra ---------------------------------------

const SCALA_COLORI_X = 792;       // posizione orizzontale della scala colori
const SCALA_COLORI_LARGH = 12;    // sua larghezza
const MISURATORE_X = 880;         // posizione orizzontale del misuratore di livello
const MISURATORE_LARGH = 24;      // sua larghezza
const MISURATORE_DB_MIN = -60;    // il misuratore va da -60 dB (in basso)...
const MISURATORE_DB_MAX = 0;      // ...a 0 dB (in alto, il "fondoscala")

// ----- Misure di livello (RMS e picco) -----------------------------------------

const TEMPO_RMS = 0.6;                // "memoria" della media RMS, in secondi (più alto = più lenta)
const TEMPO_TENUTA_PICCO = 1.5;       // secondi in cui il picco resta fermo prima di scendere
const DISCESA_PICCO_DB_AL_SEC = 12;   // poi il picco scende di tanti decibel al secondo
const INTERVALLO_NUMERI = 0.25;       // ogni quanti secondi si aggiornano i numeri scritti a schermo

// ----- Colori di testi e linee -----------------------------------------------------

const COLORE_TESTO = "#9aa0c9";
const COLORE_GRIGLIA = "rgba(236, 235, 250, 0.14)"; // rgba = rosso, verde, blu + trasparenza (0.14 = molto trasparente)
const COLORE_BORDO = "#2c3570";

// ----- Mappa colori del sonogramma (stile "magma") -----------------------------------
// Ogni riga è [posizione da 0 a 1, rosso, verde, blu]. Tra un punto e il
// successivo i colori vengono sfumati. Il primo punto è identico allo sfondo
// della pagina: il silenzio "scompare" nel fondo.
const PUNTI_COLORE = [
  [0.00, 15, 21, 48],
  [0.25, 81, 18, 124],
  [0.50, 183, 55, 121],
  [0.75, 252, 137, 97],
  [1.00, 252, 253, 191]
];


// =====================================================================
// SEZIONE 3: STATO DEL PROGRAMMA
// ---------------------------------------------------------------------
// Variabili il cui valore CAMBIA mentre il programma gira (per questo
// si usa "let" e non "const"). Insieme descrivono "a che punto siamo".
// =====================================================================

// Il "mixer" audio e l'analizzatore. All'inizio non esistono (null = "niente"):
// li creiamo solo quando l'utente sceglie una sorgente, perché i browser
// vietano di avviare l'audio senza un'azione dell'utente.
let contestoAudio = null;
let analizzatore = null;

// Il microfono: il flusso audio e la sua "presa" nel mixer. Esistono solo
// mentre il microfono è acceso.
let flussoMicrofono = null;
let sorgenteMicrofono = null;

// Quale sorgente è in uso: "nessuna", "file" oppure "microfono".
let sorgenteCorrente = "nessuna";

// La fluidità attuale di barre e spettro: parte dal valore iniziale
// e cambia quando l'utente muove lo slider.
let fluidita = FLUIDITA_INIZIALE;

// Larghezza in Hz di un "contenitore" dello spettro (vedi la spiegazione
// più sotto). Il valore iniziale suppone un audio a 44.100 Hz; viene
// corretto in preparaAudio, quando conosciamo la frequenza vera.
let larghezzaContenitore = 44100 / DIMENSIONE_FFT;

// LO SPETTRO. L'analizzatore divide il suono in "contenitori" di frequenza:
// il primo contiene i suoni più gravi, l'ultimo i più acuti. Per ogni
// contenitore ci dà un numero intero da 0 (silenzio) a 255 (massimo).
// Uint8Array è una lista di numeri interi da 0 a 255. La lunghezza è la
// metà di DIMENSIONE_FFT: 2048 contenitori.
const datiFrequenza = new Uint8Array(DIMENSIONE_FFT / 2);

// LA FORMA D'ONDA. È la lista dei valori istantanei del segnale, da -1 a +1.
// Float32Array è una lista di numeri decimali. Serve per misurare RMS e picco.
const datiOnda = new Float32Array(DIMENSIONE_FFT);

// IL SONOGRAMMA. Si disegna su una seconda tela, "nascosta": creata dal
// codice ma mai inserita nella pagina. È la "memoria" del grafico.
// A ogni fotogramma la facciamo scorrere a sinistra e aggiungiamo a destra
// le colonne di pixel nuove; poi la copiamo sulla tela visibile.
const telaSonogramma = document.createElement("canvas");
telaSonogramma.width = GRAFICO_LARGHEZZA;
telaSonogramma.height = GRAFICO_ALTEZZA;
const pennelloSonogramma = telaSonogramma.getContext("2d"); // il pennello della tela nascosta

// Una tabella con una voce per ogni riga di pixel del sonogramma:
// dice da quale contenitore dello spettro prendere il valore.
// La riempie costruisciTabellaRighe, quando conosciamo l'audio.
const contenitorePerRiga = new Float32Array(GRAFICO_ALTEZZA);

let istanteUltimoFotogramma = 0;  // istante (in ms) dell'ultimo fotogramma disegnato
let scorrimentoResiduo = 0;       // frazioni di pixel "avanzate" dallo scorrimento

// Stato delle misure di livello
let potenzaMediata = 0;                    // energia media (RMS al quadrato), con memoria
let rmsCorrenteDb = MISURATORE_DB_MIN;     // livello RMS attuale, in dB
let piccoTrattenutoDb = MISURATORE_DB_MIN; // picco trattenuto, in dB
let timerPicco = 0;                        // da quanti secondi il picco è fermo
let rmsMostratoDb = MISURATORE_DB_MIN;     // i valori SCRITTI a schermo: si aggiornano
let piccoMostratoDb = MISURATORE_DB_MIN;   // solo a intervalli, per restare leggibili
let timerNumeri = 0;                       // secondi dall'ultimo aggiornamento dei numeri


// =====================================================================
// SEZIONE 4: PREPARAZIONE DELL'AUDIO
// ---------------------------------------------------------------------
// La Web Audio API funziona come uno studio con strumenti collegati da
// cavi. Qui creiamo i componenti e li colleghiamo una sola volta:
//
//   FILE:       lettore --> sorgenteFile --+--> analizzatore --> (muto) --> casse
//                                          +--> casse
//   MICROFONO:  microfono -----------------------> analizzatore --> (muto) --> casse
//
// Il file va ANCHE alle casse perché lo dobbiamo sentire. Il microfono
// invece NO: se uscisse dalle casse, il suono rientrerebbe nel microfono
// e si creerebbe il fischio del feedback (effetto Larsen).
// =====================================================================
function preparaAudio() {
  // Se il mixer esiste già, non rifare tutto. È obbligatorio: il browser
  // permette di collegare un elemento <audio> al mixer UNA SOLA VOLTA.
  // Questo schema ("controllo e uscita subito") si chiama "early return".
  if (contestoAudio) return;

  // Il mixer dove vivono tutti i componenti audio.
  contestoAudio = new AudioContext();

  // L'analizzatore: misura il suono che gli passa attraverso senza modificarlo.
  analizzatore = contestoAudio.createAnalyser();
  analizzatore.fftSize = DIMENSIONE_FFT;
  analizzatore.smoothingTimeConstant = fluidita; // fa la media con i fotogrammi precedenti

  // Fissiamo noi la gamma di decibel (corrisponde ai valori di default, ma
  // scriverli rende esplicito il legame con le scale dei grafici).
  analizzatore.minDecibels = DB_MINIMO;
  analizzatore.maxDecibels = DB_MASSIMO;

  // Ora conosciamo la frequenza di campionamento vera dell'audio
  // (di solito 44.100 o 48.000 campioni al secondo): prepariamo le tabelle.
  costruisciTabellaRighe(contestoAudio.sampleRate);
  larghezzaContenitore = contestoAudio.sampleRate / DIMENSIONE_FFT;

  // IL FILE. createMediaElementSource trasforma il lettore <audio> in una
  // "sorgente" del mixer. La colleghiamo sia all'analizzatore (per misurarla)
  // sia alle casse (contestoAudio.destination) per sentirla.
  const sorgenteFile = contestoAudio.createMediaElementSource(lettore);
  sorgenteFile.connect(analizzatore);
  sorgenteFile.connect(contestoAudio.destination);

  // L'analizzatore viene collegato alle casse attraverso un controllo di
  // volume messo a zero. Non si sente nulla, ma così il browser è certo di
  // dover elaborare il segnale (alcuni browser non lo farebbero per nodi
  // "senza uscita"). È una cautela di compatibilità.
  const silenziatore = contestoAudio.createGain();
  silenziatore.gain.value = 0;
  analizzatore.connect(silenziatore);
  silenziatore.connect(contestoAudio.destination);
}


// =====================================================================
// SEZIONE 5: FUNZIONI DI SUPPORTO
// ---------------------------------------------------------------------
// Una funzione è un blocco di codice con un nome: lo scriviamo una volta
// e lo richiamiamo quando serve. Qui ci sono i "piccoli attrezzi" usati
// dalle modalità di disegno.
// =====================================================================

// ----- 5A. Colore di barre e curva -----------------------------------------

// Riceve una posizione tra 0 (frequenze basse) e 1 (acute) e restituisce un
// colore che va gradualmente dal viola al corallo. Usa il modello HSL
// (tonalità, saturazione, luminosità): cambiando solo la tonalità (il primo
// numero) si percorre l'arcobaleno. I backtick ` ` permettono di inserire
// valori calcolati dentro un testo con la sintassi ${...}.
function coloreBarra(posizione) {
  return `hsl(${270 + posizione * 130} 85% 62%)`;
}

// ----- 5B. Bande di frequenza ----------------------------------------------

// Restituisce un valore tra 0 e 1 per la banda numero "indice" su "totale".
//
// IL PROBLEMA: l'orecchio non sente le frequenze in modo lineare. Dai 100
// ai 200 Hz c'è un'ottava intera (il doppio), dai 10.000 ai 10.100 Hz quasi
// nessuna differenza. Se dividessimo lo spettro in bande uguali in Hz, quasi
// tutto lo spazio andrebbe agli acuti, dove succede poco.
//
// LA SOLUZIONE: bande LOGARITMICHE. Ogni banda ha una frequenza di inizio
// pari alla precedente moltiplicata per un fattore costante, così ognuna
// copre lo stesso numero di ottave. Coincidono con la griglia dei grafici.
function valoreBanda(indice, totale) {
  // Quante volte la frequenza massima è più grande della minima (1000 volte).
  const rapporto = FREQ_MASSIMA / FREQ_MINIMA;

  // Frequenza iniziale e finale della banda, poi convertite in "numero di
  // contenitore" dividendo per la larghezza di un contenitore in Hz.
  // L'operatore ** significa "elevato a". Il risultato ha la virgola.
  const inizio = (FREQ_MINIMA * rapporto ** (indice / totale)) / larghezzaContenitore;
  const fine = (FREQ_MINIMA * rapporto ** ((indice + 1) / totale)) / larghezzaContenitore;

  // Ultimo contenitore che possiamo leggere (-2 per poter sempre guardare
  // anche quello successivo senza uscire dalla lista).
  const contenitoreMassimo = datiFrequenza.length - 2;

  // CASO 1 - banda più stretta di un contenitore (succede sui bassi):
  // non c'è un contenitore tutto suo. Prendiamo il centro della banda e
  // facciamo una media pesata tra i due contenitori vicini.
  if (fine - inizio < 1) {
    const centro = Math.min((inizio + fine) / 2, contenitoreMassimo);
    const intero = Math.floor(centro);          // parte intera, es. 37 da 37.4
    const frazione = centro - intero;           // parte decimale, es. 0.4
    // Con 0.4 prendiamo il 60% del contenitore 37 e il 40% del 38.
    return (datiFrequenza[intero] * (1 - frazione) + datiFrequenza[intero + 1] * frazione) / 255;
  }

  // CASO 2 - banda più larga di un contenitore (succede sugli acuti):
  // contiene più contenitori. Ne facciamo la media.
  const primo = Math.min(Math.floor(inizio), contenitoreMassimo);
  const ultimo = Math.min(Math.max(Math.floor(fine), primo), contenitoreMassimo);
  let somma = 0;
  for (let k = primo; k <= ultimo; k++) {
    somma += datiFrequenza[k];
  }
  // Media (dividendo per quanti sono) e poi da 0-255 a 0-1 (dividendo per 255).
  return somma / (ultimo - primo + 1) / 255;
}

// ----- 5C. Curva morbida ---------------------------------------------------

// Traccia una curva morbida che passa "vicino" a tutti i punti di una lista.
// NON disegna: prepara solo il tracciato. Poi chi la chiama decide se
// riempirlo (fill) o disegnarne il contorno (stroke).
//
// Come funziona: ogni punto fa da "calamita" che piega la curva, e la curva
// si ferma a metà strada tra un punto e il successivo. Così gli spigoli
// tra un segmento e l'altro spariscono.
function tracciaCurva(punti) {
  // Ci posizioniamo sul primo punto senza disegnare.
  pennello.moveTo(punti[0].x, punti[0].y);

  // Per ogni punto intermedio...
  for (let i = 1; i < punti.length - 1; i++) {
    // ...calcoliamo il punto a metà strada tra questo e il successivo...
    const mezzoX = (punti[i].x + punti[i + 1].x) / 2;
    const mezzoY = (punti[i].y + punti[i + 1].y) / 2;
    // ...e tracciamo una curva "quadratica": parte da dove siamo, è attirata
    // verso il punto i (primi due numeri) e arriva al punto di mezzo.
    pennello.quadraticCurveTo(punti[i].x, punti[i].y, mezzoX, mezzoY);
  }

  // L'ultimo tratto è una linea dritta fino all'ultimo punto.
  const ultimoPunto = punti[punti.length - 1];
  pennello.lineTo(ultimoPunto.x, ultimoPunto.y);
}

// ----- 5D. Colori del sonogramma -----------------------------------------------

// Trasforma un valore tra 0 e 1 in un colore, sfumando tra i punti di PUNTI_COLORE.
function coloreCalore(valore) {
  // Cerchiamo tra quali due punti della mappa cade il valore.
  for (let i = 1; i < PUNTI_COLORE.length; i++) {
    const a = PUNTI_COLORE[i - 1]; // punto precedente
    const b = PUNTI_COLORE[i];     // punto successivo

    if (valore <= b[0]) {
      // Trovato. "t" dice quanto siamo avanti tra a e b: 0 = su a, 1 = su b.
      const t = (valore - a[0]) / (b[0] - a[0]);
      // Interpolazione lineare di ciascun canale: a + (b - a) * t.
      const rosso = Math.round(a[1] + (b[1] - a[1]) * t);
      const verde = Math.round(a[2] + (b[2] - a[2]) * t);
      const blu = Math.round(a[3] + (b[3] - a[3]) * t);
      return `rgb(${rosso}, ${verde}, ${blu})`;
    }
  }
  // Se il valore supera l'ultimo punto, usiamo l'ultimo colore.
  return "rgb(252, 253, 191)";
}

// Prepara in anticipo i 256 colori possibili: uno per ogni valore (0-255)
// che l'analizzatore può restituire. Calcolarli una volta sola è molto più
// veloce che rifare i calcoli per ogni pixel (sono 430 pixel per colonna,
// 60 volte al secondo).
function costruisciColoriCalore() {
  const colori = [];
  for (let v = 0; v < 256; v++) {
    colori.push(coloreCalore(v / 255)); // v / 255 porta il valore tra 0 e 1
  }
  return colori;
}
const COLORI_CALORE = costruisciColoriCalore();

// ----- 5E. Conversioni tra frequenze, decibel e posizioni sullo schermo --------

// Per ogni riga di pixel del sonogramma calcola a quale contenitore dello
// spettro corrisponde. L'asse è LOGARITMICO: salendo di una riga, la
// frequenza viene moltiplicata per un fattore costante, quindi ogni ottava
// occupa lo stesso spazio verticale.
function costruisciTabellaRighe(frequenzaCampionamento) {
  const larghezzaContenitoreRiga = frequenzaCampionamento / DIMENSIONE_FFT; // Hz per contenitore

  for (let y = 0; y < GRAFICO_ALTEZZA; y++) {
    // 1 in cima (frequenze acute), 0 in fondo (frequenze gravi).
    const posizione = 1 - y / (GRAFICO_ALTEZZA - 1);
    const frequenza = FREQ_MINIMA * (FREQ_MASSIMA / FREQ_MINIMA) ** posizione;
    // Il risultato ha la virgola (es. 37.4): servirà per una media pesata.
    contenitorePerRiga[y] = Math.min(frequenza / larghezzaContenitoreRiga, datiFrequenza.length - 2);
  }
}

// Posizione verticale (y sulla tela) di una frequenza, nel sonogramma.
// È l'operazione inversa della precedente: usa il logaritmo.
function frequenzaAY(frequenza) {
  const posizione = Math.log(frequenza / FREQ_MINIMA) / Math.log(FREQ_MASSIMA / FREQ_MINIMA);
  return GRAFICO_Y + (1 - posizione) * (GRAFICO_ALTEZZA - 1);
}

// Posizione orizzontale (x sulla tela) di una frequenza, per barre e spettro.
function frequenzaAX(frequenza) {
  const posizione = Math.log(frequenza / FREQ_MINIMA) / Math.log(FREQ_MASSIMA / FREQ_MINIMA);
  return GRAFICO_X + posizione * LARGHEZZA_SPETTRO;
}

// Posizione verticale di un livello in decibel sul misuratore.
function dbAY(db) {
  // Da dB a un numero tra 0 (in fondo) e 1 (in cima).
  const t = (db - MISURATORE_DB_MIN) / (MISURATORE_DB_MAX - MISURATORE_DB_MIN);
  // Lo "stringiamo" tra 0 e 1: valori fuori scala restano dentro il misuratore.
  const limitato = Math.min(1, Math.max(0, t));
  return GRAFICO_Y + GRAFICO_ALTEZZA * (1 - limitato);
}

// Converte un'ampiezza (da 0 a 1) in decibel: 20 * log10(ampiezza).
// Il silenzio assoluto (0) darebbe -infinito, quindi lo gestiamo a parte.
function inDecibel(ampiezza) {
  if (ampiezza <= 0) return -Infinity;
  return 20 * Math.log10(ampiezza);
}

// Prepara il testo di un livello in dB: un decimale, oppure "--" se è silenzio.
function formattaDb(db) {
  return db <= MISURATORE_DB_MIN ? "--" : db.toFixed(1);
}

// ----- 5F. Misure di livello (RMS e picco) ---------------------------------------

// Aggiorna le misure di livello. "trascorso" è il numero di secondi passati
// dall'ultimo fotogramma. Va chiamata a ogni fotogramma, in qualsiasi modalità.
function aggiornaLivelli(trascorso) {
  // PASSO 1 - Misura grezza di questo istante: sommiamo i quadrati di tutti
  // i campioni e teniamo da parte quello con valore assoluto più alto.
  let sommaQuadrati = 0;
  let picco = 0;
  for (let i = 0; i < datiOnda.length; i++) {
    const campione = datiOnda[i];
    sommaQuadrati += campione * campione;
    picco = Math.max(picco, Math.abs(campione)); // Math.abs toglie il segno
  }
  // Energia media istantanea (la media dei quadrati).
  const mediaQuadrati = sommaQuadrati / datiOnda.length;

  // PASSO 2 - RMS "con memoria" (media mobile esponenziale).
  // Un valore istantaneo salterebbe in continuazione e sarebbe illeggibile.
  // Ad ogni fotogramma il valore smussato si sposta di una frazione ("peso")
  // verso la misura nuova: più è piccola la frazione, più memoria c'è.
  // Il peso dipende dal tempo trascorso, non dal numero di fotogrammi: così
  // il comportamento è uguale su schermi a 60 e a 120 Hz.
  // Mediamo l'ENERGIA e solo dopo ricaviamo i decibel: mediare i dB direttamente
  // sarebbe sbagliato, perché un istante di silenzio vale -infinito.
  const peso = 1 - Math.exp(-trascorso / TEMPO_RMS);
  potenzaMediata += (mediaQuadrati - potenzaMediata) * peso;
  // La radice quadrata dell'energia media è l'RMS (root mean square).
  rmsCorrenteDb = Math.max(MISURATORE_DB_MIN, inDecibel(Math.sqrt(potenzaMediata)));

  // PASSO 3 - Picco trattenuto: sale subito, resta fermo un po', poi scende piano.
  const piccoDb = Math.max(MISURATORE_DB_MIN, inDecibel(picco));
  if (piccoDb >= piccoTrattenutoDb) {
    piccoTrattenutoDb = piccoDb;  // nuovo picco: lo teniamo e azzeriamo l'attesa
    timerPicco = 0;
  } else {
    timerPicco += trascorso;      // contiamo da quanto tempo è fermo
    if (timerPicco > TEMPO_TENUTA_PICCO) {
      // Scende di una quantità proporzionale al tempo trascorso.
      piccoTrattenutoDb = Math.max(MISURATORE_DB_MIN, piccoTrattenutoDb - DISCESA_PICCO_DB_AL_SEC * trascorso);
    }
  }

  // PASSO 4 - I numeri scritti a schermo si aggiornano solo a intervalli:
  // se cambiassero 60 volte al secondo sarebbero illeggibili.
  timerNumeri += trascorso;
  if (timerNumeri >= INTERVALLO_NUMERI) {
    timerNumeri = 0;
    rmsMostratoDb = rmsCorrenteDb;
    piccoMostratoDb = piccoTrattenutoDb;
  }
}

// ----- 5G. Testi e riquadri ------------------------------------------------------

// Imposta in un colpo solo come verranno scritti i testi successivi:
// carattere, colore, allineamento orizzontale e linea di base verticale.
// allineamento: "left", "right" oppure "center" (rispetto al punto dato).
// lineaBase: "top", "middle" oppure "bottom" (rispetto al punto dato).
function impostaStileTesto(allineamento, lineaBase) {
  pennello.font = "11px system-ui, sans-serif";
  pennello.fillStyle = COLORE_TESTO;
  pennello.textAlign = allineamento;
  pennello.textBaseline = lineaBase;
}

// Disegna il riquadro con RMS e picco, in alto a destra nel grafico.
// "bordoDestro" è la x del bordo destro del grafico, che cambia da una
// modalità all'altra.
function disegnaRiquadroLivelli(bordoDestro) {
  const largRiquadro = 190;
  const altRiquadro = 52;
  const x = bordoDestro - largRiquadro - 10; // 10 pixel di distanza dal bordo
  const y = GRAFICO_Y + 10;

  // Sfondo semitrasparente (così la griglia dietro resta appena visibile) e bordo.
  pennello.fillStyle = "rgba(15, 21, 48, 0.82)";
  pennello.fillRect(x, y, largRiquadro, altRiquadro);
  pennello.strokeStyle = COLORE_BORDO;
  pennello.lineWidth = 1;
  pennello.strokeRect(x + 0.5, y + 0.5, largRiquadro - 1, altRiquadro - 1);

  // Le due righe da scrivere: ognuna è una coppia [etichetta, valore].
  const righe = [["RMS", rmsMostratoDb], ["Picco", piccoMostratoDb]];

  for (let i = 0; i < righe.length; i++) {
    const yRiga = y + 16 + i * 22; // altezza del centro di questa riga

    // Etichetta piccola, allineata a sinistra.
    impostaStileTesto("left", "middle");
    pennello.fillText(righe[i][0], x + 12, yRiga);

    // Numero grande e chiaro, allineato a destra.
    pennello.font = "600 17px system-ui, sans-serif";
    pennello.fillStyle = "#ecebfa";
    pennello.textAlign = "right";
    pennello.fillText(formattaDb(righe[i][1]), x + largRiquadro - 40, yRiga);

    // Unità di misura piccola, subito a destra del numero.
    impostaStileTesto("left", "middle");
    pennello.fillText("dB", x + largRiquadro - 32, yRiga);
  }
}

// Disegna griglia, scritte e bordo per barre e spettro:
// frequenza (Hz) sull'asse orizzontale, livello (dB) sull'asse verticale.
function disegnaAssiSpettro() {
  const fondo = GRAFICO_Y + GRAFICO_ALTEZZA; // y del bordo inferiore del grafico
  pennello.lineWidth = 1;
  pennello.strokeStyle = COLORE_GRIGLIA;

  // LINEE ORIZZONTALI: una ogni 10 dB, da -30 (in alto) a -100 (in basso).
  // Il "+ 0.5" serve perché una linea di 1 pixel su una coordinata intera
  // verrebbe sfocata a cavallo di due pixel; a metà resta nitida.
  impostaStileTesto("right", "middle");
  for (let db = DB_MASSIMO; db >= DB_MINIMO; db -= 10) {
    const y = Math.round(GRAFICO_Y + ((DB_MASSIMO - db) / (DB_MASSIMO - DB_MINIMO)) * GRAFICO_ALTEZZA) + 0.5;

    pennello.beginPath();                                // nuovo tracciato
    pennello.moveTo(GRAFICO_X, y);                       // partenza (a sinistra)
    pennello.lineTo(GRAFICO_X + LARGHEZZA_SPETTRO, y);   // arrivo (a destra)
    pennello.stroke();                                   // disegna davvero la linea

    pennello.fillText(`${db}`, GRAFICO_X - 8, y);        // scritta a sinistra della linea
  }

  // LINEE VERTICALI: una per ogni frequenza della lista ETICHETTE_FREQUENZA.
  impostaStileTesto("center", "top");
  for (let i = 0; i < ETICHETTE_FREQUENZA.length; i++) {
    const x = Math.round(frequenzaAX(ETICHETTE_FREQUENZA[i][0])) + 0.5;

    pennello.beginPath();
    pennello.moveTo(x, GRAFICO_Y);
    pennello.lineTo(x, fondo);
    pennello.stroke();

    pennello.fillText(ETICHETTE_FREQUENZA[i][1], x, fondo + 8); // scritta sotto il grafico
  }

  // Nomi degli assi: "dB" in alto a sinistra, "Hz" in basso a destra.
  impostaStileTesto("right", "bottom");
  pennello.fillText("dB", GRAFICO_X - 8, GRAFICO_Y - 2);
  impostaStileTesto("right", "top");
  pennello.fillText("Hz", GRAFICO_X + LARGHEZZA_SPETTRO, fondo + 24);

  // Bordo del grafico.
  pennello.strokeStyle = COLORE_BORDO;
  pennello.strokeRect(GRAFICO_X + 0.5, GRAFICO_Y + 0.5, LARGHEZZA_SPETTRO, GRAFICO_ALTEZZA);
}


// =====================================================================
// SEZIONE 6: LE TRE MODALITÀ DI DISEGNO
// ---------------------------------------------------------------------
// Ogni modalità è una funzione separata. Aggiungerne una nuova significa
// scrivere una nuova funzione e aggiungere un ramo in "disegna" (Sezione 7).
// =====================================================================

// ----- Modalità 1: BARRE ---------------------------------------------------
function disegnaBarre() {
  // Prima gli assi: le barre vengono disegnate sopra la griglia, come in
  // uno strumento vero.
  disegnaAssiSpettro();

  const larghezzaBarra = LARGHEZZA_SPETTRO / NUMERO_BARRE; // spazio assegnato a ogni barra
  const fondo = GRAFICO_Y + GRAFICO_ALTEZZA;

  for (let i = 0; i < NUMERO_BARRE; i++) {
    // Valore tra 0 e 1 per questa banda di frequenza.
    const valore = valoreBanda(i, NUMERO_BARRE);
    // Altezza in pixel: il valore 1 (= -30 dB) riempie tutto il grafico.
    const altezzaBarra = valore * GRAFICO_ALTEZZA;

    pennello.fillStyle = coloreBarra(i / NUMERO_BARRE);
    // fillRect(x, y, larghezza, altezza). Ricorda: nel canvas l'asse y cresce
    // verso il BASSO, quindi la barra parte dal fondo e "sale" di altezzaBarra.
    // +1 e -2 lasciano un piccolo spazio tra una barra e la successiva.
    pennello.fillRect(GRAFICO_X + i * larghezzaBarra + 1, fondo - altezzaBarra, larghezzaBarra - 2, altezzaBarra);
  }
}

// ----- Modalità 2: SPETTRO (curva) ------------------------------------------
function disegnaCurva() {
  disegnaAssiSpettro();

  const fondo = GRAFICO_Y + GRAFICO_ALTEZZA;

  // Calcoliamo un punto al centro di ogni banda. Ogni punto è un "oggetto"
  // con due proprietà, x e y: { x: ..., y: ... }.
  const punti = [];
  for (let i = 0; i < NUMERO_PUNTI; i++) {
    const x = GRAFICO_X + ((i + 0.5) / NUMERO_PUNTI) * LARGHEZZA_SPETTRO;
    const y = fondo - valoreBanda(i, NUMERO_PUNTI) * GRAFICO_ALTEZZA;
    punti.push({ x: x, y: y });
  }
  const primoPunto = punti[0];
  const ultimoPunto = punti[punti.length - 1];

  // RIEMPIMENTO: una sfumatura verticale (colorata in alto, quasi trasparente
  // in basso) limitata all'area del grafico.
  const riempimento = pennello.createLinearGradient(0, GRAFICO_Y, 0, fondo);
  riempimento.addColorStop(0, "rgba(150, 120, 255, 0.45)");
  riempimento.addColorStop(1, "rgba(150, 120, 255, 0.02)");

  pennello.beginPath();
  tracciaCurva(punti);                       // la curva...
  pennello.lineTo(ultimoPunto.x, fondo);     // ...scendiamo sul fondo a destra...
  pennello.lineTo(primoPunto.x, fondo);      // ...torniamo a sinistra...
  pennello.closePath();                      // ...e chiudiamo la forma.
  pennello.fillStyle = riempimento;
  pennello.fill();                           // fill = riempie l'interno della forma

  // LINEA: una sfumatura orizzontale dal viola al corallo, come nelle barre.
  const linea = pennello.createLinearGradient(GRAFICO_X, 0, GRAFICO_X + LARGHEZZA_SPETTRO, 0);
  linea.addColorStop(0, coloreBarra(0));
  linea.addColorStop(1, coloreBarra(1));

  pennello.beginPath();
  tracciaCurva(punti);                       // ritraccia solo la curva (senza chiuderla)
  pennello.strokeStyle = linea;
  pennello.lineWidth = 3;
  pennello.lineJoin = "round";               // giunzioni arrotondate
  pennello.stroke();                         // stroke = disegna solo il contorno
}

// ----- Modalità 3: SONOGRAMMA ----------------------------------------------

// Fa scorrere a sinistra la tela nascosta di "larghezza" pixel e disegna le
// colonne nuove sul bordo destro, usando lo spettro del momento.
function aggiungiColonneSonogramma(larghezza) {
  // Ricopiamo la tela nascosta su se stessa, spostata a sinistra: il
  // contenuto esistente scorre e a destra resta uno spazio vuoto.
  pennelloSonogramma.drawImage(telaSonogramma, -larghezza, 0);

  // Per ogni riga di pixel scegliamo il colore in base all'intensità
  // della frequenza che quella riga rappresenta.
  for (let y = 0; y < GRAFICO_ALTEZZA; y++) {
    const posizione = contenitorePerRiga[y];   // es. 37.4: tra il contenitore 37 e il 38
    const intero = Math.floor(posizione);      // 37
    const frazione = posizione - intero;       // 0.4

    // Media pesata tra i due contenitori vicini (interpolazione lineare):
    // sui bassi le righe di pixel sono più dei contenitori, e senza questo
    // passaggio si vedrebbero "gradini".
    const valore = datiFrequenza[intero] * (1 - frazione) + datiFrequenza[intero + 1] * frazione;

    // Il valore (0-255) diventa un colore pescato dalla tabella precalcolata.
    pennelloSonogramma.fillStyle = COLORI_CALORE[Math.round(valore)];
    pennelloSonogramma.fillRect(GRAFICO_LARGHEZZA - larghezza, y, larghezza, 1);
  }
}

// Disegna griglia, scritte e bordo del sonogramma.
function disegnaAssiSonogramma() {
  pennello.lineWidth = 1;
  pennello.strokeStyle = COLORE_GRIGLIA;

  // LINEE ORIZZONTALI: una per ogni frequenza indicata, con la scritta a sinistra.
  impostaStileTesto("right", "middle");
  for (let i = 0; i < ETICHETTE_FREQUENZA.length; i++) {
    const y = Math.round(frequenzaAY(ETICHETTE_FREQUENZA[i][0])) + 0.5;

    pennello.beginPath();
    pennello.moveTo(GRAFICO_X, y);
    pennello.lineTo(GRAFICO_X + GRAFICO_LARGHEZZA, y);
    pennello.stroke();

    pennello.fillText(ETICHETTE_FREQUENZA[i][1], GRAFICO_X - 8, y);
  }

  // LINEE VERTICALI: una ogni 2 secondi, contando all'indietro da "ora" (a destra).
  const secondiVisibili = GRAFICO_LARGHEZZA / PIXEL_AL_SECONDO;
  impostaStileTesto("center", "top");
  for (let s = 0; s <= secondiVisibili; s += 2) {
    const x = Math.round(GRAFICO_X + GRAFICO_LARGHEZZA - s * PIXEL_AL_SECONDO) + 0.5;

    pennello.beginPath();
    pennello.moveTo(x, GRAFICO_Y);
    pennello.lineTo(x, GRAFICO_Y + GRAFICO_ALTEZZA);
    pennello.stroke();

    // A destra "ora", poi "-2 s", "-4 s"...
    pennello.fillText(s === 0 ? "ora" : `-${s} s`, x, GRAFICO_Y + GRAFICO_ALTEZZA + 8);
  }

  // Titolo dell'asse verticale.
  impostaStileTesto("right", "bottom");
  pennello.fillText("Hz", GRAFICO_X - 8, GRAFICO_Y - 2);

  // Bordo del grafico.
  pennello.strokeStyle = COLORE_BORDO;
  pennello.strokeRect(GRAFICO_X + 0.5, GRAFICO_Y + 0.5, GRAFICO_LARGHEZZA, GRAFICO_ALTEZZA);
}

// Disegna la scala colori: una barra sfumata con tre indicazioni in dB.
function disegnaScalaColori() {
  // Una sfumatura verticale: in alto il colore del massimo, in basso quello
  // del silenzio, con tre colori intermedi.
  const sfumatura = pennello.createLinearGradient(0, GRAFICO_Y, 0, GRAFICO_Y + GRAFICO_ALTEZZA);
  sfumatura.addColorStop(0, COLORI_CALORE[255]);
  sfumatura.addColorStop(0.25, COLORI_CALORE[191]);
  sfumatura.addColorStop(0.5, COLORI_CALORE[128]);
  sfumatura.addColorStop(0.75, COLORI_CALORE[64]);
  sfumatura.addColorStop(1, COLORI_CALORE[0]);

  pennello.fillStyle = sfumatura;
  pennello.fillRect(SCALA_COLORI_X, GRAFICO_Y, SCALA_COLORI_LARGH, GRAFICO_ALTEZZA);
  pennello.strokeStyle = COLORE_BORDO;
  pennello.strokeRect(SCALA_COLORI_X + 0.5, GRAFICO_Y + 0.5, SCALA_COLORI_LARGH - 1, GRAFICO_ALTEZZA - 1);

  // Tre scritte: massimo in alto, valore intermedio al centro, minimo in basso.
  const xScritte = SCALA_COLORI_X + SCALA_COLORI_LARGH + 6;
  impostaStileTesto("left", "middle");
  pennello.fillText(`${DB_MASSIMO}`, xScritte, GRAFICO_Y + 6);
  pennello.fillText(`${(DB_MASSIMO + DB_MINIMO) / 2}`, xScritte, GRAFICO_Y + GRAFICO_ALTEZZA / 2);
  pennello.fillText(`${DB_MINIMO}`, xScritte, GRAFICO_Y + GRAFICO_ALTEZZA - 6);

  impostaStileTesto("left", "bottom");
  pennello.fillText("dB", SCALA_COLORI_X, GRAFICO_Y - 2);
}

// Disegna il misuratore di livello: barra RMS, picco e scala.
function disegnaMisuratore(rmsDb) {
  const fondo = GRAFICO_Y + GRAFICO_ALTEZZA;

  // Sfondo del misuratore: un rettangolo molto trasparente.
  pennello.fillStyle = "rgba(236, 235, 250, 0.08)";
  pennello.fillRect(MISURATORE_X, GRAFICO_Y, MISURATORE_LARGH, GRAFICO_ALTEZZA);

  // Barra del livello RMS. La sfumatura copre tutto il misuratore (dal fondo
  // alla cima), ma disegniamo solo la parte fino al livello attuale: è
  // come se la barra "svelasse" una striscia colorata.
  const sfumatura = pennello.createLinearGradient(0, fondo, 0, GRAFICO_Y);
  sfumatura.addColorStop(0, COLORI_CALORE[70]);
  sfumatura.addColorStop(0.6, COLORI_CALORE[150]);
  sfumatura.addColorStop(1, COLORI_CALORE[255]);

  const yRms = dbAY(rmsDb);
  pennello.fillStyle = sfumatura;
  pennello.fillRect(MISURATORE_X, yRms, MISURATORE_LARGH, fondo - yRms);

  // Lineetta bianca del picco trattenuto.
  pennello.fillStyle = "#ecebfa";
  pennello.fillRect(MISURATORE_X, dbAY(piccoTrattenutoDb) - 1, MISURATORE_LARGH, 2);

  // Scala del misuratore: un trattino e un numero per ogni livello.
  const tacche = [0, -12, -24, -36, -48, -60];
  impostaStileTesto("left", "middle");
  for (let i = 0; i < tacche.length; i++) {
    const y = dbAY(tacche[i]);
    pennello.fillRect(MISURATORE_X + MISURATORE_LARGH, y, 4, 1);
    pennello.fillText(`${tacche[i]}`, MISURATORE_X + MISURATORE_LARGH + 8, y);
  }

  // Titolo.
  impostaStileTesto("left", "bottom");
  pennello.fillText("Livello", MISURATORE_X, GRAFICO_Y - 2);
}

// La funzione principale del sonogramma. "trascorso" sono i secondi passati
// dal fotogramma precedente.
function disegnaSonogramma(trascorso) {
  // Il grafico scorre solo mentre c'è audio in riproduzione (in pausa si ferma).
  // Lo scorrimento dipende dal TEMPO, non dal numero di fotogrammi, così la
  // velocità è identica su schermi a 60 e a 120 Hz.
  if (staSuonando()) {
    scorrimentoResiduo += trascorso * PIXEL_AL_SECONDO;
    const colonne = Math.floor(scorrimentoResiduo);   // pixel INTERI da aggiungere
    if (colonne > 0) {
      scorrimentoResiduo -= colonne;                  // teniamo da parte la parte decimale
      aggiungiColonneSonogramma(colonne);
    }
  }

  // Copiamo la tela nascosta sulla tela principale e disegniamo il resto sopra.
  pennello.drawImage(telaSonogramma, GRAFICO_X, GRAFICO_Y);
  disegnaAssiSonogramma();
  disegnaScalaColori();
  disegnaMisuratore(rmsCorrenteDb);
}


// =====================================================================
// SEZIONE 7: CICLO DI ANIMAZIONE
// ---------------------------------------------------------------------
// "disegna" produce UN fotogramma e alla fine chiede al browser di
// richiamarla per il prossimo. Così si crea un ciclo che gira circa 60 volte
// al secondo, come i disegni di un flipbook che sfogliati rapidamente
// sembrano un movimento. Il browser passa in "tempo" i millisecondi trascorsi
// da quando la pagina è stata aperta.
// =====================================================================
function disegna(tempo) {
  // Secondi trascorsi dall'ultimo fotogramma. Il limite di 0.1 evita uno
  // "scatto" enorme se la scheda resta in background per un po'.
  const trascorso = Math.min((tempo - istanteUltimoFotogramma) / 1000, 0.1);
  istanteUltimoFotogramma = tempo;

  // La modalità scelta nel menu: "barre", "curva" oppure "sonogramma".
  const modalita = menuModalita.value;

  // Se l'analizzatore esiste, leggiamo i dati di questo istante.
  if (analizzatore) {
    // Il sonogramma usa una fluidità fissa; barre e spettro quella dello slider.
    analizzatore.smoothingTimeConstant = modalita === "sonogramma" ? FLUIDITA_SONOGRAMMA : fluidita;
    // Queste due funzioni RIEMPIONO le liste che abbiamo creato in Sezione 3:
    // non restituiscono nulla, scrivono direttamente nelle liste.
    analizzatore.getByteFrequencyData(datiFrequenza); // lo spettro (0-255)
    analizzatore.getFloatTimeDomainData(datiOnda);    // la forma d'onda (-1...+1)
    aggiornaLivelli(trascorso);                       // misure RMS e picco
  }

  // Cancelliamo il fotogramma precedente (altrimenti si sovrapporrebbero).
  pennello.clearRect(0, 0, tela.width, tela.height);

  // Disegniamo con la modalità scelta. Il confronto "===" verifica che i
  // due valori siano identici.
  if (modalita === "barre") {
    disegnaBarre();
  } else if (modalita === "curva") {
    disegnaCurva();
  } else {
    disegnaSonogramma(trascorso);
  }

  // Il riquadro con RMS e picco compare in tutte le modalità. Il bordo destro
  // del grafico cambia: il sonogramma è più stretto delle altre due.
  disegnaRiquadroLivelli(modalita === "sonogramma" ? GRAFICO_X + GRAFICO_LARGHEZZA : GRAFICO_X + LARGHEZZA_SPETTRO);

  // Chiediamo al browser di richiamare "disegna" al prossimo fotogramma.
  requestAnimationFrame(disegna);
}


// =====================================================================
// SEZIONE 8: GESTIONE DELLE SORGENTI AUDIO E DEI CONTROLLI
// ---------------------------------------------------------------------
// Funzioni che reagiscono alle azioni dell'utente: scegliere un file,
// accendere il microfono, muovere lo slider.
// =====================================================================

// Scrive un messaggio per l'utente. Una stringa vuota ("") lo cancella.
function mostraMessaggio(messaggio) {
  testoMessaggio.textContent = messaggio;
}

// Dice se in questo momento c'è audio "che scorre": col microfono sempre,
// con un file solo se non è in pausa né finito.
function staSuonando() {
  if (sorgenteCorrente === "microfono") return true;
  if (sorgenteCorrente === "file") return !lettore.paused && !lettore.ended;
  return false;
}

// ----- Microfono ---------------------------------------------------------------

// Spegne il microfono: scollega la "presa" e libera il dispositivo.
function fermaMicrofono() {
  if (sorgenteMicrofono) sorgenteMicrofono.disconnect();
  if (flussoMicrofono) {
    // Un flusso audio è fatto di "tracce". Fermarle dice al browser di spegnere
    // davvero il microfono (e fa sparire l'indicatore di registrazione).
    // forEach esegue la funzione indicata su ogni elemento della lista.
    flussoMicrofono.getTracks().forEach(function (traccia) { traccia.stop(); });
  }
  sorgenteMicrofono = null;
  flussoMicrofono = null;
  if (sorgenteCorrente === "microfono") sorgenteCorrente = "nessuna";
  pulsanteMicrofono.textContent = "Usa il microfono";
}

// Accende il microfono. La funzione è "async" perché chiedere il permesso
// all'utente richiede tempo: con "await" aspettiamo la risposta prima di
// proseguire con la riga successiva.
async function avviaMicrofono() {
  preparaAudio();
  if (contestoAudio.state === "suspended") {
    await contestoAudio.resume(); // i browser tengono l'audio "sospeso" finché l'utente non interagisce
  }

  lettore.pause();      // se stava suonando un file, lo fermiamo
  lettore.hidden = true;

  // try/catch: "prova a eseguire questo; se fallisce, esegui quest'altro".
  try {
    // Chiediamo il microfono. Spegniamo i filtri automatici del browser
    // (eliminazione dell'eco, riduzione del rumore, controllo del volume):
    // sono pensati per le videochiamate e altererebbero la nostra misura.
    flussoMicrofono = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
  } catch (errore) {
    // L'utente ha negato il permesso, oppure non c'è un microfono disponibile.
    mostraMessaggio("Microfono non disponibile: controlla i permessi del browser e riprova.");
    return;
  }

  // Collegamento: microfono -> analizzatore. NON alle casse (niente fischio).
  sorgenteMicrofono = contestoAudio.createMediaStreamSource(flussoMicrofono);
  sorgenteMicrofono.connect(analizzatore);

  sorgenteCorrente = "microfono";
  pulsanteMicrofono.textContent = "Ferma il microfono";
  mostraMessaggio("");
}

// Il pulsante funziona da interruttore: se il microfono è acceso lo spegne,
// altrimenti lo accende.
function commutaMicrofono() {
  if (sorgenteCorrente === "microfono") {
    fermaMicrofono();
  } else {
    avviaMicrofono();
  }
}

// ----- File audio --------------------------------------------------------------

// Viene eseguita quando l'utente sceglie un file.
function caricaFileAudio() {
  // La lista dei file scelti può contenerne più di uno: prendiamo il primo.
  const file = selettoreFile.files[0];
  if (!file) return; // se l'utente ha annullato la scelta, non c'è nessun file

  fermaMicrofono(); // se il microfono era acceso, lo spegniamo
  preparaAudio();   // costruisce la catena audio (solo la prima volta)

  if (contestoAudio.state === "suspended") {
    contestoAudio.resume();
  }

  // Il file è sul computer dell'utente, non su Internet. Il browser può però
  // creare un indirizzo temporaneo, valido solo in questa scheda, che punta ad esso.
  const indirizzo = URL.createObjectURL(file);
  lettore.src = indirizzo;
  lettore.hidden = false; // mostriamo il lettore
  lettore.play();         // facciamo partire la riproduzione

  sorgenteCorrente = "file";
  mostraMessaggio("");
}

// ----- Slider della fluidità -----------------------------------------------------

// Viene chiamata ogni volta che l'utente muove lo slider.
function alCambioFluidita() {
  // Il valore di uno slider è un TESTO ("0.30"): parseFloat lo converte in numero.
  fluidita = parseFloat(cursoreFluidita.value);
  // toFixed(2) mostra sempre due decimali (es. "0.30" e non "0.3").
  valoreFluidita.textContent = fluidita.toFixed(2);
}


// =====================================================================
// SEZIONE 9: AVVIO
// ---------------------------------------------------------------------
// Qui prepariamo l'interfaccia, colleghiamo ogni controllo alla sua
// funzione e facciamo partire il ciclo di animazione.
// =====================================================================

// Impostiamo lo slider sul valore iniziale e mostriamo il numero accanto.
cursoreFluidita.value = FLUIDITA_INIZIALE;
valoreFluidita.textContent = FLUIDITA_INIZIALE.toFixed(2);

// addEventListener significa: "quando succede QUESTO evento su QUESTO
// elemento, esegui QUESTA funzione". Nota: passiamo il NOME della funzione,
// senza parentesi, perché non vogliamo eseguirla ora ma solo al momento giusto.
selettoreFile.addEventListener("change", caricaFileAudio);       // scelta di un file
pulsanteMicrofono.addEventListener("click", commutaMicrofono);   // clic sul pulsante
cursoreFluidita.addEventListener("input", alCambioFluidita);     // movimento dello slider

// Primo fotogramma: da qui il ciclo continua da solo.
requestAnimationFrame(disegna);
