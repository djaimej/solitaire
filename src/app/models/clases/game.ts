import { IMovement } from "@models/interfaces/game.interface";
import { CardSet } from "@models/types/card.type";

export default class Game implements IMovement {
    private static _game: Game;
    private static _cardIndexFrom: number;
    private static _cardIndexTo: number;
    private static _indexFrom: number;
    private static _indexTo: number;
    private static _from: CardSet;
    private static _to: CardSet;
    
    private static initialize(): void {
        this._cardIndexFrom = -1;
        this._cardIndexTo = -1;
        this._indexFrom = -1;
        this._indexTo = -1;
        this._from = 'tableau';
        this._to = 'tableau';
    }

    public static getGame(): Game {
        if (!this._game) {
            this._game = new Game();
            this.initialize();
        }
        return this._game;
    }

    public get cardIndexFrom(): number {
        return Game._cardIndexFrom;
    }

    public get cardIndexTo(): number {
        return Game._cardIndexTo;
    }

    public get indexFrom(): number {
        return Game._indexFrom;
    }

    public get indexTo(): number {
        return Game._indexTo;
    }

    public get from(): CardSet {
        return Game._from;
    }
    
    public get to(): CardSet {
        return Game._to;
    }
    
	public set cardIndexFrom(value: number) {
		Game._cardIndexFrom = value;
	}
    
	public set cardIndexTo(value: number) {
		Game._cardIndexTo = value;
	}
    
	public set indexFrom(value: number) {
		Game._indexFrom = value;
	}
    
	public set indexTo(value: number) {
		Game._indexTo = value;
	}
    
	public set from(value: CardSet) {
		Game._from = value;
	}
    
	public set to(value: CardSet) {
		Game._to = value;
	}
}