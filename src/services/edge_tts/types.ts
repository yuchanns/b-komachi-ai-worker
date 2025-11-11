export interface EdgeTTSAPI {
	textToSpeech(params: {
		text: string,
		voice?: string,
		pitch?: string,
		rate?: string,
		volume?: string
		outputFormat?: string
	}): Promise<Blob>
}
