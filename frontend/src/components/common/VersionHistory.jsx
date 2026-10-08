import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button,
  Stack, Box, Typography, Chip, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';

/**
 * Version History — hand-maintained changelog shown in a popup.
 *
 * This is deliberately a plain hardcoded array, NOT pulled from git log, a
 * CHANGELOG file, or an API: whoever ships a version edits VERSION_HISTORY
 * below by hand, same as the version number itself in
 * ../../config/versionHandle.js. Keep the two in sync — the newest entry
 * here should match VERSION_LABEL_NAME.
 *
 * Add a new release by adding ONE object to the top of this array (newest
 * first — the list is rendered in the order given, no sorting):
 *   {
 *     version: 'v1.0.0.0.5',
 *     title: 'Short heading for this release',
 *     description: 'What changed, in plain language. Can be a few sentences.',
 *   }
 *
 * Nothing else needs to change — Sidebar.jsx just renders whatever is here.
 */
export const VERSION_HISTORY = [
  {
    version: 'v1.0.0.2.4',
    title: 'Business Partner - 06-10-2026',
    description: `
    1. Fixed the Document Numbering Saving bug and issue
    2. Additionally Included the Branch Field on Reports -> Inventory Reports -> Available Balance
    3. Fixed the Opening Balance Deleting and updating issue
    
     `,
  },
  {
    version: 'v1.0.0.2.3',
    title: 'Sales, Document Numbering, Inventory, Purchase - 05-10-2026',
    description: `
    1. Fixed the Sales Invoice Maching Number Select input field to input field
    2. Purchase GRN Machine Name, No, Engine No
    3. Document Numbering Duplication Restriction removed
    4. Sales Return Internal Server Issue fixed
    5. Inventory -> Stock Transfer request -> Branch Transfer -> (Warehouse Removed) & fixed the DLP Price fetching issue
    6. Inventory -> Stock Transfer Issue -> Branch Transfer -> (Issue Warehouse Included)
    7. Inventory -> Stock Transfer Receipt -> Branch Transfer -> (Receive Warehouse Included and removed the to warehouse)
    8. Sales -> Tax Bug Fixed
    9. Reports Page Excel -> Should show fully colon search
    10. Removed the Eye Icon on the "Available Balance" and included on the "Stock Summary"
    11. Included the All Sales invoice document : Original (Finance Copy), Customer Copy, Duplicate
    12. Fixed Inventory -> Stock Receipt(Warehouse text not showing bug)
     `,
  },
  {
    version: 'v1.0.0.2.2',
    title: 'Business Partner - 03-10-2026',
    description: `
    1. Fixed the Business Partner Account Balance showing issue
    2. Added the Notification comes from which user and on which branch it is generated
    3. E-Way Bill is added on the stock transfer issue
    4. Stock transfer bug is partially solved and waiting for the working Flow
    5. Business partner "Account Balance" Negative value bug fixed
     `,
  },
  {
    version: 'v1.0.0.2.1',
    title: 'Reports - 01-10-2026',
    description: `
    1. Fixed the Sales & purchase documents Delete bug 
    2. Include the cancel permission the user management page
     `,
  },
  {
    version: 'v1.0.0.2.0',
    title: 'Reports - 30-09-2026',
    description: `
    1. Fixed the Report -> Receivables -> Collection Register and -> Payables -> Payment Register Integrated with the reports
    2. Fixed the Journel Entry Bug on the Debit & Credit that is not properly working vise versa
    3. Hided the Summary Strip and Column Headers on the Reports -> Purchase Invoice Register
    4. Fixed the Sales Credit Memo Copy to Issue
    5. Fixed the Notification Issue and include the permission on the User Management Permission checkbox 
        if the user have the both access on the user -> Permission -> Notification access and branch access it will works
     `,
  },
  {
    version: 'v1.0.0.1.9',
    title: 'Reports, Dashboard, Purchase, Sales - 28-09-2026',
    description: `
    1. Fixed the Tax Report -> Input Tax & Output Tax
    2. Fixed the Dashboard Calculation "Total Inventory Value"
    3. Fixed the Permission Enquiry & Follow Up Showing Issue
    4. Fixed the Cancel Feature on the Purchase Documents applied with reversed journel entry
    5. Additionally Include the Cancel Feature on the Sales Documents applied with reversed journel entry
    6. The Delete Permission is Configurated for the Purchase, sales, inventory, Payment receipt, payment voucher
    7. Reports -> Inventory Reports -> Available Balance --(Committed qty, available to sell, reorder level) 
       removed and on unit cost price fetched from clp price on the price list
    8. Fixed the DLP Pricing showing issue on the mobile view
    9. Business Partner -> Address tab included the PAN Number
    10. Additionally Included the Bill to and ship select input field for the sales and purchase documents
    11. Signature On the Sales and Purchase document fixed for the Authorized Signatory will hide if sales type is machine and make increase size of the sign logo
    12. Inventory and BP Opening Balance Completed
     `,
  },
  {
    version: 'v1.0.0.1.8',
    title: 'Business Partner, purchase, sales - 25-09-2026',
    description: `
    1. Fixed the Batch & Serial Number Allocation Issue Solved on the Purchase GRN, 
       Stock Recipt, issue, Delivery Challan
    2. Fixed on the Business Partner the Account Balance showing issue
    3. Additionally Added the Batch / Serial field on the Purchase and sales invoice
    4. BP Openeing Balance removed Branch field both on the template and entry screen
    5. Included the Default Tax based on the state GST or IGST 18%
    6. Fixed the Dashboard Total payable and total receivable mismatch issue
    7. Fixed the Business Partner the popup open when the eye icon is pressed
    8. Added Input, Output and Payable Tax Reports
    9. Hided product sub-group, barcode, customer discount pages
    10. Fixed Reports fully
     `,
  },
  {
    version: 'v1.0.0.1.7',
    title: 'Business Partner, purchase, sales - 24-09-2026',
    description: `
    1. Fixed the Product Master Manual Entry bug 
    2. Sales document for the Sales Type * the claims logic is applied for the service
    3. Batch & Serial Number Allocation Issue Solved
     `,
  },
  {
    version: 'v1.0.0.1.6',
    title: 'Purchase, Sales, Product Master - 23-09-2026',
    description: `
    1. Fixed the Business Partner update and validation issue while editing the "B.BILESH S/O BHASKARAN.PM" customer
    2. Whatsapp integration completed
    3. Purchase -> Complete Purchase document the cancel feature included
    4. Stock Transfer -> All 3 sub menus tax and field alignment worked
    5. User Management -> Restricted screen access bug fixed

     `,
  },
  {
    version: 'v1.0.0.1.5',
    title: 'Company Setup, purchase, sales - 22-09-2026',
    description: `
    1. Fixed the Document Number Adding Series issue
    2. Reports -> Inventory Report -> Stock Valuation, Low Stock Report, Slow Moving Report Completed
    3. Sales -> Sales Invoice -> E-Invoice / E-Way Bill Included
    4. Sales -> Whatsapp Send Integration going on
     `,
  },
  {
    version: 'v1.0.0.1.4',
    title: 'Purchase, Sales, Banking - 21-09-2026',
    description: `
    1. Fixed Printing Pdf template one the Purchase order, return, grn
    2. On the Sales quotation included the supplier code near the supplier name
    3. On the banking menu inside the submenu (Payment Voucher and Recipt) the currency and Exchange rate fixed
    4. Vendor and Customer Reference No is added on the purchase and sales documents
    5. Sales, Purchase, Inventory -> Approved By and Prepared By Configured
    6. Validated the Printables on the Sales
    7. Included the Type of DC on the Delivery Challan
    8. For the Delivery Challan included the BOB Link No.
    9. Added the Missing fields on the Sales & Purchase Pritables and Print
    10. Reports -> Inventory Reports -> Stock Valuation report included
    11. User Management when the role is staff on the Select Option included the "All Branch"
    12. on stock receipt included the type field, receipt date and receipt qty included
    13. Fixed the stock valuation table headers and warehouse
     `,
  },
  {
    version: 'v1.0.0.1.3',
    title: 'Customer Ledger, User, Bp Opening balance',
    description: `
    1. Fixed calcuation bug and loading bugs
     `,
  },
  {
    version: 'v1.0.0.1.2',
    title: 'Company Setup',
    description: `
    1. Fixed the Excel Import Issues
    2. Solved the printable TCS issues, some cfl issues
    3. Optimized and Boosted the Performance on all Menus
    4. Removed the Purchase Quotation menu from the Purchase Menu
    5. For purchase menu the Billing Type field is hided
    6. Added CFL for the Purchase Type Select field
    7. Added the State fields for puchase menu that will be fetched based on the supplier code
    8. Implemented the Tax Code fetching logic based on the state on the purchase
    9. for the purchase grn and invoice when the purchase type is maching then additional fields will be visible
     `,
  },
  {
    version: 'v1.0.0.1.1',
    title: 'Purchase, Sales',
    description: `
    1. On the Sales quotation make a proper alignment 
    2. on the purchase and sales alignment and changes uniform
    3. User Password Field worked
    4. Included the Reports -> Tax Report Screen 
    5. Included Road Tax Checkbox on the Sales
    6. Worked on the Machineries field on the Business partner
    7. Removed the Autogenerated 
    8. For the Product Master on the Document Numbering included the manual entry or Auto Generation feature 
     `,
  },
  {
    version: 'v1.0.0.1.0',
    title: 'Product Setup, Banking,',
    description: `
    1. Moved and Renamed from Inventory -> Opneing Balance to Company Setup -> Inventory Opening Balance
    2. Included the Submenu BP Opening Balance on the Company Setup
     `,
  },
  {
    version: 'v1.0.0.0.9',
    title: 'Product Setup, Banking,',
    description: `
    1. Product Setup - Product Master - Included the Validation on Status field
    2. Reports -> Sales -> Customer Ledger - Included
    3. Reports -> Sales -> Customer Ageing - Included
    4. Deposit Entry -> Removed (Received From) select Field
    5. Sales Quotation -> Included Road Tax (8.2%)
    6. Reports -> Enquiry Register, Enquiry Analysis Hided
    7. Smart Add -> in all sales document
    8. Fixed purchase and sales printables issue
    9. Removed the discount text field and validated discount througt item details discount fields
    10. Included the Frieght charges in sales and linked with transport master
    11. Fixed the Business Partner -> Machineries selection on the Sales Quotation menu
    12. Solved the purchase document copy to issues
     `,
  },
  {
    version: 'v1.0.0.0.8',
    title: 'Purchase and Sales',
    description: `
    1. Employee Master -- (Splitted to 2 Cards,Included fields like Pay Mode, Bank Details, Permanent Address).
    2. Applied Payment Receipt - Payment Modes on the Payment Voucher - Payment Modes.
    3. On the Stock Transfer Menu included the Tax Calculation and Tax fields.
    4. Reports Menu included the sub menu tax reports.
    5. Notification Feature for the Stock Transfer Request implemented
    6. Included the Import Excel and Download Template for the Employee Master(Excel Upload).[After Noon]
    7. Removed the Reporting Manager on the Employee Master
    8. Included Additional Fields on the User Management Page for the User Menu
    9. Right Alignment of the Amount Column of the Item Details table
    10. Added Machineries field on the Business Partner and loaded on the Sales Menu
    11. Updated the Openeing Balance and the New Item Creation Page for the Stock Field
     `,
  },
  {
    version: 'v1.0.0.0.7',
    title: 'Purchase and Sales',
    description: `
    1. Signature Uploading in Employee Master
    2. Approval Authorizations in Employee Master
    3. Prepared By
    4. Approved By
    5. Some Printable Issues
    6. GRN Issues
    7. Some Alignment Issues in UI
    8. Added Schema Validation
    9. Customer Reference Number
    10. Vendor Reference Number
    11. Signature Automation in Printables
    12. Price List Added
    13. stock transfer completed
    14. sales invoice save bug fixed
     `,
  },
  {
    version: 'v1.0.0.0.6',
    title: 'Purchase and Sales',
    description: `
    1. Authorized Signature added
    2. Branch changes in Printable
    3. Query Optimization
    4. Alignment changes in Sales Orders
    5. Logo automatic add-on
    6. Production add-on
    7. Purchase Printable alignment changes
    8. Stock Transfer → Added 3 screens
    9. API issue solved
     `,
  },
  {
    version: 'v1.0.0.0.5',
    title: 'Purchase and Sales',
    description: `
    1. Purchase Order (Invoice Type added and removed the Vehicle type)
    2. GRN (Other Details card added)
    3. Purchase Return (fixed the white screen issue) 
    4. Purchase Invoice (Other Details card added)
    5. Current tab will not be closed when the close all tab is clicked
    6. Loading Page on the startup and Save
    7. Speed Optimization
    8. Removed the Delete icon and duplicate icon and removed the checkbox based deletion
    9. Removed warehouse on the header level
    10. TCS tax included on the purchase and sales
    11. Search Bug fixed on the Purchase and sales on the customer or supplier select input field
    12. Fixed the Tax Master Not Showing on the Item Details table
    13. Fixed the Printing Issues on complete sales 
    14. Sales order whole Alignment Issues
    15. Removed the Un-nessary textfields and lables in whole sales menu
     `,
  },
  {
    version: 'v1.0.0.0.5',
    title: 'Tax code, purchase order & GRN fixes',
    description: 'Tax code validation reworked; purchase order and GRN field behaviour fixed; purchase return worked on.',
  },
  {
    version: 'v1.0.0.0.3',
    title: 'Stability release',
    description: 'Completed and fixed many bugs.',
  },
  {
    version: 'v1.0.0.0.2',
    title: 'Stability release',
    description: 'Completed and fixed many bugs.',
  },
];

export default function VersionHistory({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon fontSize="small" color="action" />
        Version History
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ ml: 'auto' }}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {VERSION_HISTORY.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No version history has been recorded yet.
          </Typography>
        ) : (
          <Stack divider={<Divider />} spacing={2}>
            {VERSION_HISTORY.map((entry) => (
              <Box key={entry.version}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Chip label={entry.version} size="small" color="primary" variant="outlined" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {entry.title}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {entry.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
