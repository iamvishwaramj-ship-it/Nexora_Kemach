// ---------------------------------------------------------------------------
// WhatsApp Business API (Meta Cloud API) send, proxied through the org's own
// gateway at WHATSAPP_API_BASE_URL (see the curl the user supplied — token
// as a query param, not an Authorization header, same request body shape
// Meta's own Cloud API uses for a template message with a document header).
//
// Config is read live from process.env on every call, not destructured once
// at module load — see ociStorage.js/taxproGsp.service.js for why: a
// snapshot taken at require() time reads undefined for every key whenever
// this module loads before dotenv has run (any entry point that isn't
// server.js -> app.js), which then fails with a confusing error deep inside
// the HTTP call instead of the clear "not configured" assertConfigured()
// gives.
// ---------------------------------------------------------------------------
function resolveTemplateName(envVar, fallback, legacyInvalidNames = []) {
  const val = (process.env[envVar] || '').trim();
  if (!val) return fallback;
  if (legacyInvalidNames.some((invalid) => invalid.toLowerCase() === val.toLowerCase())) {
    return fallback;
  }
  return val;
}

const cfg = () => ({
  BASE_URL: process.env.WHATSAPP_API_BASE_URL || 'https://backend.techconzs.com/v1/message/send-message',
  TOKEN: process.env.WHATSAPP_API_TOKEN,
  API_NO: process.env.WHATSAPP_API_NO || '919940005487',
  PROFILE_URL: process.env.WHATSAPP_PROFILE_URL || 'https://whatsapp.techconzs.com/profile',
  LANGUAGE_CODE: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
  // Per-document template names, each approved separately in Meta Cloud
  // API -- Sales Invoice uses its own dedicated template
  // ('kemach_sales_invoice_template'), distinct from Sales Quotation's
  // ('kemach_bill').
  // If an unapproved/legacy template name like 'Kemach_Invoice' exists in
  // Azure App Settings, it is safely normalized to 'kemach_sales_invoice_template'.
  TEMPLATE_NAME_QUOTATION: resolveTemplateName('WHATSAPP_TEMPLATE_NAME_QUOTATION', 'kemach_sales_quo', ['Kemach_Quotation', 'kemach_quotation', 'kemach_bill']),
  TEMPLATE_NAME_INVOICE: resolveTemplateName('WHATSAPP_TEMPLATE_NAME_INVOICE', 'kemach_sales_invoice_template', ['Kemach_Invoice', 'kemach_invoice', 'kemach_bill']),
  // Payment Receipt (Incoming Payment) / Payment Voucher (Outgoing
  // Payment) -- their own approved templates, distinct from the sales
  // documents above.
  TEMPLATE_NAME_PAYMENT_RECEIPT: resolveTemplateName('WHATSAPP_TEMPLATE_NAME_PAYMENT_RECEIPT', 'kemach_incoming_payments'),
  TEMPLATE_NAME_PAYMENT_VOUCHER: resolveTemplateName('WHATSAPP_TEMPLATE_NAME_PAYMENT_VOUCHER', 'kemach_outgoing_payments'),
});


function assertConfigured() {
  const missing = ['WHATSAPP_API_TOKEN'].filter((k) => !process.env[k]);
  if (missing.length) {
    const err = new Error(`WhatsApp Business API is not configured (missing: ${missing.join(', ')}).`);
    err.status = 500;
    throw err;
  }
}

// Same India-only heuristic as the frontend's WhatsAppShareButton.jsx
// (toWhatsAppNumber) — this deployment is single-country, so a bare
// 10-digit number is assumed Indian and gets +91 prefixed; a number that
// already carries a country code (11+ digits) is left as-is; an 11-digit
// number starting with a leading 0 (a local-dialing habit some contact
// records were saved with) has that 0 dropped first.
function toWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * Sends a pre-approved WhatsApp template message with a document header
 * (the printable PDF, referenced as a link the provider's servers fetch
 * themselves — never uploaded inline) plus ordered body text parameters.
 *
 * @param {object} opts
 * @param {string} opts.to - customer's number, any format (normalized here).
 * @param {string} opts.templateName - the approved template's exact name.
 * @param {string} [opts.languageCode] - defaults to WHATSAPP_TEMPLATE_LANG / 'en'.
 * @param {string} opts.documentUrl - URL the provider can fetch the PDF from
 *   (e.g. an OCI pre-signed GET URL — see ociStorage.js's getPresignedUrl).
 * @param {string} [opts.documentFilename] - filename shown to the customer.
 * @param {string[]} [opts.bodyParams] - ordered {{1}}, {{2}}, ... body values.
 */
async function sendDocumentTemplate({ to, templateName, languageCode, documentUrl, documentFilename, bodyParams = [] }) {
  assertConfigured();
  const c = cfg();

  const waNumber = toWhatsAppNumber(to);
  if (!waNumber) {
    const err = new Error('WhatsApp send: no valid customer number to send to.');
    err.status = 400;
    throw err;
  }
  if (!templateName) {
    const err = new Error('WhatsApp send: no template name configured (set WHATSAPP_TEMPLATE_NAME_QUOTATION / WHATSAPP_TEMPLATE_NAME_INVOICE / WHATSAPP_TEMPLATE_NAME_PAYMENT_RECEIPT / WHATSAPP_TEMPLATE_NAME_PAYMENT_VOUCHER in .env).');
    err.status = 500;
    throw err;
  }
  if (!documentUrl) {
    const err = new Error('WhatsApp send: no document URL to attach.');
    err.status = 400;
    throw err;
  }

  const components = [
    {
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: { link: documentUrl, filename: documentFilename || 'document.pdf' },
        },
      ],
    },
  ];
  if (bodyParams.length) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({
        type: 'text',
        text: String(text ?? '').trim() || '-',
      })),
    });
  }

  const queryParams = [`token=${encodeURIComponent(c.TOKEN)}`];
  if (c.API_NO) queryParams.push(`from=${encodeURIComponent(c.API_NO)}`);
  const url = `${c.BASE_URL}?${queryParams.join('&')}`;

  const requestBody = {
    to: waNumber,
    type: 'template',
    template: {
      language: { policy: 'deterministic', code: languageCode || c.LANGUAGE_CODE },
      name: templateName,
      components,
    },
  };
  if (c.API_NO) {
    requestBody.from = c.API_NO;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    const err = new Error(`Could not reach the WhatsApp API: ${networkErr.message}`);
    err.status = 502;
    throw err;
  }

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    const err = new Error(`WhatsApp send failed (${res.status}): ${detail}`);
    err.status = 502;
    err.providerResponse = data;
    throw err;
  }
  return data;
}

module.exports = {
  sendDocumentTemplate,
  toWhatsAppNumber,
  cfg,
};
