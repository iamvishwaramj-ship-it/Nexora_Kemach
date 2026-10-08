const test = require('node:test');
const assert = require('node:assert/strict');
const taxpro = require('../services/taxproGsp.service');

test('taxproGsp service exports expected API', () => {
  assert.equal(typeof taxpro.generateEInvoice, 'function');
  assert.equal(typeof taxpro.cancelEInvoice, 'function');
  assert.equal(typeof taxpro.generateEWayBill, 'function');
  assert.equal(typeof taxpro.cancelEWayBill, 'function');
  assert.equal(typeof taxpro.testConnection, 'function');
});
