const { defaults: tsjPreset } = require('ts-jest/presets');
module.exports = {
	preset: 'ts-jest',
	rootDir: './',
	transform: {
		...tsjPreset.transform,
	},
	testRegex: '(/test/.*\\.(test|spec))\\.[tj]sx?$',
	passWithNoTests: true,
	moduleFileExtensions: [
		"ts",
		"tsx",
		"js",
		"jsx",
	],
	moduleNameMapper: {
		'^@APP/(.*)$': '<rootDir>/src/douban/$1',
	},
	collectCoverageFrom: [
		"**/baseTs/upperFirst.ts",
		"**/baseTs/camelCase.ts",
		"!**/node_modules/**",
		"!**/vendor/**",
	],
};
