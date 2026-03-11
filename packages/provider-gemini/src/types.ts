/** Configuration specific to the Gemini provider */
export interface GeminiProviderConfig {
	/** GCP project ID */
	projectId: string;
	/** GCP location (default: 'us-central1') */
	location?: string;
	/** Model ID (default: 'gemini-2.0-flash') */
	modelId?: string;
}
