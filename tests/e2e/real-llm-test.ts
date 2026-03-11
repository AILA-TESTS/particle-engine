#!/usr/bin/env npx tsx
// =============================================================================
// E2E Test — Full pipeline with real Gemini LLM
//
// Tests the complete flow:
//   User prompt -> Gemini API (function calling) -> ToolExecutor -> Grid state -> SVG render
//
// Uses Google Generative AI REST API (API key auth) since the project's
// GeminiProvider requires Vertex AI (service account auth).
// =============================================================================

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// 1. Load credentials from .env.sample
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const envPath = resolve(projectRoot, ".env.sample");
const envContent = readFileSync(envPath, "utf-8");

function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) throw new Error(`Missing ${name} in .env.sample`);
  return match[1].trim();
}

const GOOGLE_API_KEY = getEnvVar("GOOGLE_API_KEY");
const MODEL = "gemini-2.0-flash";
const API_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

console.log("=".repeat(70));
console.log("  PARTICLE ENGINE — E2E Test with Real Gemini LLM");
console.log("=".repeat(70));
console.log(`  Model:    ${MODEL}`);
console.log(`  API Key:  ${GOOGLE_API_KEY.slice(0, 10)}...`);
console.log("=".repeat(70));
console.log();

// ---------------------------------------------------------------------------
// 2. Import monorepo packages (source-level via tsx)
// ---------------------------------------------------------------------------

// Dynamic imports to handle the workspace resolution
const { ToolExecutor } = await import(
  resolve(projectRoot, "packages/tools/src/index.ts")
);
const { SVGRenderer } = await import(
  resolve(projectRoot, "packages/renderer-svg/src/index.ts")
);

// ---------------------------------------------------------------------------
// 3. Create grid + tool executor
// ---------------------------------------------------------------------------

const GRID_ROWS = 20;
const GRID_COLS = 20;
const GRID_SPACING = 10;

const executor = new ToolExecutor({
  rows: GRID_ROWS,
  cols: GRID_COLS,
  spacing: GRID_SPACING,
});

const toolDefinitions = executor.getToolDefinitions();

console.log(`Grid: ${GRID_ROWS}x${GRID_COLS}, spacing=${GRID_SPACING}`);
console.log(
  `Available tools (${toolDefinitions.length}): ${toolDefinitions.map((t: any) => t.name).join(", ")}`
);
console.log();

// ---------------------------------------------------------------------------
// 4. Convert tool definitions to Gemini function declarations
// ---------------------------------------------------------------------------

type GeminiSchemaType =
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT";

function mapJsonSchemaType(type: string | undefined): GeminiSchemaType {
  switch (type) {
    case "string":
      return "STRING";
    case "number":
      return "NUMBER";
    case "integer":
      return "INTEGER";
    case "boolean":
      return "BOOLEAN";
    case "array":
      return "ARRAY";
    case "object":
      return "OBJECT";
    default:
      return "STRING";
  }
}

function convertProperty(prop: Record<string, unknown>): Record<string, unknown> {
  const type = prop.type as string | undefined;
  const result: Record<string, unknown> = {
    type: mapJsonSchemaType(type),
  };

  if (prop.description) result.description = prop.description;
  if (prop.enum) result.enum = prop.enum;

  if (type === "object" && prop.properties) {
    const properties = prop.properties as Record<
      string,
      Record<string, unknown>
    >;
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      converted[key] = convertProperty(value);
    }
    result.properties = converted;
    if (prop.required) result.required = prop.required;
  }

  if (type === "array" && prop.items) {
    result.items = convertProperty(prop.items as Record<string, unknown>);
  }

  return result;
}

function toGeminiFunctionDeclarations(
  tools: Array<{
    name: string;
    description: string;
    parameters: { type: string; properties: Record<string, unknown>; required?: string[] };
  }>
) {
  return tools.map((tool) => {
    const convertedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tool.parameters.properties)) {
      convertedProps[key] = convertProperty(value as Record<string, unknown>);
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "OBJECT",
        properties: convertedProps,
        ...(tool.parameters.required
          ? { required: tool.parameters.required }
          : {}),
      },
    };
  });
}

// Only include a subset of tools for simplicity (the ones relevant to our test)
const relevantToolNames = new Set([
  "get_space_info",
  "get_state",
  "set_particles",
  "clear_particles",
  "connect",
  "disconnect",
]);

