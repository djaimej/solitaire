import { CardSet } from "@models/types/card.type";

export const TIME_REGEX = /^(?:[0-5][0-9]|60):[0-5][0-9]$/;
export const TIME_FORMAT = '00:00';
export const MAX_TIME = 3600;
export const MOVEMENTS: CardSet[][] =[
    ['stock','waste'], ['waste','stock'],
    ['waste','tableau'], ['waste','foundation'],
    ['tableau','waste'], ['tableau','tableau'],
    ['tableau','foundation'], ['foundation','waste'],
    ['foundation','tableau'], ['foundation','foundation']
];

const MOVEMENT_HANDLERS = {
    stock: {
        waste: 'stockToWaste' // mover una a una las cartas de stock a waste
    },
    waste: {
        foundation: 'wasteToFoundation',
        tableau: 'wasteToTableau',
        stock: 'wasteToStock', // mover todas de waste a stock
    },
    tableau: {
        foundation: 'tableauToFoundation',
        tableau: 'tableauToTableau',
    },
    foundation: {
        tableau: 'foundationToTableau',
        foundation: 'foundationToFoundation',
    }
};

const UNDO_MOVEMENT_HANDLERS = {
    stock: {
        waste: 'stockToWasteUndo' // se han movido todas de waste a stock > este handle permitirá deshacer esto
    },
    waste: {
        stock: 'wasteToStockUndo', // cuando se mueve una carta de stock a waste, este handle permite retornarla
    },
    tableau: {
        waste: 'tableauToWasteUndo',
        tableau: 'tableauToTableauUndo',
        foundation: 'tableauToFoundationUndo'
    },
    foundation: {
        waste: 'foundationToWasteUndo',
        tableau: 'foundationToTableauUndo',
        foundation: 'foundationToFoundationUndo',
    }
}