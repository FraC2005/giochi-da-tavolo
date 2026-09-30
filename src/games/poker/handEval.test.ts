import { describe, expect, it } from 'vitest'
import type { Card } from '../cards/frenchDeck'
import { bestHand, CATEGORY, compareHands, evaluate5 } from './handEval'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('evaluate5: category detection', () => {
  it('recognizes a royal-high straight flush', () => {
    const hand = evaluate5([c('hearts', 14), c('hearts', 13), c('hearts', 12), c('hearts', 11), c('hearts', 10)])
    expect(hand.category).toBe(CATEGORY.STRAIGHT_FLUSH)
    expect(hand.tiebreakers).toEqual([14])
  })

  it('recognizes a wheel straight flush (A-2-3-4-5) with the 5 as the high card', () => {
    const hand = evaluate5([c('spades', 14), c('spades', 2), c('spades', 3), c('spades', 4), c('spades', 5)])
    expect(hand.category).toBe(CATEGORY.STRAIGHT_FLUSH)
    expect(hand.tiebreakers).toEqual([5])
  })

  it('recognizes four of a kind with the correct kicker', () => {
    const hand = evaluate5([c('hearts', 9), c('diamonds', 9), c('clubs', 9), c('spades', 9), c('hearts', 4)])
    expect(hand.category).toBe(CATEGORY.FOUR_OF_A_KIND)
    expect(hand.tiebreakers).toEqual([9, 4])
  })

  it('recognizes a full house, ranking the three-of-a-kind above the pair', () => {
    const hand = evaluate5([c('hearts', 6), c('diamonds', 6), c('clubs', 6), c('spades', 2), c('hearts', 2)])
    expect(hand.category).toBe(CATEGORY.FULL_HOUSE)
    expect(hand.tiebreakers).toEqual([6, 2])
  })

  it('recognizes a flush', () => {
    const hand = evaluate5([c('clubs', 2), c('clubs', 5), c('clubs', 9), c('clubs', 11), c('clubs', 13)])
    expect(hand.category).toBe(CATEGORY.FLUSH)
    expect(hand.tiebreakers).toEqual([13, 11, 9, 5, 2])
  })

  it('recognizes a straight across different suits', () => {
    const hand = evaluate5([c('hearts', 8), c('diamonds', 7), c('clubs', 6), c('spades', 5), c('hearts', 4)])
    expect(hand.category).toBe(CATEGORY.STRAIGHT)
    expect(hand.tiebreakers).toEqual([8])
  })

  it('does not mistake a non-consecutive hand for a straight', () => {
    const hand = evaluate5([c('hearts', 10), c('diamonds', 8), c('clubs', 7), c('spades', 6), c('hearts', 5)])
    expect(hand.category).not.toBe(CATEGORY.STRAIGHT)
  })

  it('recognizes three of a kind with descending kickers', () => {
    const hand = evaluate5([c('hearts', 9), c('diamonds', 9), c('clubs', 9), c('spades', 12), c('hearts', 4)])
    expect(hand.category).toBe(CATEGORY.THREE_OF_A_KIND)
    expect(hand.tiebreakers).toEqual([9, 12, 4])
  })

  it('recognizes two pair, ranking the higher pair first', () => {
    const hand = evaluate5([c('hearts', 4), c('diamonds', 4), c('clubs', 9), c('spades', 9), c('hearts', 2)])
    expect(hand.category).toBe(CATEGORY.TWO_PAIR)
    expect(hand.tiebreakers).toEqual([9, 4, 2])
  })

  it('recognizes one pair with descending kickers', () => {
    const hand = evaluate5([c('hearts', 3), c('diamonds', 3), c('clubs', 12), c('spades', 9), c('hearts', 2)])
    expect(hand.category).toBe(CATEGORY.PAIR)
    expect(hand.tiebreakers).toEqual([3, 12, 9, 2])
  })

  it('falls back to high card', () => {
    const hand = evaluate5([c('hearts', 2), c('diamonds', 13), c('clubs', 9), c('spades', 5), c('hearts', 11)])
    expect(hand.category).toBe(CATEGORY.HIGH_CARD)
    expect(hand.tiebreakers).toEqual([13, 11, 9, 5, 2])
  })
})

describe('compareHands', () => {
  it('ranks a higher category above a lower one regardless of tiebreakers', () => {
    const pair = evaluate5([c('hearts', 14), c('diamonds', 14), c('clubs', 2), c('spades', 3), c('hearts', 4)])
    const straight = evaluate5([c('hearts', 6), c('diamonds', 5), c('clubs', 4), c('spades', 3), c('hearts', 2)])
    expect(compareHands(straight, pair)).toBeGreaterThan(0)
  })

  it('breaks a tie within the same category using tiebreakers in order', () => {
    const highPair = evaluate5([c('hearts', 9), c('diamonds', 9), c('clubs', 2), c('spades', 3), c('hearts', 4)])
    const lowPair = evaluate5([c('hearts', 8), c('diamonds', 8), c('clubs', 13), c('spades', 12), c('hearts', 11)])
    expect(compareHands(highPair, lowPair)).toBeGreaterThan(0)
  })

  it('declares an exact tie equal', () => {
    const a = evaluate5([c('hearts', 9), c('diamonds', 4), c('clubs', 2), c('spades', 3), c('hearts', 6)])
    const b = evaluate5([c('clubs', 9), c('spades', 4), c('hearts', 2), c('diamonds', 3), c('clubs', 6)])
    expect(compareHands(a, b)).toBe(0)
  })
})

describe('bestHand', () => {
  it('picks the best 5-card combination out of 7 (Texas Hold\'em style)', () => {
    const sevenCards = [
      c('hearts', 14), c('hearts', 13), // carte in mano: A-K di cuori
      c('hearts', 12), c('hearts', 11), c('hearts', 10), // il tavolo completa la scala reale
      c('clubs', 2), c('spades', 5),
    ]
    const hand = bestHand(sevenCards)
    expect(hand.category).toBe(CATEGORY.STRAIGHT_FLUSH)
    expect(hand.tiebreakers).toEqual([14])
  })

  it('ignores cards that would break a made hand when a better 5-card subset exists', () => {
    const sevenCards = [
      c('hearts', 9), c('diamonds', 9), // coppia in mano
      c('clubs', 9), c('spades', 9), // il tavolo regala il tris... anzi il poker
      c('hearts', 2), c('diamonds', 3), c('clubs', 4),
    ]
    const hand = bestHand(sevenCards)
    expect(hand.category).toBe(CATEGORY.FOUR_OF_A_KIND)
    expect(hand.tiebreakers[0]).toBe(9)
  })
})
