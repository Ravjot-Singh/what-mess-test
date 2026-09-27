/**
 * Vercel serverless entry point.
 *
 * Vercel invokes an exported handler per request rather than running a long-lived
 * process, so it cannot use `node server.js` directly. server.js therefore only
 * calls listen() when run as the main module, and exports the Express app for
 * this file to hand to Vercel.
 *
 * vercel.json rewrites every path here, so Express serves both the static pages
 * and the API routes exactly as it does locally.
 */

module.exports = require('../server.js');
