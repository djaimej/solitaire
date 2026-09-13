import { CardSuit, CardColor, CardName, CardOrder } from "@models/types/card.type";

export const SolitaireSuits: CardSuit[] = ['Spade', 'Heart', 'Club', 'Diamond'];
export const SolitaireNames: CardName[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SuitColorCards: Map<CardSuit, CardColor> = new Map([
    ['Spade', 'black'],
    ['Heart', 'red'],
    ['Club', 'black'],
    ['Diamond', 'red'],
    ['Joker', 'none']
]);
export const NameOrderCards: Map<CardName, CardOrder> = new Map([
    ['X', 0], ['A', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6],
    ['7', 7], ['8', 8], ['9', 9], ['10', 10], ['J', 11], ['Q', 12], ['K', 13]
]);
