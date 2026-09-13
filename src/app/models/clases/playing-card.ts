import { CardName, CardOrder, CardSuit, CardColor } from "@models/types/card.type";
import { NameOrderCards, SuitColorCards } from "@shared/constants/card";

export class PlayingCard {
    private _name: CardName;
    private _order: CardOrder;
    private _suit: CardSuit;
    private _color: CardColor;
    private _view: boolean;

    constructor(name: CardName, suit: CardSuit) {
        this._name = name;
        this._order = NameOrderCards.get(name) || 0;
        this._suit = suit;
        this._color = SuitColorCards.get(suit) || 'none';
        this._view = false;
    }

    public get name(): CardName {
        return this._name;
    }

    public get order(): CardOrder {
        return this._order;
    }

    public get suit(): CardSuit {
        return this._suit;
    }

    public get color(): CardColor {
        return this._color;
    }

    public get view(): boolean {
        return this._view;
    }

    public flip(): void {
        this._view = !this._view;
    }
}