/**
 * Il testo di "L'Ultimo Piano": ogni frammento che il gioco mostra vive qui, separato dalla
 * logica di stato (engine.ts) e dalla scena 3D (scene.ts). Così la trama si può riscrivere senza
 * toccare una riga di codice.
 */

export type Ending = 'confronto' | 'fuga'

export interface ClueDef {
  id: string
  /** Titolo breve mostrato nel diario/elenco indizi. */
  title: string
  /** Testo pieno mostrato quando si esamina l'oggetto. */
  body: string
  /** Se true, trovarlo fa scattare l'avanzamento al capitolo successivo (al prossimo rientro). */
  unlocksNextChapter?: boolean
}

export interface ChapterDef {
  id: 1 | 2 | 3
  title: string
  /** Testo mostrato all'inizio del capitolo, prima di riprendere il controllo. */
  intro: string
  objective: string
  clues: ClueDef[]
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    title: 'Arrivo',
    intro:
      "Sono passati undici anni. L'agenzia immobiliare ha detto che basta svuotarlo e firmare. " +
      "L'ascensore è ancora rotto: \"ULTIMO PIANO - SOLO SCALE\" scritto a pennarello sulla porta, " +
      'la stessa calligrafia di allora. Dentro, l\'aria sa di chiuso e di qualcos\'altro che non riesco a nominare.',
    objective: 'Guardati intorno. Prendi quello che riconosci.',
    clues: [
      {
        id: 'foto-famiglia',
        title: 'La foto in salotto',
        body:
          'Una foto di famiglia, cornice d\'argento annerita. Mamma, papà, io a sette anni con il vestito a quadri. ' +
          'Dietro di me, dove dovrebbe esserci Dario, c\'è solo il divano. Non è stata tagliata: nella foto, semplicemente, ' +
          'non c\'è mai stato nessuno in quel punto. Eppure ricordo che quel giorno lui piangeva perché voleva stare in braccio a papà.',
      },
      {
        id: 'calendario',
        title: 'Il calendario in cucina',
        body:
          "Un calendario del 2014, fermo a marzo. Il 14 è cerchiato in rosso, senza scritte. " +
          "Provo a ricordare cosa fosse successo quel giorno e per un attimo — solo un attimo — sento un odore di bruciato che non c'è.",
      },
      {
        id: 'porta-sigillata',
        title: 'La porta in fondo al corridoio',
        body:
          "Una porta dipinta dello stesso colore del muro, quasi invisibile se non fosse per la maniglia. " +
          "Non si apre. Non ricordo che stanza fosse. Ho vissuto qui per otto anni e non ricordo cosa ci fosse dietro quella porta.",
      },
      {
        id: 'disegno-nascosto',
        title: 'Un disegno sotto la carta da parati',
        body:
          'Un angolo di carta da parati si stacca sotto le dita. Sotto, scritto a pennarello direttamente sull\'intonaco, un ' +
          'disegno infantile: due bambini che si tengono per mano. Uno dei due è stato cancellato con furia, graffiato fino al muro. ' +
          'Sotto, con la grafia incerta di un bambino: "MI DISPIACE DARIO". La mia grafia.',
        unlocksNextChapter: true,
      },
    ],
  },
  {
    id: 2,
    title: 'Il corridoio che non c\'era',
    intro:
      'Sono uscito per prendere aria. Quando sono rientrato, il corridoio non finiva più alla porta dipinta: continuava. ' +
      'Non dovrebbe essere possibile — il palazzo ha altri appartamenti da quel lato, l\'ho controllato io stesso sulla planimetria. ' +
      'Ma eccolo: un corridoio che non c\'era, e in fondo una porta che ora si apre.',
    objective: "Qualcosa, in fondo al corridoio, vuole essere trovato.",
    clues: [
      {
        id: 'cameretta',
        title: 'La cameretta di Dario',
        body:
          'Lettini a castello, poster scoloriti di cartoni che non esistono più. Tutto esattamente come lo ricordavo, troppo ' +
          'esattamente — come una fotografia più che una stanza vera. Sul letto in basso, quello di Dario, le coperte sono ancora disfatte.',
      },
      {
        id: 'disegni-muro',
        title: 'I disegni sul muro',
        body:
          'Decine di disegni a pennarello, sovrapposti, alcuni miei alcuni suoi. Negli ultimi, tutti uguali: una figura nera, ' +
          'alta, stretta, in piedi dentro quella che sembra una crepa nel muro. Sotto uno di questi, la mia grafia di allora: ' +
          '"L\'UOMO NEL MURO DICE CHE NON È COLPA MIA SE NON LO VEDO PIÙ".',
      },
      {
        id: 'carillon',
        title: 'Un carillon rotto',
        body:
          'Lo giro. Non suona la melodia giusta: un carillon dovrebbe suonare in avanti. Questo suona la stessa frase, breve, ' +
          'all\'indietro, più volte, come se qualcosa dietro il meccanismo insistesse a ripeterla nel verso sbagliato.',
      },
      {
        id: 'segreteria',
        title: 'La segreteria telefonica',
        body:
          'Il nastro è ancora dentro. Premo play. La voce di mamma, lontana: "...non doveva essere lì da solo, te l\'ho detto mille ' +
          'volte di controllare—". Un rumore, vetro o legno che si spacca. Poi papà, la voce spezzata: "dov\'è, dov\'è tua sorella, dov\'è—". ' +
          'Poi solo il fruscio del nastro vuoto, per quaranta secondi, prima che la segreteria si spenga da sola.',
        unlocksNextChapter: true,
      },
    ],
  },
  {
    id: 3,
    title: 'Quello che è rimasto',
    intro:
      "L'appartamento respira. Non è una metafora: i muri si muovono, piano, verso dentro e verso fuori, come un torace. " +
      'Le luci sono rimaste tre, forse quattro, e nessuna resta accesa a lungo. Da qualche parte, qualcuno cammina scalzo su un ' +
      'pavimento che non dovrebbe esserci più. Davanti a me, tre porte dove prima ce n\'era una sola. Solo una porta mi riporta fuori.',
    objective: 'Trova la vera uscita. O non cercarla ancora.',
    clues: [
      {
        id: 'stanza-piena',
        title: 'La cameretta, di nuovo',
        body:
          'Torno nella cameretta un\'ultima volta. Ora è vuota — niente letti, niente poster, solo il pavimento e, al centro, ' +
          'un unico disegno rimasto per terra: i due bambini che si tengono per mano, questa volta intatto. Nessuno dei due è stato ' +
          'cancellato. Mi siedo a guardarlo finché non riesco più a vedere dove finiscono le mie mani e dove inizia la carta.',
      },
      {
        id: 'ultima-nota',
        title: 'Un ultimo foglio, scritto oggi',
        body:
          'Un foglio nuovo, inchiostro fresco, sulla mia stessa scrivania di allora. La mia grafia di adesso, non quella di bambino: ' +
          '"Non sei stato portato via. Sono stata io a chiudere la porta, perché avevo sette anni e avevo paura, e nessuno è mai venuto ' +
          'a dirmi che non era colpa mia. L\'ho deciso io, undici anni fa, di non ricordare. Posso decidere anche il contrario."',
      },
    ],
  },
]

