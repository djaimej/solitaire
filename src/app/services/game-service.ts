import { Injectable } from '@angular/core';
import { IMovement } from '@models/interfaces/game.interface';
import { TIME_FORMAT, TIME_REGEX } from '@shared/constants/game';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private _attemptedMovement: Subject<IMovement>;

  constructor() {
    this._attemptedMovement = new Subject<IMovement>();
  }

  /**
   * @deprecated
   */
  public getAttemptedMovement(): Observable<IMovement> {
    return this._attemptedMovement.asObservable();
  }

  /**
   * @deprecated
   */
  public setAttemptedMovement(move: IMovement): void {
    this._attemptedMovement.next(move);
  }

  public getBestTime(): string {
    return localStorage.getItem('~best-time') || TIME_FORMAT;
  }

  public setBestTime(time: string): void {
    if (!TIME_REGEX.test(time)) { throw new Error(`The time format must be "mm:ss" (minutes: 00-60, seconds: 00-59). Received value: ${time}`); }
    const previousTime: string | null = localStorage.getItem('~best-time');
    if (previousTime !== null) {
      const prevT: string[] = previousTime.split(':');
      const prevMin: number = +prevT[0];
      const prevSec: number = +prevT[1];
      const currT: string[] = time.split(':');
      const currMin: number = +currT[0];
      const currSec: number = +currT[1];
      if (currMin < prevMin || (currMin === prevMin && currSec < prevSec)) {
        localStorage.setItem('~best-time', time);
      }
    } else {
      localStorage.setItem('~best-time', time);
    }
  }
}
