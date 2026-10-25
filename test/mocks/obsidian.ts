export const moment = {
	locale: () => 'en',
};

export const requestUrl = jest.fn();

export function normalizePath(path: string): string {
	return String(path ?? '')
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/')
		.replace(/\/$/, '');
}

export class App {}
export class TFile {}