export const ENDING_TEXT: Record<Ending, { title: string; body: string }> = {
  confronto: {
    title: 'Non sei stato portato via',
    body:
      'Resto nella cameretta finché l\'appartamento smette di respirare. Non trovo nessuna uscita, perché smetto di cercarla: ' +
      'quello che dovevo trovare qui non era una porta. Fuori, probabilmente, è passato un pomeriggio o undici anni. Non importa più ' +
      'quale delle due cose sia vera. Per la prima volta da allora, riesco a dire il suo nome senza fingere di aver dimenticato perché.',
  },
  fuga: {
    title: 'La porta giusta',
    body:
      'Scelgo una porta e scappo prima di scoprire se è quella sbagliata. È quella giusta: l\'aria del pianerottolo, reale, fredda, ' +
      'mi colpisce come uno schiaffo. Chiudo a chiave dietro di me e scendo le scale senza voltarmi. L\'agenzia venderà l\'appartamento ' +
      'la settimana prossima. Non ci tornerò. Alcune porte, una volta chiuse, è meglio lasciarle chiuse — anche quando si sa cosa c\'è dietro.',
  },
}

export const INTRO_TEXT =
  "L'ULTIMO PIANO\n\n" +
  'Torni nell\'appartamento dei tuoi genitori per svuotarlo prima della vendita. Non ci mettevi piede da undici anni. ' +
  'Non hai un fratello. Non ne hai mai avuto uno. Ne sei certo.'

export const CONTROLS_TEXT = 'WASD per muoverti · mouse per guardarti intorno · E per esaminare · clic per iniziare'
