import { CardSet } from "@models/types/card.type";

/**
 * @property **cardIndexFrom**: Index of the card to move
 * @property **cardIndexTo**: the new index of the card after move
 * @property **from**: The "collection" from which the card comes, ex. stock
 * @property **to**: The "collection" where the card moves to, ex. foundation
 * @property **indexFrom**: The index of the "slot" in the set from which the card comes
 * @property **setIndexTo**: Index of the "slot" in the set where the card moves to
 */
export interface IMovement {
    readonly cardIndexFrom: number;
    readonly cardIndexTo: number;
    readonly from: CardSet;
    readonly to: CardSet;
    readonly indexFrom: number;
    readonly indexTo: number;
}

export interface IFlip {
    readonly slotIndex: number;
    readonly cardIndex: number;
    readonly movementIndex: number;
}
