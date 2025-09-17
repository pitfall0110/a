import { RxJsonSchema } from "rxdb";

export const plansSchema: RxJsonSchema<any> = {
    title: "plans",
    version: 0,
    primaryKey: "id",
    type: "object",
    properties: {
        id: {
            type: "string",
            maxLength: 36,
        },
        title: {
            type: "string",
        },
        imageUrl: {
            type: "string",
        },
        width: {
            type: "number",
        },
        height: {
            type: "number",
        },
        createdAt: {
            type: "string",
            format: "date-time",
            maxLength: 30,
        },
        updatedAt: {
            type: "string",
            format: "date-time",
            maxLength: 30,
        },
    },
    required: [
        "id",
        "title",
        "imageUrl",
        "width",
        "height",
        "createdAt",
        "updatedAt",
    ],
    indexes: ["updatedAt"],
};
