export type Analyze = {
	word?: {
		text: string
	}
	pronunciation?: {
		ipa: string
	}
	meaning?: {
		part_of_speech: string
		definitions: string[]
	}[]
	example?: {
		sentence: string
		translation: string
	}[]
	origin?: {
		etymology: string
	}
	related?: {
		prefixes: string[]
		suffixes: string[]
		roots: string[]
	}
	derivatives?: {
		word: string
		meaning: string[]
	}[]
	synonyms?: {
		word: string
		meaning: string[]
	}[]
	homophones?: {
		word: string
		meaning: string[]
	}[]
}

