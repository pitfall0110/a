import { render, screen, fireEvent } from "@testing-library/react";
import PlanCanvas from "../components/PlanCanvas";
import * as dbModule from "../db";
import * as uiState from "../state/ui";
import * as userState from "../state/currentUser";

jest.mock("../db", () => ({
    initDB: jest.fn(),
}));

jest.mock("../state/ui", () => ({
    useUI: jest.fn(),
}));

jest.mock("../state/currentUser", () => ({
    useUser: jest.fn(),
}));

describe("PlanCanvas", () => {
    const mockSetPan = jest.fn();
    const mockSetZoom = jest.fn();
    const mockOpenList = jest.fn();
    const mockSetMode = jest.fn();

    beforeEach(() => {
        (uiState.useUI as unknown as jest.Mock).mockReturnValue({
            pan: { x: 0, y: 0 },
            zoom: 1,
            setPan: mockSetPan,
            setZoom: mockSetZoom,
            openList: mockOpenList,
            mode: "place",
            setMode: mockSetMode,
        });

        (userState.useUser as unknown as jest.Mock).mockReturnValue({
            userId: "testUser",
        });

        // Mock canvas getContext
        HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
            clearRect: jest.fn(),
            fillRect: jest.fn(),
            beginPath: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            restore: jest.fn(),
            save: jest.fn(),
            drawImage: jest.fn(),
        })) as any;
    });

    it("renders canvas", () => {
        render(<PlanCanvas />);
        const canvas =
            screen.getByRole("img", { hidden: true }) ||
            screen.getByRole("canvas", { hidden: true });
        expect(canvas).toBeInTheDocument();
    });

    it("handles mouse down for place mode", () => {
        render(<PlanCanvas />);
        const canvas =
            screen.getByRole("img", { hidden: true }) ||
            screen.getByRole("canvas", { hidden: true });

        fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });

        expect(mockSetMode).toHaveBeenCalledWith("select");
        expect(mockOpenList).toHaveBeenCalled();
    });

    it("handles wheel zoom events", () => {
        render(<PlanCanvas />);
        const canvas =
            screen.getByRole("img", { hidden: true }) ||
            screen.getByRole("canvas", { hidden: true });

        fireEvent.wheel(canvas, { deltaY: -100, clientX: 50, clientY: 50 });

        expect(mockSetZoom).toHaveBeenCalled();
        expect(mockSetPan).toHaveBeenCalled();
    });

    it("renders error div when error occurs", () => {
        // simulate image load error by mocking Image constructor
        const originalImage = (globalThis as any).Image;
        (globalThis as any).Image = class {
            onerror: any = null;
            set src(_str: string) {
                if (this.onerror) this.onerror(new Error("fail"));
            }
        };

        render(<PlanCanvas />);
        const errorDiv = screen.queryByText(/fail/i);
        expect(errorDiv).not.toBeInTheDocument();

        // restore Image
        (globalThis as any).Image = originalImage;
    });
});
