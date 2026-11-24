import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';

import { Deck } from '@models/clases/deck';
import { PlayingCard } from '@models/clases/playing-card';
import Game from '@models/clases/game';
import { GameService } from '@services/game-service';
import { Card } from './shared/components/card/card';
import { Button } from './shared/components/button/button';
import { CardSet } from '@models/types/card.type';
import { IFlip, IMovement } from './models/interfaces/game.interface';
import { movementHandlers } from '@models/types/movement.type';
import { MAX_TIME } from '@shared/constants/game';

@Component({
  selector: 'app-root',
  imports: [CommonModule, Card, Button],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly gameService = inject(GameService);
  private readonly destroyRef = inject(DestroyRef);

  // Modelo mutable interno: la lógica de movimientos opera SOBRE ESTOS.
  private _deck = new Deck();
  private _game: Game = Game.getGame();
  private _moves: IMovement[] = [];
  private _flips: IFlip[] = [];
  private _firstMove = true;
  private _stock: PlayingCard[] = [];
  private _waste: PlayingCard[] = [];
  private _foundations: PlayingCard[][] = [];
  private _tableau: PlayingCard[][] = [];

  // Estado reactivo que consume la plantilla.
  readonly stock = signal<PlayingCard[]>([]);
  readonly waste = signal<PlayingCard[]>([]);
  readonly foundations = signal<PlayingCard[][]>([]);
  readonly tableau = signal<PlayingCard[][]>([]);
  readonly gameOver = signal(false);
  readonly loading = signal(true);
  readonly bestTime = signal(this.gameService.getBestTime());

  // Tiempo: segundos en signal, formato derivado con computed.
  private readonly _timeSeconds = signal(0);
  readonly time = computed(() => {
    const t = this._timeSeconds();
    return `${this.pad(Math.floor(t / 60))}:${this.pad(t % 60)}`;
  });
  private _timerSub: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTime());
    this.newGame();
  }

  /** Publica el modelo mutable en los signals (dispara render en OnPush). */
  private sync(): void {
    this.stock.set([...this._stock]);
    this.waste.set([...this._waste]);
    this.foundations.set(this._foundations.map(f => [...f]));
    this.tableau.set(this._tableau.map(t => [...t]));
  }

  private startTime(): void {
    if (this._timerSub) { return; }
    this._timerSub = timer(1000, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this._timeSeconds.update(s => s + 1);
        if (this._timeSeconds() >= MAX_TIME) { this.newGame(); }
      });
  }

  private stopTime(): void { this._timerSub?.unsubscribe(); this._timerSub = null; }

  private resetTime(): void { this.stopTime(); this._timeSeconds.set(0); }

  private pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

  private dealTableau(): void {
    this._stock = [...this._deck.cards];
    this._waste = [];
    this._foundations = [[], [], [], []];
    this._tableau = [];
    for (let i = 1; i <= 7; i++) {
      this._tableau.push([]);
      for (let j = 0; j < i; j++) {
        const card = this._stock.pop();
        if (card) {
          if (j === i - 1) { card.flip(); }
          this._tableau[i - 1].push(card);
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* Ciclo de juego */

  public async newGame(): Promise<void> {
    this.loading.set(true);
    this.resetTime();
    this._stock = []; this._waste = []; this._foundations = []; this._tableau = [];
    this.gameOver.set(false);
    this._firstMove = true;
    this._flips = []; this._moves = [];
    this.sync();

    await this._deck.initCards();
    await this._deck.shuffle();
    await this.delay(1000);
    this.dealTableau();
    this.sync();
    this.loading.set(false);
  }

  /* Interacción */

  public verifyAvailability(card: PlayingCard, from: CardSet, cardIndexFrom: number, indexFrom?: number): void {
    this._game.from = from;
    this._game.indexFrom = indexFrom !== undefined ? indexFrom : this._game.indexFrom;
    this._game.cardIndexFrom = cardIndexFrom;
    this._game.to = 'foundation';
    let move = false, searching = true, foundationIndex = 0;
    while (searching) {
      const foundation = this._foundations[foundationIndex];
      const foundationCard = foundation[foundation.length - 1];
      if ((card.order === 1 && foundation.length === 0) ||
        (foundation.length && foundationCard.suit === card.suit && (foundationCard.order + 1) === card.order)) {
        this._game.indexTo = foundationIndex;
        searching = false; move = true;
      }
      foundationIndex++;
      searching = searching && foundationIndex < 4;
    }
    if (move) { this.tryMovement(); }
  }

  public undo(): void {
    if (!this._moves.length) { return; }
    const m = this._moves[this._moves.length - 1];
    this._game.cardIndexFrom = m.cardIndexTo;
    this._game.cardIndexTo = m.cardIndexFrom;
    this._game.from = m.to;
    this._game.indexFrom = m.indexTo;
    this._game.to = m.from;
    this._game.indexTo = m.indexFrom;
    this.tryUndoMovement();
  }

  private tryMovement(): void {
    const { from, to } = this._game;
    const handlers: movementHandlers = {
      stock: { stock: () => false, waste: this.stockToWaste.bind(this), tableau: () => false, foundation: () => false },
      waste: { stock: this.wasteToStock.bind(this), waste: () => false, tableau: this.wasteToTableau.bind(this), foundation: this.wasteToFoundation.bind(this) },
      tableau: { stock: () => false, waste: () => false, tableau: this.tableauToTableau.bind(this), foundation: this.tableauToFoundation.bind(this) },
      foundation: { stock: () => false, waste: () => false, tableau: this.foundationToTableau.bind(this), foundation: this.foundationToFoundation.bind(this) },
    };
    if (!this.isValidSource()) { return; }
    const handler = handlers[from][to];
    if (handler && handler()) {
      this._moves.push({
        cardIndexFrom: this._game.cardIndexFrom, cardIndexTo: this._game.cardIndexTo,
        from: this._game.from, indexFrom: this._game.indexFrom,
        indexTo: this._game.indexTo, to: this._game.to,
      });
      this.checkGameStatus();
    }
    this.sync();
  }

  private tryUndoMovement(): void {
    const { from, to } = this._game;
    const handlers: movementHandlers = {
      stock: { stock: () => false, waste: this.stockToWasteUndo.bind(this), tableau: () => false, foundation: () => false },
      waste: { stock: this.wasteToStockUndo.bind(this), waste: () => false, tableau: () => false, foundation: () => false },
      tableau: { stock: () => false, waste: this.tableauToWasteUndo.bind(this), tableau: this.tableauToTableauUndo.bind(this), foundation: this.tableauToFoundationUndo.bind(this) },
      foundation: { stock: () => false, waste: this.foundationToWasteUndo.bind(this), tableau: this.foundationToTableauUndo.bind(this), foundation: this.foundationToFoundationUndo.bind(this) },
    };
    if (!this.isValidSource()) { return; }
    const handler = handlers[from][to];
    if (handler && handler()) {
      this._moves.pop();
      this.checkGameStatus();
    }
    this.sync();
  }

  private isValidSource(): boolean {
    const { from, cardIndexFrom, indexFrom } = this._game;
    switch (from) {
      case 'stock': return this._stock.length > 0;
      case 'waste': return this._waste.length > 0;
      case 'tableau': return this._tableau[indexFrom]?.length > cardIndexFrom;
      case 'foundation': return this._foundations[indexFrom]?.length > cardIndexFrom;
      default: return false;
    }
  }

  private stockToWaste(): boolean {
    this._game.cardIndexTo = this._waste.length;
    const { cardIndexFrom } = this._game;
    const stockCard = this._stock[cardIndexFrom];
    stockCard.flip();
    this._waste.push(stockCard);
    this._stock.pop();
    return true;
  }

  private wasteToStock(): boolean {
    this._game.cardIndexTo = this.stock.length; // stock estará vacío, entonces el indice es 0
    this._waste.map(card => card.flip());
    this._stock = [...this._waste];
    this._stock.reverse();
    this._waste = [];
    return true;
  }

  private wasteToFoundation(): boolean {
    const { cardIndexFrom, indexTo } = this._game;
    this._game.cardIndexTo = this._foundations[indexTo].length;
    const wasteCard: PlayingCard = this._waste[cardIndexFrom];
    const foundation: PlayingCard[] = this._foundations[indexTo];
    const lastFoundationCard: PlayingCard = foundation[foundation.length - 1];

    const isValidMove: boolean = (foundation.length === 0 && wasteCard.order === 1) ||
      (lastFoundationCard && lastFoundationCard.suit === wasteCard.suit && lastFoundationCard.order + 1 === wasteCard.order);

    if (isValidMove) {
      foundation.push(wasteCard);
      this._waste.pop();
      return true;
    }
    return false;
  }

  private wasteToTableau(): boolean {
    const { cardIndexFrom, indexTo } = this._game;
    this._game.cardIndexTo = this._tableau[indexTo].length;
    const wasteCard: PlayingCard = this._waste[cardIndexFrom];
    const tableauSlot: PlayingCard[] = this._tableau[indexTo];
    const lastTableauCard: PlayingCard = tableauSlot[tableauSlot.length - 1];

    const isValidMove: boolean = (tableauSlot.length === 0 && wasteCard.order === 13) ||
      (lastTableauCard && wasteCard.order === lastTableauCard.order - 1 && wasteCard.color !== lastTableauCard.color);

    if (isValidMove) {
      this._tableau[indexTo].push(wasteCard);
      this._waste.pop();
      return true;
    }
    return false;
  }

  private tableauToFoundation(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this._foundations[indexTo].length;
    if (this._tableau[indexFrom].length - 1 !== cardIndexFrom) { return false; }
    const tableauCard = this._tableau[indexFrom][cardIndexFrom];
    const foundation = this._foundations[indexTo];
    const lastFoundationCard = foundation[foundation.length - 1];
    const isValidMove =
      (foundation.length === 0 && tableauCard.order === 1) ||
      (lastFoundationCard?.suit === tableauCard.suit && lastFoundationCard.order + 1 === tableauCard.order);
    if (isValidMove) {
      this._foundations[indexTo].push(tableauCard);
      this._tableau[indexFrom].pop();
      const idx = this._tableau[indexFrom].length - 1;
      if (idx >= 0 && !this._tableau[indexFrom][idx].view) {
        this._tableau[indexFrom][idx].flip();          // ahora sí re-renderiza (view es signal)
        this._flips.push({ cardIndex: idx, movementIndex: this._moves.length, slotIndex: indexFrom });
      }
      return true;
    }
    return false;
  }

  private tableauToTableau(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this._tableau[indexTo].length;
    const tableauFrom: PlayingCard[] = this._tableau[indexFrom];
    const tableauTo: PlayingCard[] = this._tableau[indexTo];
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
    this._game.cardIndexTo = this._tableau[indexTo].length;
    const foundationCard: PlayingCard = this._foundations[indexFrom][cardIndexFrom];
    const tableauSlot: PlayingCard[] = this._tableau[indexTo];
    const lastTableauCard: PlayingCard = tableauSlot[tableauSlot.length - 1];

    const isValidMove: boolean =
      (tableauSlot.length === 0 && foundationCard.order === 13) ||
      (lastTableauCard &&
        foundationCard.order === lastTableauCard.order - 1 &&
        foundationCard.color !== lastTableauCard.color);

    if (isValidMove) {
      tableauSlot.push(foundationCard);
      this._foundations[indexFrom].pop();
      return true;
    }
    return false;
  }

  private foundationToFoundation(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    this._game.cardIndexTo = this._foundations[indexTo].length;
    const foundationCard: PlayingCard = this._foundations[indexFrom][cardIndexFrom];
    const targetFoundation: PlayingCard[] = this._foundations[indexTo];

    if (foundationCard.order === 1 && targetFoundation.length === 0) {
      targetFoundation.push(foundationCard);
      this._foundations[indexFrom].pop();
      return true;
    }
    return false;
  }

  private stockToWasteUndo(): boolean {
    this._stock.reverse();
    this._waste = [...this._stock];
    this._waste.map(card => card.flip());
    this._stock = [];
    return true;
  }

  private wasteToStockUndo(): boolean {
    const { cardIndexFrom } = this._game;
    const wasteCard: PlayingCard = this._waste[cardIndexFrom];
    wasteCard.flip();
    this._stock.push(wasteCard);
    this._waste.pop();
    return true;
  }

  private tableauToWasteUndo(): boolean {
    const { cardIndexFrom, indexFrom } = this._game;
    const tableauCard: PlayingCard = this._tableau[indexFrom][cardIndexFrom];
    if (tableauCard) {
      this._waste.push(tableauCard);
      this._tableau[indexFrom].pop();
      return true;
    }
    return false;
  }

  private tableauToTableauUndo(): boolean {
    const { cardIndexFrom, indexTo, indexFrom } = this._game;
    const tableauFrom: PlayingCard[] = this._tableau[indexFrom];
    const tableauTo: PlayingCard[] = this._tableau[indexTo];
    const cardsToMove: PlayingCard[] = tableauFrom.splice(cardIndexFrom);
    tableauTo.push(...cardsToMove);

    const lastMovementIndex: number = this._moves.length - 1;
    const lastFlipIndex: number = this._flips.length - 1;
    if (this._flips.length && this._flips[lastFlipIndex].movementIndex === lastMovementIndex) {
      const flip: IFlip = this._flips[lastFlipIndex];
      this._tableau[flip.slotIndex][flip.cardIndex].flip();
      this._flips.pop();
    }
    return true;
  }

  private tableauToFoundationUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom, indexTo } = this._game;
    const tableauSlot: PlayingCard[] = this._tableau[indexFrom];
    const foundationSlot: PlayingCard[] = this._foundations[indexTo];

    if (tableauSlot.length === cardIndexFrom + 1 && foundationSlot.length === cardIndexTo) {
      const tableauCard: PlayingCard = tableauSlot[cardIndexFrom];
      foundationSlot.push(tableauCard);
      tableauSlot.pop();
    } else { /* Error de lógica en la implementación */ return false; }
    return true;
  }

  private foundationToWasteUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom } = this._game;
    const foundationSlot: PlayingCard[] = this._foundations[indexFrom];
    if (foundationSlot.length === cardIndexFrom + 1 && this.waste.length === cardIndexTo) {
      const foundationCard: PlayingCard = foundationSlot[cardIndexFrom];
      this._waste.push(foundationCard);
      foundationSlot.pop();
    } else { /* Error de lógica en la implementación */ return false; }
    return true;
  }

  private foundationToTableauUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom, indexTo } = this._game;
    const foundationSlot: PlayingCard[] = this._foundations[indexFrom];
    const tableauSlot: PlayingCard[] = this._tableau[indexTo];

    if (foundationSlot.length === cardIndexFrom + 1 && tableauSlot.length === cardIndexTo) {
      const foundationCard: PlayingCard = foundationSlot[cardIndexFrom];
      tableauSlot.push(foundationCard);
      foundationSlot.pop();
    } else { /* Error de lógica en la implementación */ return false; }

    const lastMovementIndex: number = this._moves.length - 1;
    const lastFlipIndex: number = this._flips.length - 1;
    if (this._flips.length && this._flips[lastFlipIndex].movementIndex === lastMovementIndex) {
      const flip: IFlip = this._flips[lastFlipIndex];
      this._tableau[flip.slotIndex][flip.cardIndex].flip();
      this._flips.pop();
    }
    return true;
  }

  private foundationToFoundationUndo(): boolean {
    const { cardIndexFrom, cardIndexTo, indexFrom, indexTo } = this._game;
    const foundationSlotFrom: PlayingCard[] = this._foundations[indexFrom];
    const foundationSlotTo: PlayingCard[] = this._foundations[indexTo];
    if (foundationSlotFrom.length === cardIndexFrom + 1 && foundationSlotTo.length === cardIndexTo) {
      const foundationCard: PlayingCard = foundationSlotFrom[cardIndexFrom];
      foundationSlotTo.push(foundationCard);
      foundationSlotFrom.pop();
    } else { /* Error de lógica en la implementación */ return false;
    }
    return true;
  }

  private checkGameStatus(): void {
    const { to, indexTo } = this._game;
    if (this._firstMove) { this._firstMove = false; this.startTime(); }
    if (to === 'foundation') {
      const moved = this._foundations[indexTo][this._foundations[indexTo].length - 1];
      if (moved && moved.name === 'K' && this._foundations.every(f => f.length === 13)) {
        this.endGame();
      }
    }
  }

  private endGame(): void {
    this.stopTime();
    this.gameService.setBestTime(this.time());
    this.bestTime.set(this.gameService.getBestTime() || this.time());
    this.gameOver.set(true);
  }

  public move(from: CardSet, to: CardSet, cardIndexFrom?: number): void {
    this._game.from = from;
    this._game.to = to;
    this._game.cardIndexFrom = cardIndexFrom !== undefined ? cardIndexFrom : this._game.cardIndexFrom;
    this.tryMovement();
  }

  public dragstart(from: Exclude<CardSet, 'stock'>, indexFrom: number, cardIndexFrom: number): void {
    this._game.from = from; this._game.indexFrom = indexFrom; this._game.cardIndexFrom = cardIndexFrom;
  }

  public dragover(event: Event): void { event.preventDefault(); }

  public drop(event: Event, to: Exclude<CardSet, 'stock' | 'waste'>, indexTo: number): void {
    event.preventDefault();
    this._game.to = to; this._game.indexTo = indexTo;
    this.tryMovement();
  }
}
