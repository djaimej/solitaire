import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { PlayingCard } from '@models/clases/playing-card';

@Component({
  selector: 'app-card',
  imports: [CommonModule, AngularSvgIconModule],
  templateUrl: './card.html',
  styleUrl: './card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {
  @Input({ required: true }) public card!: PlayingCard;
  @Output() public onDblClick = new EventEmitter<void>();
  @Output() public onClick = new EventEmitter<void>();

  public get frontIconSrc(): string { return `assets/icons/${this.card.suit}.svg`; }
  public readonly backIconSrc = 'assets/icons/Cadmus.svg';

  public dblclick(): void { if (!this.card.view) { return; } this.onDblClick.emit(); }
  public click(): void { if (this.card.view) { return; } this.onClick.emit(); }
}
