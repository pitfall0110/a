import { v4 as uuid } from "uuid";

const KEY = "clientId";

export function getOrCreateClientId(): string {
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = uuid();
        localStorage.setItem(KEY, id);
    }
    return id;
}
