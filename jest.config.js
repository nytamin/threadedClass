module.exports = {
	globals: {
		'ts-jest': {
			tsConfig: 'tsconfig.jest.json',
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
			statements: 81,
			branches: 74,
			functions: 82,
			lines: 83,
		}
	},
	coverageDirectory: "./coverage/",
	collectCoverage: true
}
