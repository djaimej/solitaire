import { CommonModule } from '@angular/common';
import { AfterContentInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { PlayingCard } from '@models/clases/playing-card';
import { AngularSvgIconModule } from 'angular-svg-icon';

@Component({
  selector: 'app-card',
  imports: [CommonModule, AngularSvgIconModule],
  standalone: true,
  templateUrl: './card.html',
  styleUrl: './card.scss'
})
export class Card implements AfterContentInit {
  public frontIconSrc: string;
  public backIconSrc: string;
  @Input() public card: PlayingCard;
  @Output() public onDblClick = new EventEmitter();
  @Output() public onClick = new EventEmitter();

  constructor() {
    this.card = new PlayingCard('X', 'Joker');
    this.frontIconSrc = `assets/icons/Joker.svg`;
    this.backIconSrc = `assets/icons/Cadmus.svg`;
  }

  public ngAfterContentInit(): void {
    this.frontIconSrc = `assets/icons/${this.card.suit}.svg`;
  }

  public dblclick(): void {
    if (!this.card.view) { return; }
    this.onDblClick.emit();
  }

  public click(): void {
    if (this.card.view) { return; }
    this.onClick.emit();
  }
}
