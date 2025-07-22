const { rest } = require('msw');

module.exports.handlers = [
  // Documents
  rest.get('/api/documents', (req, res, ctx) => res(ctx.status(200), ctx.json([]))),
  rest.get('/api/documents/:id', (req, res, ctx) => res(ctx.status(200), ctx.json({ id: req.params.id, name: 'Mock Doc', category: 'General', content: 'Hello' }))),
  rest.post('/api/documents', (req, res, ctx) => res(ctx.status(201), ctx.json({ ...req.body, id: 123 }))),
  rest.delete('/api/documents/:id', (req, res, ctx) => res(ctx.status(204))),
  rest.get('/api/documents/categories', (req, res, ctx) => res(ctx.status(200), ctx.json(['General', 'Work']))),
  rest.post('/api/documents/categories', (req, res, ctx) => res(ctx.status(201), ctx.json(['General', req.body.category]))),
  rest.delete('/api/documents/categories/:name', (req, res, ctx) => res(ctx.status(204))),
  rest.post('/api/documents/current', (req, res, ctx) => res(ctx.status(200), ctx.json({ doc_id: req.body.doc_id }))),
  rest.get('/api/documents/current', (req, res, ctx) => res(ctx.status(200), ctx.json({ doc_id: 123 }))),
  rest.post('/api/pdf/export', (req, res, ctx) => res(ctx.status(200), ctx.body('PDF_BINARY'))),

  // Recovery
  rest.get('/api/recovery/list/:userId', (req, res, ctx) => res(ctx.status(200), ctx.json([]))),
  rest.post('/api/recovery/save', (req, res, ctx) => res(ctx.status(201), ctx.json({ success: true }))),
  rest.post('/api/recovery/resolve/:docId', (req, res, ctx) => res(ctx.status(200), ctx.json({ resolved: true }))),

  // Highlighting
  rest.post('/api/highlight/syntax', (req, res, ctx) => res(ctx.status(200), ctx.json({ highlighted: true }))),
  rest.get('/api/highlight/languages', (req, res, ctx) => res(ctx.status(200), ctx.json(['javascript', 'python']))),
  rest.get('/api/highlight/languages/:language/check', (req, res, ctx) => res(ctx.status(200), ctx.json({ available: true }))),

  // User/Auth
  rest.post('/api/auth/login', (req, res, ctx) => res(ctx.status(200), ctx.json({ token: 'mock-token' }))),
  rest.post('/api/auth/register', (req, res, ctx) => res(ctx.status(201), ctx.json({ token: 'mock-token' }))),
  rest.post('/api/auth/password-reset-verify', (req, res, ctx) => res(ctx.status(200), ctx.json({ verified: true }))),
  rest.get('/api/auth/me', (req, res, ctx) => res(ctx.status(200), ctx.json({ id: 1, display_name: 'Mock User', email: 'mock@example.com' }))),
  rest.get('/api/auth/user', (req, res, ctx) => res(ctx.status(200), ctx.json({ id: 1, display_name: 'Mock User', email: 'mock@example.com' }))),
];
