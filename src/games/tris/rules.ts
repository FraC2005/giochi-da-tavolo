import type { TourStep } from '@/lib/tour'

export const trisRules: TourStep[] = [
  { title: 'Obiettivo', text: 'Metti tre tuoi simboli in fila — orizzontale, verticale o diagonale — prima del tuo avversario.' },
  { title: 'Il turno', text: 'Si gioca a turni: il primo giocatore ha la X, il secondo la O. Tocca una casella vuota per piazzare il tuo simbolo lì.' },
  { title: 'Come si vince', text: 'Appena tre tuoi simboli formano una linea retta, la partita finisce subito e vinci tu: la linea vincente si illumina.' },
  { title: 'Il pareggio', text: 'Se le 9 caselle si riempiono senza che nessuno faccia tris, la partita finisce in parità.' },
]
