import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostBinding, HostListener } from '@angular/core';

import { Size, Variant } from '@models/types/property.type';
import { ButtonType } from '@models/types/button.type';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrls: ['./button.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Button {
  @Input() type: ButtonType;
  @Input() size: Size;
  @Input() variant: Variant;
  @Input() disabled;
  @Output() onClick;

  constructor() {
    this.type = 'button';
    this.size = 'md';
    this.variant = 'solid';
    this.disabled = false;
    this.onClick = new EventEmitter<Event>();
  }

  @HostBinding('class') get classes(): string {
    return `${this.size} ${this.variant} ${this.disabled ? 'disabled' : ''}`;
  }

  @HostListener('click', ['$event'])
  onClickButton(event: Event): void {
    if (this.disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.onClick.emit(event);
  }
}
