# MCP Test Library Development

This file contains instructions for developing and contributing to the MCP Test Library.

## Development Setup

1. Clone the repository
```bash
git clone https://github.com/your-org/mcp-test.git
cd mcp-test
```

2. Install dependencies
```bash
npm install
```

3. Build the library
```bash
npm run build
```

## Development Workflow

### Building

To build the library:

```bash
npm run build
```

This will generate the distribution files in the `dist` directory.

### Testing

To run tests:

```bash
npm test
```

### Linting

To lint the code:

```bash
npm run lint
```

## Project Structure

```
mcp-test/
├── src/                  # Source code
│   ├── core/             # Core functionality
│   │   ├── client.ts     # MCPTestClient
│   │   ├── server.ts     # MCPServerManager
│   │   └── types.ts      # Type definitions
│   ├── utils/            # Utility functions
│   │   ├── async.ts      # Async helpers
│   │   ├── fixtures.ts   # Test fixtures
│   │   └── validators.ts # Response validators
│   ├── adapters/         # Adapters for different environments
│   │   └── transport/    # Transport adapters
│   │       └── http.ts   # HTTP adapter
│   └── index.ts          # Main entry point
├── test/                 # Tests
├── docs/                 # Documentation
├── examples/             # Example usage
├── dist/                 # Built distribution files
├── tsconfig.json         # TypeScript configuration
├── tsup.config.ts        # Build configuration
└── package.json          # Package metadata
```

## Publishing

To publish a new version:

1. Update the version in `package.json`
2. Update the `CHANGELOG.md` file
3. Commit the changes
4. Create a git tag for the version
5. Push the changes and tag
6. Run `npm publish`

## Versioning

This project follows [Semantic Versioning](https://semver.org/).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
