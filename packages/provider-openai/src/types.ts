/** Configuration specific to the OpenAI provider */
export interface OpenAIProviderConfig {
	/** OpenAI API key */
	apiKey: string;
	/** Model ID (default: 'gpt-4o') */
	modelId?: string;
	/** Custom API endpoint (for Azure, local, etc.) */
	baseURL?: string;
	/** OpenAI organization ID */
	organization?: string;
}
