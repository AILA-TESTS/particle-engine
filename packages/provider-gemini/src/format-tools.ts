import type { ToolDefinition } from "@particle-engine/tools";
import type {
	FunctionDeclaration,
	FunctionDeclarationsTool,
	FunctionDeclarationSchema,
} from "@google-cloud/vertexai";
import { SchemaType } from "@google-cloud/vertexai";

/** Map JSON Schema type strings to Gemini SchemaType enum values */
function mapSchemaType(type: string | undefined): SchemaType {
	switch (type) {
		case "string":
			return SchemaType.STRING;
		case "number":
			return SchemaType.NUMBER;
		case "integer":
			return SchemaType.INTEGER;
		case "boolean":
			return SchemaType.BOOLEAN;
		case "array":
			return SchemaType.ARRAY;
		case "object":
			return SchemaType.OBJECT;
		default:
			return SchemaType.STRING;
	}
}

/** Convert a JSON Schema property to Gemini's Schema format recursively */
function convertProperty(prop: Record<string, unknown>): Record<string, unknown> {
	const type = prop.type as string | undefined;
	const result: Record<string, unknown> = {
		type: mapSchemaType(type),
	};

	if (prop.description) {
		result.description = prop.description;
	}

	if (prop.enum) {
		result.enum = prop.enum;
	}

	// Handle nested object properties
	if (type === "object" && prop.properties) {
		const properties = prop.properties as Record<string, Record<string, unknown>>;
		const converted: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(properties)) {
			converted[key] = convertProperty(value);
		}
		result.properties = converted;
		if (prop.required) {
			result.required = prop.required;
		}
	}

	// Handle array items
	if (type === "array" && prop.items) {
		const items = prop.items as Record<string, unknown>;
		result.items = convertProperty(items);
	}

	return result;
}

/** Convert our ToolDefinition[] to Gemini's FunctionDeclarationsTool[] format */
export function formatTools(tools: ToolDefinition[]): FunctionDeclarationsTool[] {
	const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => {
		const properties = tool.parameters.properties;
		const convertedProperties: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(properties)) {
			convertedProperties[key] = convertProperty(value as Record<string, unknown>);
		}

		const parameters: FunctionDeclarationSchema = {
			type: SchemaType.OBJECT,
			properties: convertedProperties as FunctionDeclarationSchema["properties"],
			...(tool.parameters.required ? { required: tool.parameters.required } : {}),
		};

		return {
			name: tool.name,
			description: tool.description,
			parameters,
		};
	});

	return [{ functionDeclarations }];
}
