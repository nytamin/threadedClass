module.exports = {
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.json',
			diagnostics: {
				ignoreCodes: ['TS2571']
			}
		}
	},
	moduleFileExtensions: [
		'ts',
		'js'
	],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest'
	},
	testMatch: [
		'**/__tests__/**/*.spec.(ts|js)'
	],
	testPathIgnorePatterns: [
		'integrationTests'
	],
	coveragePathIgnorePatterns: [
        "src/webWorkers.ts"
    ],
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			statements: 76,
			branches: 67,
			functions: 76,
			lines: 76,
		}
	},
	coverageDirectory: "./coverage/",
	collectCoverageFrom: [
		"**/src/**/*.{ts,js}",
		"!**/src/**/*.d.ts",
		"!**/node_modules/**",
		"!**/__tests__/**",
		"!**/__mocks__/**",
		"!**/dist/**"
	],
	collectCoverage: true
}
