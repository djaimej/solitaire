import { signal } from '@angular/core';
import { CardName, CardOrder, CardSuit, CardColor } from '@models/types/card.type';
import { NameOrderCards, SuitColorCards } from '@shared/constants/card';

export class PlayingCard {
  private readonly _name: CardName;
  private readonly _order: CardOrder;
  private readonly _suit: CardSuit;
  private readonly _color: CardColor;
  private readonly _view = signal(false);

  constructor(name: CardName, suit: CardSuit) {
    this._name = name;
    this._order = NameOrderCards.get(name) || 0;
    this._suit = suit;
    this._color = SuitColorCards.get(suit) || 'none';
  }

  public get name(): CardName { return this._name; }
  public get order(): CardOrder { return this._order; }
  public get suit(): CardSuit { return this._suit; }
  public get color(): CardColor { return this._color; }

  /** Getter reactivo: leído en una plantilla, registra la dependencia del signal. */
  public get view(): boolean { return this._view(); }

  public flip(): void { this._view.update(v => !v); }
}
