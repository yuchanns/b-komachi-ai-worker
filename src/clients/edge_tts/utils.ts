export const generateRandomHex = () => {
	let array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array)
		.map(byte => byte.toString(16)
			.padStart(2, '0')).join('');
}

export const generateConnectionId = () => {
	return crypto.randomUUID().replace(/-/g, '');
}

export const dateToString = () => {
	return new Date().toUTCString().replace(/GMT/, 'GMT+0000 (Coordinated Universal Time)');
}

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

export const generateSecMsGec = (trustedClientToken: string) => {
	// Get current timestamp in Unix format
	let ticks = Date.now() / 1000;
	
	// Switch to Windows file time epoch (1601-01-01 00:00:00 UTC)
	ticks += WIN_EPOCH;
	
	// Round down to the nearest 5 minutes (300 seconds)
	ticks = Math.floor(ticks / 300) * 300;
	
	// Convert to 100-nanosecond intervals (Windows file time format)
	ticks = ticks * S_TO_NS / 100;
	
	// Create the string to hash
	const strToHash = `${Math.floor(ticks)}${trustedClientToken}`;
	
	// Compute SHA256 hash
	const encoder = new TextEncoder();
	const data = encoder.encode(strToHash);
	
	return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
	});
}
