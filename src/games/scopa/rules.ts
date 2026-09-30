import type { TourStep } from '@/lib/tour'

export const scopaRules: TourStep[] = [
  { title: 'Come si parte', text: 'Si gioca con 40 carte italiane. Ricevi 3 carte in mano e 4 carte vengono scoperte al centro del tavolo.' },
  { title: 'Come si gioca una carta', text: 'A turno, giochi una carta dalla mano. Se sul tavolo c\'è una carta dello stesso valore, la devi prendere (con la carta giocata). Se non c\'è una carta uguale ma una o più combinazioni di carte sul tavolo hanno somma pari al valore giocato, devi prendere una di quelle combinazioni.' },
  { title: 'Quando non prendi', text: 'Se nessuna presa è possibile, la carta giocata resta scoperta sul tavolo: potrai (o potrà un avversario) provare a prenderla più avanti.' },
  { title: 'La scopa', text: 'Se una presa lascia il tavolo completamente vuoto, fai "scopa": vale un punto bonus subito. Non conta come scopa solo se è l\'ultimissima carta giocata di tutta la partita.' },
  { title: 'Quando finiscono le carte', text: 'Quando tutti i giocatori hanno esaurito le carte in mano, se il mazzo non è ancora finito si ridistribuiscono altre 3 carte a testa. Le ultime carte rimaste sul tavolo a mazzo esaurito vanno a chi ha fatto l\'ultima presa della partita.' },
  { title: 'I punti a fine partita', text: 'Si contano: 1 punto per ogni scopa fatta; 1 punto a chi ha preso più carte in totale; 1 punto a chi ha preso più carte di denari; 1 punto a chi ha preso il 7 di denari ("settebello"); 1 punto a chi ha la "primiera" migliore. Vince chi totalizza più punti.' },
  { title: 'La primiera', text: 'Per ogni seme conta solo la tua carta più alta secondo questa scala (diversa dal valore normale): 7 vale 21, 6 vale 18, Asso vale 16, 5 vale 15, 4 vale 14, 3 vale 13, 2 vale 12, le figure (Fante, Cavallo, Re) valgono 10. Chi somma di più tra i 4 semi vince il punto primiera.' },
]
