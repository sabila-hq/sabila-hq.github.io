import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import http from 'http';

const API_URL = 'http://127.0.0.1:31337/api/execute';

async function sendRequest(toolName: string, params: any) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ tool: toolName, params });
    const req = http.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const server = new Server({
  name: 'Sabila-MCP',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'start_service',
        description: 'Start a Sabila service (e.g. nginx, php, mysql)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Service ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'stop_service',
        description: 'Stop a Sabila service',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Service ID' }
          },
          required: ['id']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result: any = await sendRequest(request.params.name, request.params.arguments);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
