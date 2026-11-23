import { SolitaireSuits, SolitaireNames } from "@shared/constants/card";
import { PlayingCard } from "./playing-card";

export class Deck {
  private _cards: PlayingCard[];

  constructor() {
    this._cards = [];
  }

  public initCards(): Promise<void> {
    this._cards = [];
    SolitaireSuits.forEach((suit) => {
      SolitaireNames.forEach((name) => {
        const card = new PlayingCard(name, suit);
        this._cards.push(card);
      });
    });
    return Promise.resolve();
  }

  public shuffle(): Promise<void> {
    for (let i = this._cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
    }
    // Reducir la probabilidad de que el juego quede sin solución.
    [[50, 49], [48, 46], [45, 42], [41, 37], [36, 31], [30, 24], [29, 25]].forEach(([i, j]) => {
      if (this._cards[i].order < this._cards[j].order) {
        [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
      }
    });
    return Promise.resolve();
  }

  public get cards(): PlayingCard[] {
    return this._cards;
  }
}
