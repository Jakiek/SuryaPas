# Calculation engine

Pure TypeScript. The rule (SPEC 5):

- Nothing here imports from outside `src/engine/`, and nothing here imports a package.
  `npm run lint` fails if it does. (Test files may import `vitest`, nothing else.)
- No I/O, no clock, no randomness. Same input, same output, in the browser and on the server.
- Sun data, assumptions and user inputs all arrive as function arguments.
- Every price, rate and factor comes from the assumption set passed in, never a literal.

The method itself is written up in the project README (T18).
