// Wraps an async route handler so rejected promises are forwarded to errorHandler
// instead of crashing the process or requiring try/catch in every controller.
//
// The promise is returned rather than discarded. Express ignores a middleware's
// return value, so this changes nothing at runtime, but it means a test can
// await a handler and know when it has finished. Without it every assertion
// about what a route wrote raced the route itself and read an empty result.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
