module.exports = {
	globals: {
		'ts-jest': {
			tsConfigFile: 'tsconfig.jest.json'
		}
	},
	moduleFileExtensions: [
		'ts',
		'js'
	],
	transform: {
		'^.+\\.(ts|tsx)$': './node_modules/ts-jest/preprocessor.js'
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
			statements: 88,
			branches: 78,
			functions: 90,
			lines: 88,
		}
	},
	coverageDirectory: "./coverage/",
	collectCoverage: true
}
