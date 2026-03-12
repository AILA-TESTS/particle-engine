// ============================================================
// Mock Canvas — Records all drawing calls for test verification
// ============================================================

import type {
	CanvasContext2D,
	CanvasLike,
	CanvasFactory,
	CanvasGradient,
	CanvasPattern,
	CanvasLineCap,
	CanvasLineJoin,
	CanvasTextAlign,
	CanvasTextBaseline,
} from '../src/types.js';

/** A recorded method call */
export interface RecordedCall {
	method: string;
	args: unknown[];
}

/**
 * Mock CanvasContext2D that records all method calls and property sets.
 */
export class MockContext implements CanvasContext2D {
	calls: RecordedCall[] = [];

	// Property backing fields
	private _fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
	private _strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
	private _lineWidth = 1;
	private _lineCap: CanvasLineCap = 'butt';
	private _lineJoin: CanvasLineJoin = 'miter';
	private _globalAlpha = 1;
	private _imageSmoothingEnabled = true;
	private _font = '10px sans-serif';
	private _textAlign: CanvasTextAlign = 'start';
	private _textBaseline: CanvasTextBaseline = 'alphabetic';

	// Style property accessors with recording
	get fillStyle(): string | CanvasGradient | CanvasPattern { return this._fillStyle; }
	set fillStyle(value: string | CanvasGradient | CanvasPattern) {
		this._fillStyle = value;
		this.calls.push({ method: 'set:fillStyle', args: [value] });
	}

	get strokeStyle(): string | CanvasGradient | CanvasPattern { return this._strokeStyle; }
	set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
		this._strokeStyle = value;
		this.calls.push({ method: 'set:strokeStyle', args: [value] });
	}

	get lineWidth(): number { return this._lineWidth; }
	set lineWidth(value: number) {
		this._lineWidth = value;
		this.calls.push({ method: 'set:lineWidth', args: [value] });
	}

	get lineCap(): CanvasLineCap { return this._lineCap; }
	set lineCap(value: CanvasLineCap) {
		this._lineCap = value;
		this.calls.push({ method: 'set:lineCap', args: [value] });
	}

	get lineJoin(): CanvasLineJoin { return this._lineJoin; }
	set lineJoin(value: CanvasLineJoin) {
		this._lineJoin = value;
		this.calls.push({ method: 'set:lineJoin', args: [value] });
	}

	get globalAlpha(): number { return this._globalAlpha; }
	set globalAlpha(value: number) {
		this._globalAlpha = value;
		this.calls.push({ method: 'set:globalAlpha', args: [value] });
	}

	get imageSmoothingEnabled(): boolean { return this._imageSmoothingEnabled; }
	set imageSmoothingEnabled(value: boolean) {
		this._imageSmoothingEnabled = value;
		this.calls.push({ method: 'set:imageSmoothingEnabled', args: [value] });
	}

	get font(): string { return this._font; }
	set font(value: string) {
		this._font = value;
		this.calls.push({ method: 'set:font', args: [value] });
	}

	get textAlign(): CanvasTextAlign { return this._textAlign; }
	set textAlign(value: CanvasTextAlign) {
		this._textAlign = value;
		this.calls.push({ method: 'set:textAlign', args: [value] });
	}

	get textBaseline(): CanvasTextBaseline { return this._textBaseline; }
	set textBaseline(value: CanvasTextBaseline) {
		this._textBaseline = value;
		this.calls.push({ method: 'set:textBaseline', args: [value] });
	}

	// Methods
	save(): void { this.calls.push({ method: 'save', args: [] }); }
	restore(): void { this.calls.push({ method: 'restore', args: [] }); }
	scale(x: number, y: number): void { this.calls.push({ method: 'scale', args: [x, y] }); }
	beginPath(): void { this.calls.push({ method: 'beginPath', args: [] }); }
	closePath(): void { this.calls.push({ method: 'closePath', args: [] }); }
	moveTo(x: number, y: number): void { this.calls.push({ method: 'moveTo', args: [x, y] }); }
	lineTo(x: number, y: number): void { this.calls.push({ method: 'lineTo', args: [x, y] }); }

	quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
		this.calls.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
	}

	arc(
		x: number,
		y: number,
		radius: number,
		startAngle: number,
		endAngle: number,
		counterclockwise?: boolean,
	): void {
		this.calls.push({ method: 'arc', args: [x, y, radius, startAngle, endAngle, counterclockwise] });
	}

	fill(): void { this.calls.push({ method: 'fill', args: [] }); }
	stroke(): void { this.calls.push({ method: 'stroke', args: [] }); }

	fillRect(x: number, y: number, w: number, h: number): void {
		this.calls.push({ method: 'fillRect', args: [x, y, w, h] });
	}

	clearRect(x: number, y: number, w: number, h: number): void {
		this.calls.push({ method: 'clearRect', args: [x, y, w, h] });
	}

	setLineDash(segments: number[]): void {
		this.calls.push({ method: 'setLineDash', args: [segments] });
	}

	fillText(text: string, x: number, y: number): void {
		this.calls.push({ method: 'fillText', args: [text, x, y] });
	}

	// Utility methods for tests

	/** Get all calls of a specific method */
	getCalls(method: string): RecordedCall[] {
		return this.calls.filter(c => c.method === method);
	}

	/** Check if a method was called */
	wasCalled(method: string): boolean {
		return this.calls.some(c => c.method === method);
	}

	/** Get the number of times a method was called */
	callCount(method: string): number {
		return this.calls.filter(c => c.method === method).length;
	}

	/** Reset recorded calls */
	reset(): void {
		this.calls = [];
	}
}

/**
 * Mock CanvasLike that returns a MockContext.
 */
export class MockCanvas implements CanvasLike {
	width: number;
	height: number;
	context: MockContext;

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.context = new MockContext();
	}

	getContext(type: '2d'): MockContext | null {
		if (type === '2d') {
			return this.context;
		}
		return null;
	}
}

/**
 * Mock CanvasFactory that creates MockCanvas instances.
 */
export class MockCanvasFactory implements CanvasFactory {
	createdCanvases: MockCanvas[] = [];

	createCanvas(width: number, height: number): MockCanvas {
		const canvas = new MockCanvas(width, height);
		this.createdCanvases.push(canvas);
		return canvas;
	}
}
