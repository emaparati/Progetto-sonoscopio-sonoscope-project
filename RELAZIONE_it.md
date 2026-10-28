# Sonoscopio: relazione tecnica del progetto

Analizzatore audio in tempo reale per il browser · Relazione per il portfolio

[English version](REPORT.en.md)

## Indice

- [1. Introduzione e obiettivi](#1-introduzione-e-obiettivi)
- [2. Funzionalità](#2-funzionalità)
- [3. Strumenti e tecnologie](#3-strumenti-e-tecnologie)
- [4. Struttura del progetto](#4-struttura-del-progetto)
- [5. Concetti di base](#5-concetti-di-base)
- [6. Architettura e flusso di funzionamento](#6-architettura-e-flusso-di-funzionamento)
- [7. Analisi del codice, sezione per sezione](#7-analisi-del-codice-sezione-per-sezione)
- [8. Scelte progettuali e motivazioni](#8-scelte-progettuali-e-motivazioni)
- [9. Evoluzione del progetto e problemi risolti](#9-evoluzione-del-progetto-e-problemi-risolti)
- [10. Verifica e test](#10-verifica-e-test)
- [11. Limiti noti](#11-limiti-noti)
- [12. Possibili sviluppi](#12-possibili-sviluppi)
- [13. Esecuzione e pubblicazione](#13-esecuzione-e-pubblicazione)
- [Appendice A: corrispondenza tra i nomi originali e quelli della copia](#appendice-a-corrispondenza-tra-i-nomi-originali-e-quelli-della-copia)
- [Appendice B: glossario](#appendice-b-glossario)

## 1. Introduzione e obiettivi

Sonoscopio è un'applicazione web che ascolta un suono, proveniente da un file audio o dal microfono, lo scompone nelle sue frequenze e lo mostra in tempo reale con tre visualizzazioni diverse. Ai grafici affianca un misuratore del livello complessivo, con valori di RMS e di picco, ispirato agli strumenti usati negli studi di mastering.

Il progetto nasce con tre obiettivi:

- realizzare un lavoro da portfolio che si apra con un clic, senza installare nulla, e che dimostri competenze di audio digitale e di sviluppo front-end;
- mettere a frutto e consolidare le conoscenze del percorso di studi (JavaScript, elaborazione del segnale, informatica multimediale, creative computing);
- comprendere a fondo ogni parte del codice: per questo il progetto è stato costruito a piccoli passi e commentato in dettaglio.

Il progetto non usa librerie né framework: solo HTML, CSS e JavaScript puro, con le API del browser. È una scelta voluta, perché mostra di saper lavorare con ciò che sta «sotto» le librerie.

## 2. Funzionalità

- **Due sorgenti audio**: un file del computer (MP3, WAV, OGG...) oppure il microfono, con un pulsante che lo accende e lo spegne.
- **Tre modalità di visualizzazione**: Barre, Spettro (una curva frequenza/livello) e Sonogramma (tempo, frequenza e intensità come colore).
- **Assi cartesiani graduati** in ogni modalità. Barre e Spettro hanno la frequenza in Hz sull'asse orizzontale (scala logaritmica da 20 Hz a 20 kHz) e il livello in dB su quello verticale. Il Sonogramma ha il tempo sull'asse orizzontale e la frequenza su quello verticale.
- **Scala colori e misuratore di livello** nel Sonogramma.
- **Riquadro con RMS e picco** visibile in tutte le modalità, con calcoli distribuiti nel tempo e non istantanei.
- **Slider della fluidità**, che regola quanto sono morbidi i movimenti di barre e spettro.
- **Gestione degli errori**: se il permesso del microfono viene negato compare un messaggio che spiega cosa fare.
- **Interfaccia curata**: tavolozza coerente, navigazione da tastiera, etichette associate ai controlli.

## 3. Strumenti e tecnologie

| Tecnologia | Ruolo nel progetto |
|---|---|
| HTML5 | Struttura della pagina: tela, pulsanti, menu, slider |
| CSS3 | Aspetto: colori, disposizione con flexbox, adattamento a schermi stretti |
| JavaScript (ES6+) | Logica dell'applicazione: costanti, funzioni, cicli, eventi, funzioni asincrone |
| Web Audio API | Costruzione della catena audio e analisi del suono (`AudioContext`, `AnalyserNode`, sorgenti, nodo di guadagno) |
| Canvas 2D API | Disegno dei grafici pixel per pixel |
| `requestAnimationFrame` | Ciclo di animazione sincronizzato con lo schermo |
| `getUserMedia` | Richiesta di accesso al microfono |
| Sublime Text | Editor usato per scrivere il codice |
| Node.js | Usato solo per i controlli automatici durante lo sviluppo, non serve per far funzionare il progetto |
| Git e GitHub | Pubblicazione e versionamento |

## 4. Struttura del progetto

```text
sonoscopio/
├── index.html          struttura della pagina
├── css/
│   └── stile.css       aspetto
├── js/
│   └── sonoscopio.js   comportamento
└── docs/
    ├── RELAZIONE.it.md relazione in italiano
    └── REPORT.en.md    relazione in inglese
```

Il codice è diviso in tre file, ciascuno con un solo compito: l'HTML dice **che cosa c'è** nella pagina, il CSS dice **com'è fatto**, il JavaScript dice **che cosa fa**. Questa separazione delle responsabilità è una buona pratica: se si vuole cambiare un colore si apre il CSS, se si vuole cambiare un comportamento si apre il JavaScript, senza cercare in un unico file lungo.

Il file principale si chiama `index.html` perché è il nome che i server web, compreso GitHub Pages, cercano per primo. Rinominarlo impedirebbe alla pagina di aprirsi scrivendo soltanto l'indirizzo della cartella.

Il JavaScript è in un unico file diviso in nove sezioni numerate (descritte nel capitolo 7). Ho evitato volutamente i moduli ES (`import` ed `export`), perché richiedono un server locale anche solo per provare il progetto. Con un normale tag `<script src="...">` basta un doppio clic su `index.html`.

## 5. Concetti di base

### 5.1 Il suono come numeri

Per un computer il suono è una lunga lista di numeri, chiamati **campioni**, che indicano a che altezza si trova l'onda sonora in ciascun istante. Una scheda audio ne produce di solito 44.100 o 48.000 al secondo (**frequenza di campionamento**). Disegnare questa lista dà la **forma d'onda**, la linea ondulata dei programmi di editing audio.

### 5.2 Spettro e FFT

La forma d'onda mostra quanto è forte il suono, ma non se è grave o acuto. La **FFT** (Fast Fourier Transform) scompone il suono nelle frequenze che lo compongono e dice quanta energia c'è in ciascuna. Il risultato è lo **spettro**: i bassi a sinistra, gli acuti a destra. Non scriviamo noi il calcolo, lo esegue il browser attraverso l'`AnalyserNode`.

### 5.3 I contenitori di frequenza

L'analizzatore divide lo spettro in «contenitori» (in inglese *bin*): ciascuno ci dà un numero da 0 a 255. Con `fftSize` uguale a 4096 si ottengono 2048 contenitori; a 44.100 Hz ognuno è largo circa 10,8 Hz. Un `fftSize` più grande dà più dettaglio sulle frequenze ma una risposta più lenta, perché ogni analisi copre una finestra di tempo più lunga (circa 93 ms con 4096 campioni). È un compromesso classico, e 4096 è risultato adatto al Sonogramma, dove serve distinguere bene i bassi.

### 5.4 Scala logaritmica delle frequenze

L'orecchio percepisce le frequenze in modo logaritmico: da 100 a 200 Hz c'è un'ottava intera, da 10.000 a 10.100 Hz la differenza è quasi impercettibile. Con una scala lineare quasi tutto lo spazio andrebbe agli acuti, dove succede poco. Per questo il progetto usa una scala **logaritmica**, in cui ogni ottava occupa lo stesso spazio. È la scala degli strumenti professionali e coincide con le linee della griglia disegnata.

### 5.5 Decibel

Il decibel (dB) è una scala logaritmica per i livelli sonori: `20 · log10(ampiezza)`. Nell'audio digitale 0 dB è il livello massimo possibile (**dBFS**, fondoscala) e tutti gli altri livelli sono negativi. Il progetto rappresenta lo spettro tra -100 dB (silenzio) e -30 dB (massimo del grafico), e il misuratore di livello tra -60 e 0 dB.

### 5.6 RMS e picco

L'**RMS** (*root mean square*, radice della media dei quadrati) misura il livello medio, ed è più vicino a ciò che l'orecchio percepisce come «volume». Si calcola elevando al quadrato i campioni, facendone la media ed estraendo la radice. Il **picco** è invece il campione più alto in valore assoluto, e indica quanto ci si avvicina al limite oltre il quale il segnale distorce.

### 5.7 Il sonogramma

Il sonogramma è un grafico a tre dimensioni: il **tempo** scorre sull'asse orizzontale, la **frequenza** sta su quello verticale e l'**intensità** è rappresentata dal colore. Permette di vedere come cambia la composizione del suono nel tempo: una nota tenuta compare come una linea orizzontale, un colpo di percussione come una colonna verticale.

## 6. Architettura e flusso di funzionamento

### 6.1 La catena audio

La Web Audio API funziona come uno studio con strumenti collegati da cavi. Il progetto costruisce questa catena una sola volta:

```text
FILE:       lettore -> sorgenteFile -+-> analizzatore -> silenziatore (volume 0) -> casse
                                     +-> casse
MICROFONO:  microfono --------------------> analizzatore -> silenziatore (volume 0) -> casse
```

Il file viene collegato anche alle casse, perché deve essere udibile. Il microfono invece **non** va alle casse: altrimenti il suono uscirebbe, rientrerebbe nel microfono e si creerebbe il fischio del feedback (effetto Larsen). L'analizzatore misura il segnale senza modificarlo.

### 6.2 Il ciclo di funzionamento

1. L'utente sceglie un file o accende il microfono. Il clic è obbligatorio: i browser vietano di avviare l'audio senza un'azione dell'utente.
2. Al primo utilizzo vengono creati il «mixer» (`AudioContext`), l'analizzatore e i collegamenti.
3. A ogni fotogramma (circa 60 volte al secondo) la funzione `disegna` chiede all'analizzatore lo spettro e la forma d'onda, riempiendo due liste di numeri.
4. Dalla forma d'onda si aggiornano le misure di livello (RMS e picco).
5. Si cancella la tela e si disegna la modalità scelta nel menu.
6. Si disegna il riquadro con i valori di livello.
7. La funzione chiede al browser di richiamarla al fotogramma successivo, e il ciclo ricomincia.

## 7. Analisi del codice, sezione per sezione

Il file `sonoscopio.js` è organizzato in nove sezioni. Ogni funzione ha un nome che inizia con un verbo (`disegnaBarre`, `caricaFileAudio`) perché fa qualcosa, mentre le costanti sono scritte in MAIUSCOLO.

### Sezione 1: riferimenti agli elementi della pagina

Con `document.getElementById` si cercano una volta sola gli elementi dell'HTML e li si salva in costanti (`tela`, `selettoreFile`, `pulsanteMicrofono`...). Il contesto di disegno 2D della tela, chiamato `pennello`, è l'oggetto attraverso cui passa ogni istruzione di disegno.

### Sezione 2: impostazioni

Tutti i numeri regolabili stanno in un unico punto: dimensione della FFT, fluidità, gamma dei decibel, numero di barre, dimensioni e margini dei grafici, scale di frequenza e di tempo, tempi delle misure di livello, colori. Per cambiare l'aspetto o il comportamento basta modificare una riga, senza cercare nel resto del codice.

### Sezione 3: stato del programma

Contiene le variabili che cambiano durante l'esecuzione, dichiarate con `let`: il mixer e l'analizzatore (che all'inizio valgono `null`, cioè «niente»), la sorgente in uso, la fluidità attuale e i valori delle misure di livello. Qui nascono anche le liste dove l'analizzatore scrive i risultati (`datiFrequenza`, un `Uint8Array`, e `datiOnda`, un `Float32Array`) e la **tela nascosta** del sonogramma, di cui parlerò più avanti.

### Sezione 4: preparazione dell'audio

La funzione `preparaAudio` crea il mixer, l'analizzatore e i collegamenti descritti nel capitolo 6. Inizia con un controllo di uscita anticipata (*early return*): se il mixer esiste già non rifà nulla. È obbligatorio, perché il browser permette di collegare un elemento `<audio>` al mixer una sola volta.

### Sezione 5: funzioni di supporto

Sono i «piccoli attrezzi» usati dalle modalità di disegno:

- `coloreBarra` produce un colore dal viola al corallo in funzione della posizione, variando solo la tonalità del modello HSL.
- `valoreBanda` restituisce un valore da 0 a 1 per una banda di frequenza. Le bande sono logaritmiche. Quando una banda è più stretta di un contenitore (sui bassi) si interpolano i due contenitori vicini; quando ne contiene diversi (sugli acuti) se ne fa la media.
- `tracciaCurva` unisce una lista di punti con una curva morbida, usando curve quadratiche e punti medi, così da eliminare gli spigoli.
- `coloreCalore` e `costruisciColoriCalore` creano la tavolozza «magma» del sonogramma, sfumando tra cinque colori. I 256 colori possibili vengono calcolati una volta sola, perché ricalcolarli per ogni pixel sarebbe molto più lento.
- `costruisciTabellaRighe`, `frequenzaAY`, `frequenzaAX` e `dbAY` convertono frequenze e decibel in posizioni sullo schermo e viceversa.
- `aggiornaLivelli` calcola RMS e picco (vedi il capitolo 8).
- `impostaStileTesto`, `disegnaRiquadroLivelli` e `disegnaAssiSpettro` si occupano di testi, riquadro dei valori e griglia degli assi.

### Sezione 6: le tre modalità di disegno

- **Barre** (`disegnaBarre`): disegna prima gli assi, poi una barra per ogni banda. L'altezza è il valore della banda moltiplicato per l'altezza del grafico. Poiché nel canvas l'asse verticale cresce verso il basso, ogni barra parte dal fondo e sale.
- **Spettro** (`disegnaCurva`): calcola un punto per banda e li unisce con la curva morbida, in due passaggi. Il primo riempie l'area sotto la curva con una sfumatura verticale, il secondo disegna la linea con una sfumatura orizzontale.
- **Sonogramma** (`disegnaSonogramma` e funzioni collegate): usa una seconda tela, nascosta, come memoria. A ogni fotogramma questa tela viene ricopiata su se stessa spostata a sinistra, si disegnano le colonne nuove sul bordo destro, e poi la tela viene copiata su quella visibile, con sopra assi, scala colori e misuratore.

### Sezione 7: ciclo di animazione

La funzione `disegna` calcola il tempo trascorso dal fotogramma precedente (con un massimo di 0,1 secondi, per evitare scatti se la scheda resta in background), legge i dati dall'analizzatore, aggiorna i livelli, cancella la tela, richiama la modalità scelta e ripianifica se stessa con `requestAnimationFrame`.

### Sezione 8: gestione di sorgenti e controlli

Raccoglie le funzioni che reagiscono all'utente: `caricaFileAudio`, `avviaMicrofono`, `fermaMicrofono`, `commutaMicrofono`, `alCambioFluidita`, oltre a due funzioni di utilità, `mostraMessaggio` e `staSuonando`. `avviaMicrofono` è asincrona: usa `await` per aspettare la risposta dell'utente alla richiesta di permesso e un blocco `try/catch` per gestire il caso in cui venga negato.

### Sezione 9: avvio

Imposta lo slider sul valore iniziale, collega con `addEventListener` ogni controllo alla propria funzione e avvia il primo fotogramma. Si passa il nome della funzione senza parentesi, perché la funzione non va eseguita subito ma solo quando l'evento si verifica.

## 8. Scelte progettuali e motivazioni

- **Nessuna libreria.** Con JavaScript puro si dimostra di capire come funzionano Web Audio e Canvas. Il progetto resta leggero e si apre con un doppio clic.
- **Bande logaritmiche e assi veritieri.** Barre, Spettro e Sonogramma condividono la stessa scala di frequenze, quindi le scritte sugli assi corrispondono davvero a ciò che è disegnato.
- **Tela nascosta per il sonogramma.** Ridisegnare ogni volta tutta la storia degli ultimi secondi sarebbe pesante; scorrere un'immagine già disegnata e aggiungere solo le colonne nuove è molto più efficiente.
- **Scorrimento legato al tempo e non ai fotogrammi.** Se si aggiungesse sempre una colonna per fotogramma, il grafico andrebbe più veloce su uno schermo a 120 Hz che su uno a 60 Hz. Si moltiplicano invece i secondi trascorsi per i pixel al secondo, e le frazioni di pixel avanzate vengono accumulate nel fotogramma successivo.
- **Interpolazione nei bassi.** Sui bassi le righe di pixel del sonogramma sono più dei contenitori disponibili, e senza interpolazione si vedrebbero dei gradini. Ogni riga fa una media pesata tra i due contenitori vicini.
- **RMS con memoria, calcolato sull'energia.** Un valore istantaneo salterebbe di continuo e sarebbe illeggibile. Si usa una media mobile esponenziale con costante di tempo di 0,6 secondi: a ogni fotogramma il valore si sposta di una frazione verso la misura nuova, e quella frazione dipende dal tempo trascorso. La media si fa sull'energia (il quadrato del segnale) e solo dopo si converte in dB, perché mediare direttamente i dB sarebbe sbagliato: un istante di silenzio vale meno infinito.
- **Picco trattenuto.** Il picco sale subito, resta fermo 1,5 secondi e poi scende di 12 dB al secondo, in funzione del tempo e non dei fotogrammi.
- **Numeri aggiornati a intervalli.** Le cifre scritte a schermo cambiano quattro volte al secondo, altrimenti sarebbero illeggibili. Le barre e le curve restano invece fluide.
- **Microfono con filtri disattivati.** Eliminazione dell'eco, riduzione del rumore e controllo automatico del volume sono pensati per le videochiamate e altererebbero la misura, quindi sono spenti.
- **Nodo a volume zero.** L'analizzatore è collegato alle casse attraverso un controllo di volume a zero. Non si sente nulla, ma si evita che alcuni browser smettano di elaborare un nodo privo di uscita.
- **Fluidità separata per il sonogramma.** Il sonogramma usa una fluidità fissa e bassa, perché una media troppo forte nel tempo impasterebbe i dettagli ritmici.
- **Tabella dei colori precalcolata.** I 256 colori possibili sono calcolati una volta all'avvio: per ogni colonna del sonogramma servono 430 colori, 60 volte al secondo.

## 9. Evoluzione del progetto e problemi risolti

| Problema | Causa | Soluzione |
|---|---|---|
| La modalità «Onda» era troppo veloce e incomprensibile | La forma d'onda mostra solo gli ultimi millisecondi di audio e cambia completamente a ogni fotogramma | Sostituita con un grafico dello spettro (frequenza e livello), più lento e leggibile |
| La modalità «Radiale» aveva un vuoto al centro | Le linee partivano da un raggio interno fisso | Prima trasformata in spicchi pieni, poi sostituita dal sonogramma su richiesta |
| Le etichette sugli assi non erano affidabili | Barre e spettro usavano una scala di frequenze «inventata» | Tutte le modalità adottano le stesse bande logaritmiche della griglia |
| RMS e picco troppo istantanei | Si usava il valore di un solo fotogramma | Media mobile esponenziale, picco trattenuto e aggiornamento dei numeri a intervalli |
| Rischio di fischio con il microfono | L'uscita dell'analizzatore andava alle casse | Il microfono si collega solo all'analizzatore, mai alle casse |
| Velocità del sonogramma dipendente dallo schermo | Una colonna per fotogramma | Scorrimento calcolato sul tempo trascorso |
| Audio assente in una prova | Errore di configurazione locale, non del codice | Individuato con la console del browser e con test di isolamento: un buon esercizio di debugging |

## 10. Verifica e test

Il progetto è stato verificato in tre modi:

1. **Controllo della sintassi** di ogni file JavaScript con Node.js.
2. **Simulazione automatica** con browser e audio simulati, eseguita sulla versione precedente alla ridenominazione: 15 verifiche su accensione e spegnimento del microfono, collegamenti audio, slider, cambio di sorgente, gestione del permesso negato e assenza di errori durante i cicli di disegno nelle tre modalità.
3. **Confronto istruzione per istruzione** tra la versione originale e la copia rinominata, con gli stessi dati di ingresso: 84.015 istruzioni di disegno, tutte identiche. Questo garantisce che il rinominare file, variabili e funzioni non abbia cambiato il comportamento.

A questi controlli si aggiunge la prova pratica dell'autore nel browser, che ha confermato il corretto funzionamento. Va detto con chiarezza che la simulazione non sostituisce una prova su un browser reale: il progetto non è stato verificato su tutti i browser e dispositivi, e nel repository non ci sono ancora test automatici.

## 11. Limiti noti

- L'RMS e il picco sono misure semplici in dBFS. Gli strumenti professionali usano il **LUFS** (loudness percepita, standard EBU R128) e il *true peak*, calcoli più complessi.
- Le finestre di analisi di fotogrammi consecutivi si sovrappongono (ogni finestra dura circa 93 ms e un fotogramma arriva circa ogni 17 ms), quindi le misure sono un'approssimazione e non quelle di un misuratore normato.
- La risoluzione in frequenza sui bassi è limitata (circa 10,8 Hz per contenitore) e viene compensata con l'interpolazione.
- La tela ha dimensioni fisse in pixel. Su schermi stretti il CSS la rimpicciolisce, ma anche i testi diventano più piccoli.
- Le impostazioni non vengono salvate tra una sessione e l'altra.
- Il funzionamento del microfono dipende dai permessi del browser, e aprendo il file direttamente dal disco alcuni browser possono comportarsi in modo diverso rispetto a un sito servito in HTTPS.

## 12. Possibili sviluppi

- Misurazione **LUFS** secondo EBU R128 e *true peak*.
- **Rilevamento del beat** e visualizzazioni che reagiscono al ritmo.
- Uno **spettrogramma dell'intero brano**, oltre a quello in tempo reale.
- **Registrazione di un clip video** della visualizzazione con `MediaRecorder`.
- **Migrazione a TypeScript** con Vite, per aggiungere il controllo dei tipi e dimostrare capacità di rifattorizzazione.
- **Test automatici** nel repository.
- Tela realmente ridimensionabile, con gestione della densità di pixel dello schermo.
- Un collegamento con il **laboratorio DSP in Python e NumPy**, progetto successivo del portfolio: implementare da zero FFT e filtri e confrontare i risultati con questa applicazione.

## 13. Esecuzione e pubblicazione

Per provare il progetto basta aprire `index.html` con un doppio clic. In alternativa, con Python installato, si può avviare un server locale dalla cartella del progetto con `python -m http.server 8000` e aprire `http://localhost:8000`.

Il passo successivo è la pubblicazione su GitHub: installare Git, creare il repository, scrivere un README con una GIF di anteprima e attivare GitHub Pages per ottenere un indirizzo online da inserire nel curriculum. Il sito pubblicato usa HTTPS, quindi il microfono funzionerà senza limitazioni.

## Appendice A: corrispondenza tra i nomi originali e quelli della copia

| Nome originale | Nome in Sonoscopio | Significato |
|---|---|---|
| `main.js` | `sonoscopio.js` | file del comportamento |
| `style.css` | `stile.css` | file dell'aspetto |
| `canvas` / `g` | `tela` / `pennello` | la tela e il suo contesto di disegno |
| `audioContext` | `contestoAudio` | il mixer audio |
| `analyser` | `analizzatore` | il nodo che misura il suono |
| `frequencyData` / `timeData` | `datiFrequenza` / `datiOnda` | spettro e forma d'onda |
| `FFT_SIZE` | `DIMENSIONE_FFT` | dettaglio dell'analisi |
| `PLOT_X`, `PLOT_Y`, `PLOT_W`, `PLOT_H` | `GRAFICO_X`, `GRAFICO_Y`, `GRAFICO_LARGHEZZA`, `GRAFICO_ALTEZZA` | area dei grafici |
| `setupAudio` | `preparaAudio` | costruzione della catena audio |
| `getBandValue` | `valoreBanda` | valore di una banda di frequenza |
| `traceCurve` | `tracciaCurva` | curva morbida |
| `updateLevels` | `aggiornaLivelli` | calcolo di RMS e picco |
| `drawBars` / `drawCurve` / `drawSpectrogram` | `disegnaBarre` / `disegnaCurva` / `disegnaSonogramma` | le tre modalità |
| `draw` | `disegna` | ciclo di animazione |
| `startMicrophone` / `stopMicrophone` | `avviaMicrofono` / `fermaMicrofono` | gestione del microfono |
| `loadAudioFile` | `caricaFileAudio` | caricamento del file |
| `bars` / `curve` / `spectrogram` | `barre` / `curva` / `sonogramma` | valori del menu delle modalità |

I nomi interni al browser (come `getContext`, `createAnalyser` o `getByteFrequencyData`) non si possono cambiare e restano uguali.

## Appendice B: glossario

- **Campione**: un singolo valore numerico dell'onda sonora in un istante.
- **Frequenza di campionamento**: quanti campioni al secondo (44.100 o 48.000 nell'audio comune).
- **FFT**: algoritmo che scompone un suono nelle sue frequenze.
- **Contenitore (bin)**: una fetta dello spettro prodotto dalla FFT.
- **Ottava**: intervallo in cui la frequenza raddoppia.
- **dBFS**: decibel riferiti al livello massimo possibile nel digitale (0 dB).
- **RMS**: livello medio di un segnale, calcolato con la radice della media dei quadrati.
- **Picco**: il campione più alto in valore assoluto.
- **Sonogramma**: grafico di tempo, frequenza e intensità (colore).
- **Canvas**: elemento HTML su cui si disegna con il codice.
- **Fotogramma**: una singola immagine dell'animazione, circa 60 al secondo.
- **Media mobile esponenziale**: media in cui i valori recenti pesano più di quelli vecchi.
- **Feedback (effetto Larsen)**: fischio causato dal suono delle casse che rientra nel microfono.
