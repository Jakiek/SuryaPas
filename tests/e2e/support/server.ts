// Where the end-to-end test servers listen. The dev server stays on 3100 for
// everything else; the tests use a production build on their own ports, so a
// dev server left running never answers a test by mistake.

/** The production build with the in-memory store: the server almost every test talks to. */
export const PORT = Number(process.env.E2E_PORT ?? 3400);
export const BASE_URL = `http://localhost:${PORT}`;

/** The same build with a database that answers every call with an error: the "saving fails" case (SPEC 2.5). */
export const STORE_DOWN_PORT = PORT + 1;
export const STORE_DOWN_URL = `http://localhost:${STORE_DOWN_PORT}`;
