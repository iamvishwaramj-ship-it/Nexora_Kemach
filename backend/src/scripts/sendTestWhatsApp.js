const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { uploadObject, getPresignedUrl } = require('../utils/ociStorage');
const whatsapp = require('../services/whatsappBusiness.service');

const targetPhone = process.argv[2] || '8668117917';

async function main() {
  console.log(`Sending test WhatsApp messages to: ${targetPhone}`);
  console.log('Active templates in config:');
  console.log(' - Quotation:      ', whatsapp.cfg().TEMPLATE_NAME_QUOTATION);
  console.log(' - Invoice:        ', whatsapp.cfg().TEMPLATE_NAME_INVOICE);
  console.log(' - Payment Receipt:', whatsapp.cfg().TEMPLATE_NAME_PAYMENT_RECEIPT);
  console.log(' - Payment Voucher:', whatsapp.cfg().TEMPLATE_NAME_PAYMENT_VOUCHER);
  console.log('');

  // Minimal valid 1-page sample PDF
  const samplePdf = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
    'xref\n' +
    '0 4\n' +
    '0000000000 65535 f\n' +
    '0000000010 00000 n\n' +
    '0000000060 00000 n\n' +
    '0000000118 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\n' +
    'startxref\n' +
    '198\n' +
    '%%EOF'
  );

  const key = `whatsapp/sample-test/${Date.now()}.pdf`;
  console.log('Uploading sample document to OCI Object Storage...');
  await uploadObject(key, samplePdf, 'application/pdf');
  const documentUrl = await getPresignedUrl(key, 3600);
  console.log('Presigned document URL ready.\n');

  const messages = [
    {
      label: '1. Sales Quotation',
      templateName: whatsapp.cfg().TEMPLATE_NAME_QUOTATION,
      documentFilename: 'Sales_Quotation_SQ-26-0001.pdf',
      bodyParams: [
        'Blesswin (Kemach)',
        'SQ-26-27-000001',
        '23-09-2026',
        '1,25,000.00'
      ]
    },
    {
      label: '2. Sales Invoice',
      templateName: whatsapp.cfg().TEMPLATE_NAME_INVOICE,
      documentFilename: 'Sales_Invoice_KLIN-26-0001.pdf',
      bodyParams: [
        'Blesswin (Kemach)',
        'KLIN/262701737',
        '23-09-2026',
        '36,80,000.00'
      ]
    },
    {
      label: '3. Payment Receipt (Incoming Payment)',
      templateName: whatsapp.cfg().TEMPLATE_NAME_PAYMENT_RECEIPT,
      documentFilename: 'Payment_Receipt_PR-26-0001.pdf',
      bodyParams: [
        'Blesswin (Kemach)',
        'PR-26-27-000001',
        '23-09-2026',
        '50,000.00',
        'NEFT-REF123456'
      ]
    },
    {
      label: '4. Payment Voucher (Outgoing Payment)',
      templateName: whatsapp.cfg().TEMPLATE_NAME_PAYMENT_VOUCHER,
      documentFilename: 'Payment_Voucher_PV-26-0001.pdf',
      bodyParams: [
        'Doosan Bobcat India Pvt Ltd',
        'PV-26-27-000001',
        '23-09-2026',
        '75,000.00',
        'CHQ-789012'
      ]
    }
  ];

  for (const m of messages) {
    console.log(`Sending ${m.label} via template [${m.templateName}]...`);
    try {
      const res = await whatsapp.sendDocumentTemplate({
        to: targetPhone,
        templateName: m.templateName,
        documentUrl,
        documentFilename: m.documentFilename,
        bodyParams: m.bodyParams,
      });
      const messageId = res.messages?.[0]?.id || JSON.stringify(res);
      console.log(`  ✓ SUCCESS: Message ID = ${messageId}`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`, err.providerResponse || '');
    }
  }

  console.log('\nAll done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
