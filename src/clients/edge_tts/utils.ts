export const generateRandomHex = () => {
	let array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array)
		.map(byte => byte.toString(16)
			.padStart(2, '0')).join('');
}
