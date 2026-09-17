export const specification = {
  openapi: '3.1.0', info: { title: 'Parking sample (test fixture)', version: '1.0', description: 'Read parking availability. This is a fictional test API.' },
  security: [{ ApiKey: [] }],
  paths: {
    '/parking': {
      parameters: [{ name: 'city', in: 'query', required: false }],
      get: { summary: 'Find parking availability', description: 'Returns available spaces for the selected city.', tags: ['Availability'],
        parameters: [{ name: 'city', in: 'query', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Parking locations', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Parking' } } } } } } },
    },
    '/parking/{id}': { get: { summary: 'Read a parking location', security: [], parameters: [{ in: 'path', name: 'id', schema: { type: 'string' } }], responses: { 200: { description: 'Location', content: { 'application/json': { schema: { $ref: '#/components/schemas/Parking' } } } } } } },
    '/reservation': { post: { summary: 'Request a reservation', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['location'], properties: { location: { type: 'string' } } } } } }, responses: { 202: { description: 'Request accepted; reservation not guaranteed.' } } } },
  },
  components: { schemas: { Parking: { type: 'object', required: ['available'], properties: { available: { type: 'integer', description: 'Unoccupied spaces' }, city: { type: 'string' } } } }, securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } },
};
export const source = (doc = specification) => ({ text: typeof doc === 'string' ? doc : JSON.stringify(doc), url: 'https://docs.example.com/openapi.json', fetchedAt: '2026-09-12T00:00:00.000Z', contentType: 'application/json' });
export const apiDirectory = {
  'sample.org:parking': { preferred: '1', versions: { 1: { info: { title: 'Parking API', description: 'Parking availability in cities', 'x-providerName': 'sample.org' }, swaggerUrl: 'https://docs.example.com/parking.json' }, 0: { info: { title: 'Old API' } } } },
  'sample.org:weather': { preferred: '2', versions: { 2: { info: { title: 'Weather API', description: 'Weather forecasts' }, swaggerUrl: 'https://docs.example.com/weather.json' } } },
};
export const mcpDirectory = { servers: [
  { server: { name: 'org.example/parking', description: 'Parking locations', version: '1', packages: [{ transport: { type: 'stdio' } }], repository: { url: 'https://github.com/example/parking' } }, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active' } } },
  { server: { name: 'org.example/deleted', version: '1' }, _meta: { 'io.modelcontextprotocol.registry/official': { status: 'deleted' } } },
], metadata: { nextCursor: 'org.example/parking:1' } };