const relevantTools = toolDefinitions.filter((t: any) =>
  relevantToolNames.has(t.name)
);

const geminiFunctionDeclarations = toGeminiFunctionDeclarations(relevantTools);

// ---------------------------------------------------------------------------
// 5. Build the system prompt
// ---------------------------------------------------------------------------

const systemPrompt = `You are a visual creation assistant. You have access to a 2D particle grid space with ${GRID_ROWS} rows and ${GRID_COLS} columns of evenly-spaced dots.

You can:
- Activate particles at specific grid coordinates (row, col) using set_particles
- Connect particles with lines using connect
- Query the space info and state

The grid uses 0-indexed integer coordinates. Row 0 is the top, row ${GRID_ROWS - 1} is the bottom. Column 0 is the left, column ${GRID_COLS - 1} is the right.

IMPORTANT: When you want to place particles, use the set_particles tool with a "particles" array. Each particle needs at minimum "row" and "col" fields. You can also specify "color" as a hex string like "#FF0000".

When connecting particles, use the connect tool with a "connections" array. Each connection needs "from" and "to" as [row, col] arrays.

After placing all particles and connections, respond with a text summary of what you created. Do NOT call any more tools after completing the visual.`;

// ---------------------------------------------------------------------------
// 6. Gemini API helper
// ---------------------------------------------------------------------------

interface GeminiContent {
  role: "user" | "model";
  parts: Array<
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | {
        functionResponse: {
          name: string;
          response: Record<string, unknown>;
        };
      }
  >;
}

async function callGemini(
  contents: GeminiContent[],
  systemInstruction: string,
  functionDeclarations: unknown[]
): Promise<{
  candidates: Array<{
    content: { parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
    finishReason: string;
  }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
}> {
  const url = `${API_BASE}:generateContent?key=${GOOGLE_API_KEY}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    tools: [{ function_declarations: functionDeclarations }],
    generation_config: {
      temperature: 0.1,
      max_output_tokens: 4096,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error ${response.status}: ${errorText}`
    );
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// 7. Run the conversation loop
// ---------------------------------------------------------------------------

const userPrompt =
  "Place 5 red particles in a diagonal line from position (0,0) to (4,4), and then connect them with white lines from each particle to the next one.";

console.log(`User prompt: "${userPrompt}"`);
console.log();

const conversationHistory: GeminiContent[] = [
  { role: "user", parts: [{ text: userPrompt }] },
];

let roundNum = 0;
let totalToolCalls = 0;
const toolCallLog: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];

const MAX_ROUNDS = 10; // Safety limit

while (roundNum < MAX_ROUNDS) {
  roundNum++;
  console.log(`--- Round ${roundNum} ---`);

  const response = await callGemini(
    conversationHistory,
    systemPrompt,
    geminiFunctionDeclarations
  );

  const candidate = response.candidates?.[0];
  if (!candidate) {
    console.error("No candidate in response!");
    break;
  }

  const parts = candidate.content.parts;
  const textParts: string[] = [];
  const functionCalls: Array<{ name: string; args: Record<string, unknown> }> =
    [];

  for (const part of parts) {
    if (part.text) {
      textParts.push(part.text);
    }
    if (part.functionCall) {
      functionCalls.push(part.functionCall);
    }
  }

  if (textParts.length > 0) {
    console.log(`  LLM text: ${textParts.join("").slice(0, 200)}...`);
  }

  // No function calls means the conversation is done
  if (functionCalls.length === 0) {
    console.log("  [No tool calls — conversation complete]");
    // Add the model's final text to history
    conversationHistory.push({
      role: "model",
      parts: parts.map((p) => {
        if (p.text) return { text: p.text };
        return p as any;
      }),
    });
    break;
  }

  // Process function calls
  console.log(`  Tool calls: ${functionCalls.length}`);

  // Add the model response to history (with function calls)
  conversationHistory.push({
    role: "model",
    parts: parts.map((p) => {
      if (p.text) return { text: p.text };
      if (p.functionCall)
        return { functionCall: { name: p.functionCall.name, args: p.functionCall.args } };
      return p as any;
    }),
  });

  // Execute each function call and collect responses
  const functionResponseParts: GeminiContent["parts"] = [];

  for (const fc of functionCalls) {
    totalToolCalls++;
    console.log(
      `  -> ${fc.name}(${JSON.stringify(fc.args).slice(0, 120)})`
    );

    const result = executor.execute(fc.name, fc.args ?? {});
    console.log(
      `     Result: success=${result.success}${result.error ? ` error="${result.error}"` : ""}`
    );

    toolCallLog.push({ name: fc.name, args: fc.args ?? {}, result });

    functionResponseParts.push({
      functionResponse: {
        name: fc.name,
        response: result as Record<string, unknown>,
      },
    });
  }

  // Add function responses to history
  conversationHistory.push({
    role: "user",
    parts: functionResponseParts,
  });

  if (response.usageMetadata) {
    console.log(
      `  Tokens: input=${response.usageMetadata.promptTokenCount}, output=${response.usageMetadata.candidatesTokenCount}`
    );
  }

  console.log();
}

