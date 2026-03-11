/** Authentication mode for the Gemini provider */
export type GeminiAuthMode = "apiKey" | "vertexai";

/** Configuration specific to the Gemini provider */
export interface GeminiProviderConfig {
	/** Model ID (default: 'gemini-2.0-flash') */
	modelId?: string;

	/** Explicit auth mode override. Auto-detected if not specified:
	 *  - If `apiKey` is provided → 'apiKey'
	 *  - If `projectId` is provided → 'vertexai'
	 */
	authMode?: GeminiAuthMode;

	// --- API Key mode fields ---

	/** Google API key for Generative AI API (API key mode) */
	apiKey?: string;

	// --- Vertex AI mode fields ---

	/** GCP project ID (Vertex AI mode) */
	projectId?: string;
	/** GCP location (Vertex AI mode, default: 'us-central1') */
	location?: string;
}
