export interface Voice {
    Name: string
    ShortName: string
    Gender: string
    Locale: string
    SuggestedCodec: string
    FriendlyName: string
    Status: string
    VoiceTag: {
        ContentCategories: string[]
        VoicePersonalities: string[]
    }
}

export interface EdgeTTSAPI {
    textToSpeech(params: {
        text: string
        voice?: string
        pitch?: string
        rate?: string
        volume?: string
        outputFormat?: string
    }): Promise<Blob>
    listVoices(): Promise<Voice[]>
}
