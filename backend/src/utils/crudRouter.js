const router = require('express').Router;
const auth = require('../middleware/auth');
const createCrudController = require('./crudFactory');
const { runValidators } = require('./formatValidators');

/**
 * Generic CRUD router built on top of createCrudController. Mounts:
 *   GET    /            list (supports ?q= search and ?page=/?limit= paging)
 *   GET    /:id         get one
 *   POST   /            create
 *   PUT    /:id         update
 *   DELETE /:id         delete
 *
 * Every route requires a valid JWT. Deletes additionally require the admin
 * role: previously any authenticated user could remove any master record or
 * transaction, which for an ERP is an unacceptable control gap — the
 * middleware supported roles from the start and nothing ever used them.
 *
 * @param {object} options
 *   deleteRoles: string[] — roles allowed to delete (default: admin only)
 *   writeRoles:  string[] — roles allowed to create/update (default: any user)
 *   guard: {
 *     beforeDelete: async (id, req) => void — throw to block the delete
 *     beforeUpdate: async (id, req) => void
 *     afterUpdate:  async (id, req, previous) => void
 *   }
 *   formatRules: Array<ValidationChain> | (() => Array<ValidationChain>) —
 *     express-validator chains (see utils/formatValidators.js's field
 *     builders) run against POST / and PUT /:id ONLY, before create/update —
 *     never against list/get/delete. On a failed check, the request is
 *     rejected with 400 before the create/update handler ever runs, in the
 *     same { success:false, message, errors:[{field,message}] } shape
 *     routes/company.js's badRequest() already produces (see
 *     formatValidators.js's runValidators doc). Omit to leave a resource's
 *     create/update behaving exactly as before — this is additive only.
 */
function crudRouter(delegate, options = {}) {
  const {
    deleteRoles = ['admin'],
    writeRoles = [],
    guard = {},
    autoNumber = null,
    formatRules = null,
    ...controllerOptions
  } = options;

  const { list, getOne, create, update, remove, invalidateListCache } = createCrudController(delegate, {
    ...controllerOptions,
    guard,
    autoNumber,
  });

  const r = router();
  r.use(auth());
  r.get('/', list);
  r.get('/:id', getOne);

  const writeMiddleware = formatRules ? [auth(writeRoles), runValidators(formatRules)] : [auth(writeRoles)];
  r.post('/', ...writeMiddleware, create);
  r.put('/:id', ...writeMiddleware, update);

  r.delete('/:id', auth(deleteRoles), remove);

  // Routers are plain functions in Express, so hanging a property off `r`
  // is safe — every existing `router.use('/x', crudRouter(...))` call site
  // keeps working unchanged. See the doc comment on invalidateListCache in
  // crudFactory.js for who this is for and why it exists.
  r.invalidateCache = invalidateListCache;
  return r;
}

module.exports = crudRouter;
