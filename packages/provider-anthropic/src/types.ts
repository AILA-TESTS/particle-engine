/** Configuration specific to the Anthropic Claude provider */
export interface AnthropicProviderConfig {
	/** Anthropic API key */
	apiKey: string;
	/** Model ID (default: 'claude-sonnet-4-20250514') */
	modelId?: string;
	/** Maximum output tokens (default: 4096) */
	maxTokens?: number;
	/** Custom API endpoint */
	baseURL?: string;
}
