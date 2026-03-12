// ============================================================
// Draw Connections — Connection rendering onto Canvas 2D context
// ============================================================

import type { SerializedConnection } from '@particle-engine/core';
import type { CanvasContext2D } from './types.js';

/** Arrowhead size in pixels */
const ARROWHEAD_LENGTH = 10;
const ARROWHEAD_ANGLE = Math.PI / 6; // 30 degrees

/**
 * Draw a single connection between two points onto the canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param fromX - Start X position in pixels
 * @param fromY - Start Y position in pixels
 * @param toX - End X position in pixels
 * @param toY - End Y position in pixels
 * @param connection - Connection data (color, width, opacity, style, curve, directed, label)
 */
export function drawConnection(
	ctx: CanvasContext2D,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	connection: SerializedConnection,
): void {
	ctx.save();

	ctx.strokeStyle = connection.color;
	ctx.lineWidth = connection.width;
	ctx.globalAlpha = connection.opacity;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// Set dash pattern based on style
	if (connection.style === 'dashed') {
		ctx.setLineDash([8, 4]);
	} else if (connection.style === 'dotted') {
		ctx.setLineDash([2, 4]);
	} else {
		ctx.setLineDash([]);
	}

	ctx.beginPath();
	ctx.moveTo(fromX, fromY);

	if (connection.curve !== 0) {
		// Curved connection: compute control point offset perpendicular to line
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len > 0) {
			// Perpendicular direction (normalized)
			const nx = -dy / len;
			const ny = dx / len;

			// Control point is offset from midpoint by curve amount * spacing
			const cpX = midX + nx * connection.curve;
			const cpY = midY + ny * connection.curve;

			ctx.quadraticCurveTo(cpX, cpY, toX, toY);
		} else {
			ctx.lineTo(toX, toY);
		}
	} else {
		// Straight connection
		ctx.lineTo(toX, toY);
	}

	ctx.stroke();

	// Reset line dash before drawing arrowhead
	ctx.setLineDash([]);

	// Draw arrowhead if directed
	if (connection.directed) {
		drawArrowhead(ctx, fromX, fromY, toX, toY, connection.curve);
	}

	// Draw label at midpoint if present
	if (connection.label) {
		drawLabel(ctx, fromX, fromY, toX, toY, connection.label, connection.color);
	}

	ctx.restore();
}

/**
 * Draw an arrowhead at the end of a connection.
 */
function drawArrowhead(
	ctx: CanvasContext2D,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	curve: number,
): void {
	// For curved lines, compute the angle from the control point to the endpoint
	let angle: number;
	if (curve !== 0) {
		const midX = (fromX + toX) / 2;
		const midY = (fromY + toY) / 2;
		const dx = toX - fromX;
		const dy = toY - fromY;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len > 0) {
			const nx = -dy / len;
			const ny = dx / len;
			const cpX = midX + nx * curve;
			const cpY = midY + ny * curve;
			angle = Math.atan2(toY - cpY, toX - cpX);
		} else {
			angle = Math.atan2(toY - fromY, toX - fromX);
		}
	} else {
		angle = Math.atan2(toY - fromY, toX - fromX);
	}

	ctx.fillStyle = ctx.strokeStyle;

	ctx.beginPath();
	ctx.moveTo(toX, toY);
	ctx.lineTo(
		toX - ARROWHEAD_LENGTH * Math.cos(angle - ARROWHEAD_ANGLE),
		toY - ARROWHEAD_LENGTH * Math.sin(angle - ARROWHEAD_ANGLE),
	);
	ctx.lineTo(
		toX - ARROWHEAD_LENGTH * Math.cos(angle + ARROWHEAD_ANGLE),
		toY - ARROWHEAD_LENGTH * Math.sin(angle + ARROWHEAD_ANGLE),
	);
	ctx.closePath();
	ctx.fill();
}

/**
 * Draw a text label at the midpoint of a connection.
 */
function drawLabel(
	ctx: CanvasContext2D,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	label: string,
	color: string,
): void {
	const midX = (fromX + toX) / 2;
	const midY = (fromY + toY) / 2;

	ctx.fillStyle = color;
	ctx.font = '12px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, midX, midY);
}
