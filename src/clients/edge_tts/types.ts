export interface EdgeTTSAPI {
	textToSpeech(params: {
		text: string,
		voice?: string,
		pitch?: string,
		rate?: number,
		volume?: number
		outputFormat?: string
	}): Promise<Blob>
}
