// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { buildServer } from './server.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = buildServer();

server.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error('Error arrancando Wordsmith Server:', err);
    process.exit(1);
  }
  console.log(`🚀 Wordsmith Backend Orchestrator activo en ${address}`);
});
