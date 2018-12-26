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
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			statements: 90,
			branches: 82,
			functions: 93,
			lines: 92,
		}
	},
	coverageDirectory: "./coverage/",
	collectCoverage: true
}
