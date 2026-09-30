import type { TourStep } from '@/lib/tour'

export const briscolaRules: TourStep[] = [
  { title: 'Il mazzo e la briscola', text: 'Si gioca con 40 carte italiane. All\'inizio ricevi 3 carte; l\'ultima carta del mazzo viene mostrata a tutti e indica il seme di "briscola" per tutta la partita.' },
  { title: 'Come si gioca una carta', text: 'A turno, ogni giocatore gioca una carta dalla propria mano. Puoi giocare qualsiasi carta: in Briscola non sei obbligato a rispondere allo stesso seme.' },
  { title: 'Chi vince la mano', text: 'Vince la mano la carta di briscola più forte; se nessuno gioca briscola, vince la carta più forte del seme giocato per primo. Le carte degli altri semi non contano mai.' },
  { title: 'La forza delle carte', text: 'Dalla più forte alla più debole: Asso, 3, Re, Cavallo, Fante, 7, 6, 5, 4, 2.' },
  { title: 'I punti delle carte', text: 'Asso vale 11 punti, il 3 vale 10, il Re 4, il Cavallo 3, il Fante 2. Le altre carte (7, 6, 5, 4, 2) non valgono punti. In tutto ci sono 120 punti nel mazzo.' },
  { title: 'Pescare', text: 'Chi vince la mano pesca per primo una nuova carta dal mazzo, poi pescano gli altri: così si torna sempre ad avere 3 carte in mano, finché il mazzo non finisce.' },
  { title: 'Come finisce', text: 'Quando le carte finiscono, si gioca l\'ultima mano senza pescare. Vince chi ha totalizzato più punti (in 4 giocatori, si sommano i punti di ogni coppia di compagni seduti uno di fronte all\'altro). A 60 punti pari è parità.' },
]
