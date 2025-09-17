import { RxJsonSchema } from "rxdb";

export const usersSchema: RxJsonSchema<any> = {
    title: "users",
    version: 0,
    primaryKey: "id",
    type: "object",
    properties: {
        id: {
            type: "string",
            maxLength: 36,
        },
        name: {
            type: "string",
            maxLength: 255,
        },
        createdAt: {
            type: "string",
            format: "date-time",
        },
    },
    required: ["id", "name", "createdAt"],
    indexes: ["name"],
};
