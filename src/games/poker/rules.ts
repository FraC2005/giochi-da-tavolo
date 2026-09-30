import type { TourStep } from '@/lib/tour'

export const pokerRules: TourStep[] = [
  { title: 'Due varianti, una scala di mani', text: 'Nel sito trovi il Texas Hold\'em (con carte comuni) e il Poker all\'italiana a 5 carte (senza carte comuni, con un cambio carte). Scegli la variante quando crei la partita: le mani che vincono sono le stesse per entrambe.' },
  { title: 'La scala delle mani (dalla più forte)', text: 'Scala colore, Poker (quattro carte uguali), Full (tris + coppia), Colore (5 carte dello stesso seme), Scala (5 carte in sequenza), Tris, Doppia coppia, Coppia, Carta alta.' },
  { title: 'Texas Hold\'em: come si gioca', text: 'Ricevi 2 carte private. Si punta prima di vedere le carte comuni (con i bui obbligatori), poi altre 3 carte comuni ("flop"), un\'altra puntata, una quarta carta ("turn"), puntata, una quinta ("river") e l\'ultima puntata. Usi le 5 carte migliori tra le tue 2 e le 5 comuni.' },
  { title: 'Poker all\'italiana: come si gioca', text: 'Ricevi 5 carte private (nessuna carta comune). Dopo un primo giro di puntate, puoi scartare da 0 a 5 carte e pescarne altrettante di nuove. Segue un secondo e ultimo giro di puntate, poi si scoprono le carte.' },
  { title: 'Puntare', text: 'A turno puoi passare (fold, esci dalla mano e perdi quanto già puntato), pareggiare la puntata in corso (check se nessuno ha puntato, altrimenti chiama), oppure rilanciare portando la puntata più in alto: chi vuole restare in mano deve pareggiare il nuovo importo.' },
  { title: 'All-in e piatti laterali', text: 'Se punti tutte le tue fiches (all-in) e un avversario ne ha di più, quell\'eccedenza forma un "piatto laterale" a cui tu non partecipi: puoi comunque vincere il piatto principale con la mano migliore.' },
  { title: 'Chi vince', text: 'Se restano più giocatori alla fine, vince chi ha la mano più forte tra quelle rimaste in gioco (chi ha passato non partecipa più). Se tutti tranne uno passano prima della fine, quel giocatore vince subito il piatto, senza bisogno di mostrare le carte.' },
]
