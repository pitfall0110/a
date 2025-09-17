import { RxJsonSchema } from "rxdb";

export const tasksSchema: RxJsonSchema<any> = {
    title: "tasks",
    version: 0,
    primaryKey: "id",
    type: "object",
    properties: {
        id: { type: "string", maxLength: 36 },
        userId: { type: "string", maxLength: 36 },
        planId: { type: "string", maxLength: 36 },
        title: { type: "string" },
        position: {
            type: "object",
            properties: {
                x: { type: "number", minimum: 0, maximum: 1 },
                y: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["x", "y"],
        },
        checklist: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    text: { type: "string" },
                    status: {
                        type: "string",
                        enum: [
                            "not_started",
                            "in_progress",
                            "blocked",
                            "final_check",
                            "done",
                        ],
                    },
                },
                required: ["id", "text", "status"],
            },
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
        "userId",
        "planId",
        "title",
        "position",
        "createdAt",
        "updatedAt",
    ],
    indexes: ["userId", ["userId", "planId"], ["userId", "updatedAt"]],
};
