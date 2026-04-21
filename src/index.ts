#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execAsync = promisify(exec);

// Tool schemas
const HelmValsSchema = z.object({
  chart_path: z.string().describe("Path to the Helm chart"),
  values_file: z.string().describe("Path to values file with vals references"),
  release_name: z.string().describe("Name of the Helm release"),
  namespace: z.string().optional().describe("Kubernetes namespace"),
  additional_args: z.string().optional().describe("Additional Helm arguments"),
});

const HelmValidateSchema = z.object({
  chart_path: z.string().describe("Path to the Helm chart to validate"),
  strict: z.boolean().optional().default(false).describe("Enable strict validation"),
  values_file: z.string().optional().describe("Values file to use for validation"),
});

// Server setup
const server = new Server(
  {
    name: "mcp-helm-tools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "helm_vals",
        description:
          "Renders Helm templates with vals support for secret management. Requires vals CLI to be installed.",
        inputSchema: {
          type: "object",
          properties: {
            chart_path: {
              type: "string",
              description: "Path to the Helm chart",
            },
            values_file: {
              type: "string",
              description: "Path to values file with vals references (e.g., ref+vault://...)",
            },
            release_name: {
              type: "string",
              description: "Name of the Helm release",
            },
            namespace: {
              type: "string",
              description: "Kubernetes namespace (optional)",
            },
            additional_args: {
              type: "string",
              description: "Additional Helm template arguments (optional)",
            },
          },
          required: ["chart_path", "values_file", "release_name"],
        },
      },
      {
        name: "helm_validate",
        description:
          "Validates Helm chart structure, templates, and syntax. Performs lint checks and template rendering tests.",
        inputSchema: {
          type: "object",
          properties: {
            chart_path: {
              type: "string",
              description: "Path to the Helm chart to validate",
            },
            strict: {
              type: "boolean",
              description: "Enable strict validation mode",
              default: false,
            },
            values_file: {
              type: "string",
              description: "Values file to use for validation (optional)",
            },
          },
          required: ["chart_path"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "helm_vals") {
      const params = HelmValsSchema.parse(args);
      
      // Build the command with vals eval
      let command = `vals eval -f ${params.values_file} | helm template ${params.release_name} ${params.chart_path}`;
      
      if (params.namespace) {
        command += ` --namespace ${params.namespace}`;
      }
      
      if (params.additional_args) {
        command += ` ${params.additional_args}`;
      }

      const { stdout, stderr } = await execAsync(command);

      return {
        content: [
          {
            type: "text",
            text: stdout || stderr || "Helm template rendered successfully with vals",
          },
        ],
      };
    } else if (name === "helm_validate") {
      const params = HelmValidateSchema.parse(args);
      
      let results = [];

      // Run helm lint
      let lintCommand = `helm lint ${params.chart_path}`;
      if (params.strict) {
        lintCommand += " --strict";
      }
      if (params.values_file) {
        lintCommand += ` --values ${params.values_file}`;
      }

      try {
        const { stdout: lintOut } = await execAsync(lintCommand);
        results.push("=== LINT RESULTS ===");
        results.push(lintOut);
      } catch (error: any) {
        results.push("=== LINT ERRORS ===");
        results.push(error.message);
      }

      // Run helm template (dry-run validation)
      let templateCommand = `helm template test ${params.chart_path}`;
      if (params.values_file) {
        templateCommand += ` --values ${params.values_file}`;
      }
      templateCommand += " --validate";

      try {
        const { stdout: templateOut } = await execAsync(templateCommand);
        results.push("\n=== TEMPLATE VALIDATION ===");
        results.push("✓ Templates are valid and can be rendered");
      } catch (error: any) {
        results.push("\n=== TEMPLATE VALIDATION ERRORS ===");
        results.push(error.message);
      }

      return {
        content: [
          {
            type: "text",
            text: results.join("\n"),
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${JSON.stringify(error.errors)}`);
    }
    throw error;
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Helm Tools server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
