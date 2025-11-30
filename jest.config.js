module.exports = {
  moduleFileExtensions: [
    "js",
    "json",
    "ts"
  ],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: [
    "**/*.(t|j)s"
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/src/main.ts",
    "/src/app.module.ts",
    "/src/database/",
    ".module.ts"
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
