import { Component, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { Deck } from '@models/clases/deck';
import { PlayingCard } from '@models/clases/playing-card';
import { Card } from './shared/components/card/card';
import { GameService } from '@services/game-service';
import { IFlip, IMovement } from './models/interfaces/game.interface';
import { CommonModule } from '@angular/common';
import { CardSet } from '@models/types/card.type';
import { Button } from './shared/components/button/button';
import { map, Subscription, timer } from 'rxjs';
import { MAX_TIME, TIME_FORMAT } from '@shared/constants/game';
import { movementHandlers } from '@models/types/movement.type';
import Game from '@models/clases/game';

@Component({
  selector: 'app-root',
  imports: [CommonModule, Card, Button],
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private _deck: Deck;
  private _game: Game;
  private _moves: IMovement[];
  private _flips: IFlip[];
  private _timeSeconds: number; // secs
  private _onExecutionTime;
  private _timeSubscription: Subscription | null;
  private gameService: GameService;
  public stock: PlayingCard[];
  public waste: PlayingCard[];
  public foundations: PlayingCard[][];
  public tableau: PlayingCard[][];
  public gameOver: boolean;
  public firstMove: boolean;
  public time: string;
  public bestTime: string;
  public loading: WritableSignal<boolean>;

  constructor() {
    this.gameService = new GameService();
    this._deck = new Deck();
    this._game = Game.getGame();
    this._moves = [];
    this._flips = [];
    this._timeSeconds = 0;
    this._onExecutionTime = false;
    this._timeSubscription = null;
    this.stock = [];
    this.waste = [];
    this.foundations = [];
    this.tableau = [];
    this.gameOver = false;
    this.firstMove = true;
    this.time = TIME_FORMAT;
    this.bestTime = this.gameService.getBestTime();
    this.loading = signal(true);
  }

  public ngOnInit(): void {
    this.newGame();
  }

  public ngOnDestroy(): void {
    this.stopTime();
  }

  private async initTableau(): Promise<void> {
    this.stock = [...this._deck.cards];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [];
    for (let i = 1; i <= 7; i++) {
      this.tableau.push([]);
      for (let j = 0; j < i; j++) {
        const card = this.stock.pop();
        if (card) {
          if (j === i - 1) { card.flip(); }
          this.tableau[i - 1].push(card);
        }
      }
    }
  }

  /* TIME */

  private initTime(): void {
    if (this._onExecutionTime) { return; }
    this._onExecutionTime = true;
    this._timeSubscription = timer(0, 1000).pipe(
      map(() => {
        this._timeSeconds++;
        this.updateFormattedTime();
      })
    ).subscribe();
  }

  private stopTime(): void {
    if (this._timeSubscription) {
      this._timeSubscription.unsubscribe();
      this._timeSubscription = null;
      this._onExecutionTime = false;
    }
  }

  private resetTime(): void {
    this.stopTime();
    this._timeSeconds = 0;
    this.time = '00:00';
  }

  private updateFormattedTime(): void {
    const min: number = Math.floor(this._timeSeconds / 60);
    const sec: number = this._timeSeconds % 60;
    this.time = `${this.formatDigits(min)}:${this.formatDigits(sec)}`;
    if (this._timeSeconds >= MAX_TIME) { this.newGame(); }
  }

  private formatDigits(valor: number): string {
    return valor < 10 ? `0${valor}` : `${valor}`;
  }

  /* USER INTERACTION */

  public async newGame(): Promise<void> {
    this.loading.set(true);
    this.resetTime();
    this.stock = []; this.waste = []; this.foundations = []; this.tableau = [];
    this.gameOver = false; this.firstMove = true;
    this._flips = []; this._moves = [];
    setTimeout(async () => {
      await this._deck.initCards();
      await this._deck.shuffle();
      await this.initTableau();
      this.loading.set(false);
    }, 1000);
  }

  public verifyAvailability(card: PlayingCard, from: CardSet, cardIndexFrom: number, indexFrom?: number): void {
    this._game.from = from;
    this._game.indexFrom = indexFrom !== undefined ? indexFrom : this._game.indexFrom;
    this._game.cardIndexFrom = cardIndexFrom;
    this._game.to = 'foundation';
    let move: boolean = false;
    let searching: boolean = true;
    let foundationIndex: number = 0;
    while (searching) {
      const foundation: PlayingCard[] = this.foundations[foundationIndex];
      const foundationCard: PlayingCard = foundation[foundation.length - 1];
      if ((card.order === 1 && foundation.length === 0) ||
        (foundation.length && foundationCard.suit === card.suit && (foundationCard.order + 1) === card.order)) {
        this._game.indexTo = foundationIndex;
        searching = false;
        move = true;
      }
      foundationIndex++;
      searching = searching && foundationIndex < 4;
    }
    if (move) { this.tryMovement(); }
  }

  public undo(): void {
    if (this._moves.length) {
      const movement: IMovement = this._moves[this._moves.length - 1];
      const { cardIndexFrom, cardIndexTo, from, indexFrom, indexTo, to } = movement;
      this._game.cardIndexFrom = cardIndexTo;
      this._game.cardIndexTo = cardIndexFrom;
      this._game.from = to;
      this._game.indexFrom = indexTo;
      this._game.to = from;
      this._game.indexTo = indexFrom;
      this.tryUndoMovement();
    }
  }

  private tryMovement(): void {
    const { from, to } = this._game;
    const movementHandlers: movementHandlers = {
      stock: {
        stock: () => { return false },
        waste: this.stockToWaste.bind(this),
        tableau: () => { return false },
        foundation: () => { return false },
      },
      waste: {
        stock: this.wasteToStock.bind(this),
        waste: () => { return false },
        tableau: this.wasteToTableau.bind(this),
        foundation: this.wasteToFoundation.bind(this),
      },
      tableau: {
        stock: () => { return false },
        waste: () => { return false },
        tableau: this.tableauToTableau.bind(this),
        foundation: this.tableauToFoundation.bind(this),
      },
      foundation: {
        stock: () => { return false },
        waste: () => { return false },
        tableau: this.foundationToTableau.bind(this),
        foundation: this.foundationToFoundation.bind(this),
      }
    };

    // Verificar si el movimiento es válido
    if (!this.isValidSource()) {
      return;
    }

    // Ejecutar el handler correspondiente
    const handler: () => boolean = movementHandlers[from][to];
    const result: boolean = handler ? handler() : false;
    // Verificar fin del juego y primera jugada
    if (result) {
      this._moves.push({
        cardIndexFrom: this._game.cardIndexFrom,
        cardIndexTo: this._game.cardIndexTo,
        from: this._game.from,
        indexFrom: this._game.indexFrom,
        indexTo: this._game.indexTo,
        to: this._game.to,
      });
      this.checkGameStatus();
    }

  }

  private tryUndoMovement(): void {
    const { from, to } = this._game;
    const undoMovementHandlers: movementHandlers = {
      stock: {
        stock: () => { return false },
        waste: this.stockToWasteUndo.bind(this),
        tableau: () => { return false },
        foundation: () => { return false }
      },
      waste: {
        stock: this.wasteToStockUndo.bind(this),
        waste: () => { return false },
        tableau: () => { return false },
        foundation: () => { return false },
      },
      tableau: {
        stock: () => { return false },
        waste: this.tableauToWasteUndo.bind(this),
        tableau: this.tableauToTableauUndo.bind(this),
        foundation: this.tableauToFoundationUndo.bind(this),
      },
      foundation: {
        stock: () => { return false },
        waste: this.foundationToWasteUndo.bind(this),
        tableau: this.foundationToTableauUndo.bind(this),
        foundation: this.foundationToFoundationUndo.bind(this),
      }
    };

    // Verificar si el movimiento es válido
    if (!this.isValidSource()) {
      return;
    }

    // Ejecutar el handler correspondiente
    const handler: () => boolean = undoMovementHandlers[from][to];
    const result: boolean = handler ? handler() : false;
    // Verificar fin del juego y primera jugada
    if (result) {
      this._moves.pop();
      this.checkGameStatus();
    }
  }

  private isValidSource(): boolean {
    const { from, cardIndexFrom, indexFrom } = this._game;
    switch (from) {
      case 'stock':
        return this.stock.length > 0;
      case 'waste':
        return this.waste.length > 0;
      case 'tableau':
        return this.tableau[indexFrom]?.length > cardIndexFrom;
      case 'foundation':
        return this.foundations[indexFrom]?.length > cardIndexFrom;
      default:
        return false;
    }
  }

  /* MOVES */

  private stockToWaste(): boolean {
    this._game.cardIndexTo = this.waste.length; // el indice es el tamaño del arreglo
    const { cardIndexFrom } = this._game;
    const stockCard: PlayingCard = this.stock[cardIndexFrom];
    stockCard.flip();
    this.waste.push(stockCard);
    this.stock.pop();
    return true;
  }

  private wasteToStock(): boolean {
    this._game.cardIndexTo = this.stock.length; // stock estará vacío, entonces el indice es 0
    this.waste.map(card => card.flip());
    this.stock = [...this.waste];
    this.stock.reverse();
    this.waste = [];
    return true;
  }

  private wasteToFoundation(): boolean {
    const { cardIndexFrom, indexTo } = this._game;
    this._game.cardIndexTo = this.foundations[indexTo].length;
    const wasteCard: PlayingCard = this.waste[cardIndexFrom];
    const foundation: PlayingCard[] = this.foundations[indexTo];
    const lastFoundationCard: PlayingCard = foundation[foundation.length - 1];

    const isValidMove: boolean = (foundation.length === 0 && wasteCard.order === 1) ||
      (lastFoundationCard && lastFoundationCard.suit === wasteCard.suit && lastFoundationCard.order + 1 === wasteCard.order);

    if (isValidMove) {
      foundation.push(wasteCard);
      this.waste.pop();
      return true;
    }
    return false;
  }

  private wasteToTableau(): boolean {
    const { cardIndexFrom, indexTo } = this._game;
    this._game.cardIndexTo = this.tableau[indexTo].length;
    const wasteCard: PlayingCard = this.waste[cardIndexFrom];
    const tableauSlot: PlayingCard[] = this.tableau[indexTo];
    const lastTableauCard: PlayingCard = tableauSlot[tableauSlot.length - 1];

    const isValidMove: boolean = (tableauSlot.length === 0 && wasteCard.order === 13) ||
      (lastTableauCard && wasteCard.order === lastTableauCard.order - 1 && wasteCard.color !== lastTableauCard.color);

    if (isValidMove) {
      this.tableau[indexTo].push(wasteCard);
      this.waste.pop();
      return true;
    }
    return false;
  }

  private tableauToFoundation(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this.foundations[indexTo].length;
    if (this.tableau[indexFrom].length - 1 !== cardIndexFrom) {
      return false;
    }

    const tableauCard: PlayingCard = this.tableau[indexFrom][cardIndexFrom];
    const foundation: PlayingCard[] = this.foundations[indexTo];
    const lastFoundationCard: PlayingCard = foundation[foundation.length - 1];

    const isValidMove: boolean =
      (foundation.length === 0 && tableauCard.order === 1) ||
      (lastFoundationCard?.suit === tableauCard.suit &&
        lastFoundationCard?.order + 1 === tableauCard.order);

    if (isValidMove) {
      this.foundations[indexTo].push(tableauCard);
      this.tableau[indexFrom].pop();
      const lastTableauCardIdx = this.tableau[indexFrom].length - 1;
      if (lastTableauCardIdx >= 0) {
        const lastTableauCard: PlayingCard = this.tableau[indexFrom][lastTableauCardIdx];
        if (!lastTableauCard.view) {
          const cardToFlipIndex = this.tableau[indexFrom].length - 1;
          this.tableau[indexFrom][cardToFlipIndex].flip();
          this._flips.push({
            cardIndex: cardToFlipIndex,
            movementIndex: this._moves.length,
            slotIndex: indexFrom,
          });
        }
      }
      return true;
    }
    return false;
  }

  private tableauToTableau(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this.tableau[indexTo].length;
    const tableauFrom: PlayingCard[] = this.tableau[indexFrom];
    const tableauTo: PlayingCard[] = this.tableau[indexTo];
    const tableauCard: PlayingCard = tableauFrom[cardIndexFrom];
    const lastTableauCard: PlayingCard = tableauTo[tableauTo.length - 1];

    const isValidMove: boolean =
      (tableauTo.length === 0 && tableauCard.order === 13) ||
      (lastTableauCard &&
        tableauCard.order === lastTableauCard.order - 1 &&
        tableauCard.color !== lastTableauCard.color);

    if (isValidMove) {
      const cardsToMove: PlayingCard[] = tableauFrom.splice(cardIndexFrom);
      const newLastCardIndex: number = tableauFrom.length - 1;

      if (newLastCardIndex >= 0 && !tableauFrom[newLastCardIndex].view) {
        tableauFrom[newLastCardIndex].flip();
        this._flips.push({
          cardIndex: newLastCardIndex,
          movementIndex: this._moves.length,
          slotIndex: indexFrom,
        });
      }
      tableauTo.push(...cardsToMove);
      return true;
    }
    return false;
  }

  private foundationToTableau(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this.tableau[indexTo].length;
    const foundationCard: PlayingCard = this.foundations[indexFrom][cardIndexFrom];
    const tableauSlot: PlayingCard[] = this.tableau[indexTo];
    const lastTableauCard: PlayingCard = tableauSlot[tableauSlot.length - 1];

    const isValidMove: boolean =
      (tableauSlot.length === 0 && foundationCard.order === 13) ||
      (lastTableauCard &&
        foundationCard.order === lastTableauCard.order - 1 &&
        foundationCard.color !== lastTableauCard.color);

    if (isValidMove) {
      tableauSlot.push(foundationCard);
      this.foundations[indexFrom].pop();
      return true;
    }
    return false;
  }

  private foundationToFoundation(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this.foundations[indexTo].length;
    const foundationCard: PlayingCard = this.foundations[indexFrom][cardIndexFrom];
    const targetFoundation: PlayingCard[] = this.foundations[indexTo];

    if (foundationCard.order === 1 && targetFoundation.length === 0) {
      targetFoundation.push(foundationCard);
      this.foundations[indexFrom].pop();
      return true;
    }
    return false;
  }

  /* UNDO MOVES */

  private stockToWasteUndo(): boolean {
    this.stock.reverse();
    this.waste = [...this.stock];
    this.waste.map(card => card.flip());
    this.stock = [];
    return true;
  }

  private wasteToStockUndo(): boolean {
    const { cardIndexFrom } = this._game;
    const wasteCard: PlayingCard = this.waste[cardIndexFrom];
    wasteCard.flip();
    this.stock.push(wasteCard);
    this.waste.pop();
    return true;
  }

  private tableauToWasteUndo(): boolean {
    const { cardIndexFrom, indexFrom } = this._game;
    const tableauCard: PlayingCard = this.tableau[indexFrom][cardIndexFrom];
    if (tableauCard) {
      this.waste.push(tableauCard);
      this.tableau[indexFrom].pop();
      return true;
    }
    return false;
  }

  private tableauToTableauUndo(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    const tableauFrom: PlayingCard[] = this.tableau[indexFrom];
    const tableauTo: PlayingCard[] = this.tableau[indexTo];
    const cardsToMove: PlayingCard[] = tableauFrom.splice(cardIndexFrom);
    tableauTo.push(...cardsToMove);

    const lastMovementIndex: number = this._moves.length - 1;
    const lastFlipIndex: number = this._flips.length - 1;
    if (this._flips.length && this._flips[lastFlipIndex].movementIndex === lastMovementIndex) {
      const flip: IFlip = this._flips[lastFlipIndex];
      this.tableau[flip.slotIndex][flip.cardIndex].flip();
      this._flips.pop();
    }
    return true;
  }

  private tableauToFoundationUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom, indexTo } = this._game;
    const tableauSlot: PlayingCard[] = this.tableau[indexFrom];
    const foundationSlot: PlayingCard[] = this.foundations[indexTo];

    if (tableauSlot.length === cardIndexFrom + 1 && foundationSlot.length === cardIndexTo) {
      const tableauCard: PlayingCard = tableauSlot[cardIndexFrom];
      foundationSlot.push(tableauCard);
      tableauSlot.pop();
    } else { /* Error de lógica en la implementación */ return false; }
    return true;
  }

  private foundationToWasteUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom } = this._game;
    const foundationSlot: PlayingCard[] = this.foundations[indexFrom];
    if (foundationSlot.length === cardIndexFrom + 1 && this.waste.length === cardIndexTo) {
      const foundationCard: PlayingCard = foundationSlot[cardIndexFrom];
      this.waste.push(foundationCard);
      foundationSlot.pop();
    } else { /* Error de lógica en la implementación */ return false; }
    return true;
  }

  private foundationToTableauUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom, indexTo } = this._game;
    const foundationSlot: PlayingCard[] = this.foundations[indexFrom];
    const tableauSlot: PlayingCard[] = this.tableau[indexTo];

    if (foundationSlot.length === cardIndexFrom + 1 && tableauSlot.length === cardIndexTo) {
      const foundationCard: PlayingCard = foundationSlot[cardIndexFrom];
      tableauSlot.push(foundationCard);
      foundationSlot.pop();
    } else { /* Error de lógica en la implementación */ return false; }

    const lastMovementIndex: number = this._moves.length - 1;
    const lastFlipIndex: number = this._flips.length - 1;
    if (this._flips.length && this._flips[lastFlipIndex].movementIndex === lastMovementIndex) {
      const flip: IFlip = this._flips[lastFlipIndex];
      this.tableau[flip.slotIndex][flip.cardIndex].flip();
      this._flips.pop();
    }
    return true;
  }

  private foundationToFoundationUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom, indexTo } = this._game;
    const foundationSlotFrom: PlayingCard[] = this.foundations[indexFrom];
    const foundationSlotTo: PlayingCard[] = this.foundations[indexTo];
    if (foundationSlotFrom.length === cardIndexFrom + 1 && foundationSlotTo.length === cardIndexTo) {
      const foundationCard: PlayingCard = foundationSlotFrom[cardIndexFrom];
      foundationSlotTo.push(foundationCard);
      foundationSlotFrom.pop();
    } else { /* Error de lógica en la implementación */ return false;
    }
    return true;
  }

  /* GAME STATUS */

  private checkGameStatus(): void {
    const { to, indexTo } = this._game;
    // Verificar si es primera jugada
    if (this.firstMove) {
      this.firstMove = false;
      this.initTime();
    }

    // Verificar fin del juego (última carta es K en foundation)
    if (to === 'foundation') {
      const movedCard: PlayingCard = this.foundations[indexTo][this.foundations[indexTo].length - 1];
      if (movedCard && movedCard.name === 'K') {
        const isGameComplete = this.foundations.every(f => f.length === 13);
        if (isGameComplete) {
          this.endGame();
        }
      }
    }
  }

  private endGame(): void {
    this.stopTime();
    this.gameService.setBestTime(this.time);
    this.bestTime = this.gameService.getBestTime() || this.time;
    this.gameOver = true;
  }

  public move(from: CardSet, to: CardSet, cardIndexFrom?: number): void {
    this._game.from = from;
    this._game.to = to;
    this._game.cardIndexFrom = cardIndexFrom !== undefined ? cardIndexFrom : this._game.cardIndexFrom;
    this.tryMovement();
  }

  /* DRAG AND DROP */

  public dragstart(from: Exclude<CardSet, 'stock'>, indexFrom: number, cardIndexFrom: number): void {
    this._game.from = from;
    this._game.indexFrom = indexFrom;
    this._game.cardIndexFrom = cardIndexFrom;
  }

  public dragover(event: Event): void {
    event.preventDefault();
  }

  public drop(event: Event, to: Exclude<CardSet, 'stock' | 'waste'>, indexTo: number): void {
    event.preventDefault();
    this._game.to = to; // hacia donde se intenta mover
    this._game.indexTo = indexTo; // index del slot hacia donde se intenta mover
    this.tryMovement();
  }
}
