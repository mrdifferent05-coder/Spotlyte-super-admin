// index.js — Express + Apollo Server 4 bootstrap.
// GraphQL is served at POST /graphql via expressMiddleware.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/index.js';
import { resolvers } from './resolvers/index.js';
import { buildContext } from './context.js';
import { getDb } from './db.js';

const PORT = Number(process.env.PORT || 4000);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';

async function main() {
  const app = express();
  app.use(cookieParser());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || [WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin) ? origin || true : false),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    // Surface clean UNAUTHENTICATED errors to the client error-link.
    formatError: (err) => ({
      message: err.message,
      extensions: { code: err.extensions?.code || 'INTERNAL_SERVER_ERROR' },
      path: err.path,
    }),
  });
  await server.start();

  app.get('/health', async (_req, res) => {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: buildContext,
    })
  );

  app.listen(PORT, () => {
    console.log(`spotlyte api · GraphQL ready at http://localhost:${PORT}/graphql`);
  });
}

main().catch((e) => {
  console.error('Fatal boot error:', e);
  process.exit(1);
});
