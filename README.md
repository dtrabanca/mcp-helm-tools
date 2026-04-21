# MCP Helm Tools

MCP (Model Context Protocol) server for Helm with integrated tools for vals and validate operations.

## Features

- **Vals Integration**: Securely reference secrets from various backends (Vault, AWS Secrets Manager, GCP Secret Manager, etc.)
- **Helm Validation**: Validate Helm charts and templates before deployment

## Tools Available

### 1. `helm_vals`
Renders Helm templates with vals support for secret management.

**Parameters:**
- `chart_path`: Path to the Helm chart
- `values_file`: Path to values file (with vals references)
- `release_name`: Name of the release
- `namespace`: Kubernetes namespace (optional)

### 2. `helm_validate`
Validates Helm chart structure and templates.

**Parameters:**
- `chart_path`: Path to the Helm chart to validate
- `strict`: Enable strict validation (optional, default: false)

## Installation

```bash
npm install
```

## Configuration

Add to your MCP settings file:

```json
{
  "mcpServers": {
    "helm-tools": {
      "command": "node",
      "args": ["path/to/mcp-helm-tools/build/index.js"]
    }
  }
}
```

## Requirements

- Node.js >= 18
- Helm 3.x installed
- vals installed (for secret management features)

## Usage

The server exposes Helm operations through MCP tools that can be called by any MCP client.

## License

MIT
