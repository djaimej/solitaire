export type movementHandlers = {
    stock: {
        stock: () => boolean;
        waste: () => boolean;
        tableau: () => boolean;
        foundation: () => boolean;
    };
    waste: {
        stock: () => boolean;
        waste: () => boolean;
        tableau: () => boolean;
        foundation: () => boolean;
    };
    tableau: {
        stock: () => boolean;
        waste: () => boolean;
        tableau: () => boolean;
        foundation: () => boolean;
    };
    foundation: {
        stock: () => boolean;
        waste: () => boolean;
        tableau: () => boolean;
        foundation: () => boolean;
    };
}