// ---------------------------------------------------------------------------
// 8. Verify grid state
// ---------------------------------------------------------------------------

console.log();
console.log("=".repeat(70));
console.log("  VERIFICATION");
console.log("=".repeat(70));

const grid = executor.getGrid();
const spaceInfo = grid.getSpaceInfo();

console.log(`  Active particles: ${spaceInfo.activeCount}`);
console.log(`  Connections: ${spaceInfo.connectionCount}`);
console.log(`  Groups: ${spaceInfo.groups.length > 0 ? spaceInfo.groups.join(", ") : "(none)"}`);

// Check that we have particles on the diagonal
const expectedPositions = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
];

let particlesCorrect = 0;
for (const [row, col] of expectedPositions) {
  const particle = grid.getParticle(row, col);
  if (particle) {
    particlesCorrect++;
    console.log(
      `  Particle at (${row},${col}): color=${particle.color}, opacity=${particle.opacity}`
    );
  } else {
    console.log(`  MISSING particle at (${row},${col})`);
  }
}

console.log();
console.log(
  `  Diagonal particles: ${particlesCorrect}/5 found${particlesCorrect === 5 ? " (PASS)" : " (PARTIAL)"}`
);

// Check connections
const expectedConnections = spaceInfo.connectionCount;
console.log(
  `  Connections: ${expectedConnections} found${expectedConnections >= 4 ? " (PASS)" : " (check)"}`
);

// ---------------------------------------------------------------------------
// 9. Render SVG
// ---------------------------------------------------------------------------

console.log();
console.log("=".repeat(70));
console.log("  SVG RENDERING");
console.log("=".repeat(70));

const state = grid.getState();
const renderer = new SVGRenderer();
const svgResult = renderer.render(state, {
  width: 400,
  height: 400,
  backgroundColor: "#1a1a2e",
  showGrid: true,
  gridDotColor: "#333355",
  gridDotRadius: 1.5,
  padding: 20,
});

const svgOutputPath = resolve(projectRoot, "tests/e2e/output.svg");
writeFileSync(svgOutputPath, svgResult.svg, "utf-8");

console.log(`  SVG saved to: ${svgOutputPath}`);
console.log(`  SVG dimensions: ${svgResult.width}x${svgResult.height}`);
console.log(`  SVG size: ${svgResult.svg.length} chars`);

// ---------------------------------------------------------------------------
// 10. Summary
// ---------------------------------------------------------------------------

console.log();
console.log("=".repeat(70));
console.log("  SUMMARY");
console.log("=".repeat(70));
console.log(`  Conversation rounds: ${roundNum}`);
console.log(`  Total tool calls: ${totalToolCalls}`);
console.log(`  Tool call log:`);
for (const entry of toolCallLog) {
  console.log(
    `    - ${entry.name}: ${(entry.result as any).success ? "OK" : "FAILED"}`
  );
}
console.log(`  Final grid: ${spaceInfo.activeCount} particles, ${spaceInfo.connectionCount} connections`);
console.log(`  SVG output: ${svgOutputPath}`);
console.log();

// Final pass/fail
const passed =
  spaceInfo.activeCount >= 5 && spaceInfo.connectionCount >= 4;
console.log(
  passed
    ? "  >>> E2E TEST PASSED <<<"
    : "  >>> E2E TEST: PARTIAL (LLM may have interpreted differently) <<<"
);
console.log("=".repeat(70));

process.exit(passed ? 0 : 1);
