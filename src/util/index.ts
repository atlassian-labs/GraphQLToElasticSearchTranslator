import type { WhereFilterObject } from "../types";

function getDepth(obj: WhereFilterObject): number {
    let depth = 0;

    if (obj.and) {
        obj.and.forEach((d) => {
            const tmpDepth = getDepth(d);
            if (tmpDepth > depth) {
                depth = tmpDepth;
            }
        });
    } else if (obj.or) {
        obj.or.forEach((d) => {
            const tmpDepth = getDepth(d);
            if (tmpDepth > depth) {
                depth = tmpDepth;
            }
        });
    }

    return 1 + depth;
}

class Stack<T> {
    items: T[];

    constructor() {
        this.items = [];
    }

    pop() {
        if (this.items.length === 0) {
            return "underflow";
        }
        const res = this.items.pop();
        if (res !== undefined) {
            return res;
        }
        return "underflow";
    }

    push(item: T) {
        this.items.push(item);
    }

    isEmpty() {
        return this.items.length === 0;
    }
}

export { Stack, getDepth };
