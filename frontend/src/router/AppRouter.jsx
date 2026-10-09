import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/authSlice';
import MainLayout from '../components/layout/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import NexoraLoadingScreen from '../components/feedback/NexoraLoadingScreen';
import SubMenuIndexPage from '../pages/common/SubMenuIndexPage';

// Reports — real pages (backend-wired), as opposed to the ReportPlaceholder
// shells used for reports not yet built.
const EnquiryRegister = lazy(() => import('../pages/reports/sales/EnquiryRegister'));
const EnquiryAnalysis = lazy(() => import('../pages/reports/sales/EnquiryAnalysis'));
const SalesQuotationRegister = lazy(() => import('../pages/reports/sales/SalesQuotationRegister'));
const SalesInvoiceRegister = lazy(() => import('../pages/reports/sales/SalesInvoiceRegister'));
const CustomerWiseSales = lazy(() => import('../pages/reports/sales/CustomerWiseSales'));
const ProductWiseSales = lazy(() => import('../pages/reports/sales/ProductWiseSales'));
const SalesmanWiseSales = lazy(() => import('../pages/reports/sales/SalesmanWiseSales'));
const PendingSalesOrder = lazy(() => import('../pages/reports/sales/PendingSalesOrder'));
const ProfitabilityAnalysis = lazy(() => import('../pages/reports/sales/ProfitabilityAnalysis'));
const CustomerLedger = lazy(() => import('../pages/reports/sales/CustomerLedger'));
const CustomerAgingReport = lazy(() => import('../pages/reports/sales/CustomerAgingReport'));
const PurchaseOrderRegister = lazy(() => import('../pages/reports/purchase/PurchaseOrderRegister'));
const PurchaseInvoiceRegister = lazy(() => import('../pages/reports/purchase/PurchaseInvoiceRegister'));
const VendorWisePurchase = lazy(() => import('../pages/reports/purchase/VendorWisePurchase'));
const PendingPurchaseOrder = lazy(() => import('../pages/reports/purchase/PendingPurchaseOrder'));
const PriceComparison = lazy(() => import('../pages/reports/purchase/PriceComparison'));
const PurchasePriceHistory = lazy(() => import('../pages/reports/purchase/PurchasePriceHistory'));
const TaxReport = lazy(() => import('../pages/reports/tax/TaxReport'));
const OutputTaxReport = lazy(() => import('../pages/reports/tax/OutputTaxReport'));
const PayableTaxReport = lazy(() => import('../pages/reports/tax/PayableTaxReport'));
const StockSummary = lazy(() => import('../pages/reports/inventory/StockSummary'));
const StockValuation = lazy(() => import('../pages/reports/inventory/StockValuation'));
const LowStockReport = lazy(() => import('../pages/reports/inventory/LowStockReport'));
const SlowMovingStock = lazy(() => import('../pages/reports/inventory/SlowMovingStock'));
const DeadStock = lazy(() => import('../pages/reports/inventory/DeadStock'));
const ReorderLevel = lazy(() => import('../pages/reports/inventory/ReorderLevel'));
const AvailableBalance = lazy(() => import('../pages/reports/inventory/AvailableBalance'));
const CollectionRegister = lazy(() => import('../pages/reports/receivable/CollectionRegister'));
const PaymentRegister = lazy(() => import('../pages/reports/payable/PaymentRegister'));
const CashBook = lazy(() => import('../pages/reports/cashbank/CashBook'));
const DayBook = lazy(() => import('../pages/reports/cashbank/DayBook'));
const BankBook = lazy(() => import('../pages/reports/cashbank/BankBook'));
const DepositRegister = lazy(() => import('../pages/reports/cashbank/DepositRegister'));

// Auth
const Login = lazy(() => import('../pages/auth/Login'));

// Dashboard
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));

// Company Setup
const CompanyDetails = lazy(() => import('../pages/company/CompanyDetails'));
const Branch = lazy(() => import('../pages/company/Branch'));
const FinancialYear = lazy(() => import('../pages/company/FinancialYear'));
const DocumentNumbering = lazy(() => import('../pages/company/DocumentNumbering'));
const TaxCode = lazy(() => import('../pages/company/TaxCode'));
const BankDetails = lazy(() => import('../pages/company/BankDetails'));
const HouseBank = lazy(() => import('../pages/company/HouseBank'));
const SalesEmployee = lazy(() => import('../pages/company/SalesEmployee'));
const ApprovalFlow = lazy(() => import('../pages/company/ApprovalFlow'));
const WarehouseMaster = lazy(() => import('../pages/company/WarehouseMaster'));
const LocationMaster = lazy(() => import('../pages/company/LocationMaster'));
const DepartmentMaster = lazy(() => import('../pages/company/DepartmentMaster'));

// Accounting
const AccountGroup = lazy(() => import('../pages/accounting/AccountGroup'));
const AccountType = lazy(() => import('../pages/accounting/AccountType'));
const ChartOfAccounts = lazy(() => import('../pages/accounting/ChartOfAccounts'));
const GLAccountDetermination = lazy(() => import('../pages/accounting/GLAccountDetermination'));
const GLAccountDeterminationForm = lazy(() => import('../pages/accounting/GLAccountDeterminationForm'));
const JournalEntry = lazy(() => import('../pages/accounting/JournalEntry'));

// Product Setup
const ProductGroup = lazy(() => import('../pages/product/ProductGroup'));
const ProductSubGroup = lazy(() => import('../pages/product/ProductSubGroup'));
const Brand = lazy(() => import('../pages/product/Brand'));
const UnitOfMeasure = lazy(() => import('../pages/product/UnitOfMeasure'));
const CurrencyMaster = lazy(() => import('../pages/product/CurrencyMaster'));
const HsnMaster = lazy(() => import('../pages/product/HsnMaster'));
const ProductMaster = lazy(() => import('../pages/product/ProductMaster'));
const Barcode = lazy(() => import('../pages/product/Barcode'));
const PurchasePrice = lazy(() => import('../pages/product/PurchasePrice'));
const SalesPrice = lazy(() => import('../pages/product/SalesPrice'));
const CustomerDiscount = lazy(() => import('../pages/product/CustomerDiscount'));
const PriceList = lazy(() => import('../pages/product/PriceList'));

// Business Partner
const BusinessPartner = lazy(() => import('../pages/businessPartner/BusinessPartner'));
const TransportMaster = lazy(() => import('../pages/businessPartner/TransportMaster'));

// Purchase
const PurchaseQuotation = lazy(() => import('../pages/purchase/PurchaseQuotation'));
const PurchaseOrder = lazy(() => import('../pages/purchase/PurchaseOrder'));
// UI-only A4 print template preview (static mock data, no backend).
const PurchaseOrderPrintPreview = lazy(() => import('../pages/purchase/PurchaseOrderPrintPreview'));
const PurchaseGRN = lazy(() => import('../pages/purchase/PurchaseGRN'));
const PurchaseInvoice = lazy(() => import('../pages/purchase/PurchaseInvoice'));
const PurchaseReturn = lazy(() => import('../pages/purchase/PurchaseReturn'));
const PurchaseCreditMemo = lazy(() => import('../pages/purchase/PurchaseCreditMemo'));

// Sales
const SalesQuotation = lazy(() => import('../pages/sales/SalesQuotation'));
const SalesOrder = lazy(() => import('../pages/sales/SalesOrder'));
const DeliveryChallan = lazy(() => import('../pages/sales/DeliveryChallan'));
const SalesInvoice = lazy(() => import('../pages/sales/SalesInvoice'));
const SalesCreditMemo = lazy(() => import('../pages/sales/SalesCreditMemo'));
const SalesReturn = lazy(() => import('../pages/sales/SalesReturn'));
const Enquiry = lazy(() => import('../pages/sales/Enquiry'));
const FollowUp = lazy(() => import('../pages/sales/FollowUp'));

// Inventory
const StockReceipt = lazy(() => import('../pages/inventory/StockReceipt'));
const StockIssue = lazy(() => import('../pages/inventory/StockIssue'));
const StockAdjustment = lazy(() => import('../pages/inventory/StockAdjustment'));
const StockTransfer = lazy(() => import('../pages/inventory/StockTransfer'));
const StockTransferRequest = lazy(() => import('../pages/inventory/StockTransferRequest'));
const StockTransferReceipt = lazy(() => import('../pages/inventory/StockTransferReceipt'));
const OpeningBalance = lazy(() => import('../pages/company/OpeningBalance'));
const BPOpeningBalance = lazy(() => import('../pages/company/BPOpeningBalance'));

// Receivables
const CustomerOutstanding = lazy(() => import('../pages/receivables/CustomerOutstanding'));
// Simplified Customer Outstanding view used only on the Receivables menu —
// the Reports > Customer Outstanding route above keeps using the full
// CustomerOutstanding component untouched.
const CustomerOutstandingList = lazy(() => import('../pages/receivables/CustomerOutstandingList'));
const CollectionEntry = lazy(() => import('../pages/receivables/CollectionEntry'));

// Payables
const SupplierOutstanding = lazy(() => import('../pages/payables/SupplierOutstanding'));
// Simplified Supplier Outstanding view used only on the Payables menu — the
// Reports > Supplier Outstanding route below keeps using the full
// SupplierOutstanding component untouched.
const SupplierOutstandingList = lazy(() => import('../pages/payables/SupplierOutstandingList'));
const PaymentEntry = lazy(() => import('../pages/payables/PaymentEntry'));

// Banking
const DepositEntry = lazy(() => import('../pages/banking/DepositEntry'));
const BankReconciliation = lazy(() => import('../pages/banking/BankReconciliation'));
const ChequePrint = lazy(() => import('../pages/banking/ChequePrint'));
const PaymentReceipt = lazy(() => import('../pages/banking/PaymentReceipt'));
const PaymentVoucher = lazy(() => import('../pages/banking/PaymentVoucher'));

// Production Planning
const Forecast = lazy(() => import('../pages/productionPlanning/Forecast'));
const ProductionPlanningDashboard = lazy(() => import('../pages/productionPlanning/ProductionPlanningDashboard'));
const GenerateOrderMrp = lazy(() => import('../pages/productionPlanning/GenerateOrderMrp'));
const OrderGenerationOption = lazy(() => import('../pages/productionPlanning/OrderGenerationOption'));
const PreviewOrder = lazy(() => import('../pages/productionPlanning/PreviewOrder'));
const GenerateOrder = lazy(() => import('../pages/productionPlanning/GenerateOrder'));
const GenerateOrderManual = lazy(() => import('../pages/productionPlanning/GenerateOrderManual'));
const GenerateOrderSalesOrder = lazy(() => import('../pages/productionPlanning/GenerateOrderSalesOrder'));
const GenerateOrderForecast = lazy(() => import('../pages/productionPlanning/GenerateOrderForecast'));
const GenerateOrderProject = lazy(() => import('../pages/productionPlanning/GenerateOrderProject'));
const GeneratedOrders = lazy(() => import('../pages/productionPlanning/GeneratedOrders'));
// Phase A manufacturing foundation (real backend: Work Centers, BOM, Routing,
// Production Orders) — see routes/productionMasters.js / productionOrders.js.
const WorkCenters = lazy(() => import('../pages/productionPlanning/WorkCenters'));
const BillOfMaterials = lazy(() => import('../pages/productionPlanning/BillOfMaterials'));
const Routings = lazy(() => import('../pages/productionPlanning/Routings'));
const PECreateProductionOrder = lazy(() => import('../pages/productionPlanning/productionExecution/CreateProductionOrder'));
const PEProductionOrders = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionOrders'));
const PEViewOrder = lazy(() => import('../pages/productionPlanning/productionExecution/ViewOrder'));
const PEOperations = lazy(() => import('../pages/productionPlanning/productionExecution/Operations'));
const PEProductionExecutionStatus = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionExecutionStatus'));
const PEMaterialRequisition = lazy(() => import('../pages/productionPlanning/productionExecution/MaterialRequisition'));
const PEMaterialIssue = lazy(() => import('../pages/productionPlanning/productionExecution/MaterialIssue'));
const PEMaterialReceipt = lazy(() => import('../pages/productionPlanning/productionExecution/MaterialReceipt'));
const PECreateIssue = lazy(() => import('../pages/productionPlanning/productionExecution/CreateIssue'));
const PERecordProduction = lazy(() => import('../pages/productionPlanning/productionExecution/RecordProduction'));
const PEProductionHistory = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionHistory'));
const PEProductCost = lazy(() => import('../pages/productionPlanning/productionExecution/ProductCost'));
const PEReworkScrap = lazy(() => import('../pages/productionPlanning/productionExecution/ReworkScrap'));
const PEProductionCompletion = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionCompletion'));
const PEProductionClosure = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionClosure'));
const PEReports = lazy(() => import('../pages/productionPlanning/productionExecution/Reports'));
const PENotes = lazy(() => import('../pages/productionPlanning/productionExecution/Notes'));
const PECreateRequisition = lazy(() => import('../pages/productionPlanning/productionExecution/CreateRequisition'));
const PECreateReworkEntry = lazy(() => import('../pages/productionPlanning/productionExecution/CreateReworkEntry'));
const PEProductionOrderReport = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionOrderReport'));
const PEMaterialConsumptionReport = lazy(() => import('../pages/productionPlanning/productionExecution/MaterialConsumptionReport'));
const PEMaterialIssueReport = lazy(() => import('../pages/productionPlanning/productionExecution/MaterialIssueReport'));
const PEReworkScrapReport = lazy(() => import('../pages/productionPlanning/productionExecution/ReworkScrapReport'));
const PEProductionCloserReport = lazy(() => import('../pages/productionPlanning/productionExecution/ProductionCloserReport'));
const PEWorkCenterPerformance = lazy(() => import('../pages/productionPlanning/productionExecution/WorkCenterPerformance'));
const PEOperatorProductivity = lazy(() => import('../pages/productionPlanning/productionExecution/OperatorProductivity'));
const PECostingReport = lazy(() => import('../pages/productionPlanning/productionExecution/CostingReport'));

// Subcontracting -- its own top-level menu, sibling to Production Execution
// (see navConfig.js's own comment on this node: the user clarified it
// should be a standalone menu, not nested inside Production Execution).
const SubcontractingDashboard = lazy(() => import('../pages/subcontracting/SubcontractingDashboard'));
const SubcontractOrders = lazy(() => import('../pages/subcontracting/SubcontractOrders'));
const NewSubcontractingOrder = lazy(() => import('../pages/subcontracting/NewSubcontractingOrder'));
const MaterialIssueToSubcon = lazy(() => import('../pages/subcontracting/MaterialIssueToSubcon'));
const SubconNewIssue = lazy(() => import('../pages/subcontracting/SubconNewIssue'));
const SubcontractInward = lazy(() => import('../pages/subcontracting/SubcontractInward'));
const SubconNewInward = lazy(() => import('../pages/subcontracting/SubconNewInward'));
const SubconQualityInspection = lazy(() => import('../pages/subcontracting/SubconQualityInspection'));
const SubconNewInspection = lazy(() => import('../pages/subcontracting/SubconNewInspection'));
const SubcontractBills = lazy(() => import('../pages/subcontracting/SubcontractBills'));
const SubconNewBill = lazy(() => import('../pages/subcontracting/SubconNewBill'));
const SubcontractingReports = lazy(() => import('../pages/subcontracting/SubcontractingReports'));

// Quality -- its own top-level menu, sibling to Subcontracting (see
// navConfig.js's own comment on this node).
const QualityDashboard = lazy(() => import('../pages/quality/QualityDashboard'));
const InspectionPlanning = lazy(() => import('../pages/quality/InspectionPlanning'));
const NewInspectionPlan = lazy(() => import('../pages/quality/NewInspectionPlan'));
const IncomingInspection = lazy(() => import('../pages/quality/IncomingInspection'));
const QualityNewInspection = lazy(() => import('../pages/quality/QualityNewInspection'));
const InProcessInspection = lazy(() => import('../pages/quality/InProcessInspection'));
const NewInProcessInspection = lazy(() => import('../pages/quality/NewInProcessInspection'));
const FinalInspection = lazy(() => import('../pages/quality/FinalInspection'));
const NewFinalInspection = lazy(() => import('../pages/quality/NewFinalInspection'));
const NonConformance = lazy(() => import('../pages/quality/NonConformance'));
const NewNCR = lazy(() => import('../pages/quality/NewNCR'));
const CorrectiveAction = lazy(() => import('../pages/quality/CorrectiveAction'));
const NewCAPA = lazy(() => import('../pages/quality/NewCAPA'));
const QualityReport = lazy(() => import('../pages/quality/QualityReport'));

// User Management
const UserManagement = lazy(() => import('../pages/user/UserManagement'));

// Settings & Profile
const Settings = lazy(() => import('../pages/settings/Settings'));
const Profile = lazy(() => import('../pages/profile/Profile'));

const ProtectedRoute = ({ children }) => {
  const user = useSelector(selectCurrentUser);
  return user ? children : <Navigate to="/login" replace />;
};

export default function AppRouter() {
  const user = useSelector(selectCurrentUser);

  return (
    <Suspense fallback={<NexoraLoadingScreen />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        </Route>

        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Company Setup */}
          <Route path="company">
            <Route index element={<SubMenuIndexPage navKey="company" />} />
            <Route path="details" element={<CompanyDetails />} />
            <Route path="branch" element={<Branch />} />
            <Route path="financial-year" element={<FinancialYear />} />
            <Route path="document-numbering" element={<DocumentNumbering />} />
            <Route path="tax-code" element={<TaxCode />} />
            <Route path="bank-details" element={<BankDetails />} />
            <Route path="house-bank" element={<HouseBank />} />
            <Route path="sales-employee" element={<SalesEmployee />} />
            <Route path="approval-flow" element={<ApprovalFlow />} />
            <Route path="department" element={<DepartmentMaster />} />
            <Route path="location" element={<LocationMaster />} />
            <Route path="location/create" element={<LocationMaster />} />
            <Route path="warehouse" element={<WarehouseMaster />} />
            <Route path="warehouse/create" element={<WarehouseMaster />} />
            <Route path="opening-balance" element={<OpeningBalance />} />
            <Route path="opening-balance/create" element={<OpeningBalance />} />
            <Route path="bp-opening-balance" element={<BPOpeningBalance />} />
            <Route path="bp-opening-balance/create" element={<BPOpeningBalance />} />
          </Route>

          {/* Accounting */}
          <Route path="accounting">
            <Route index element={<SubMenuIndexPage navKey="accounting" />} />
            <Route path="account-group" element={<AccountGroup />} />
            <Route path="account-type" element={<AccountType />} />
            <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="gl-account-determination" element={<GLAccountDetermination />} />
            <Route path="gl-account-determination/new" element={<GLAccountDeterminationForm />} />
            <Route path="gl-account-determination/:id/edit" element={<GLAccountDeterminationForm />} />
            <Route path="journal-entry" element={<JournalEntry />} />
            <Route path="journal-entry/create" element={<JournalEntry />} />
          </Route>

          {/* Product Setup */}
          <Route path="product">
            <Route index element={<SubMenuIndexPage navKey="product" />} />
            <Route path="group" element={<ProductGroup />} />
            <Route path="sub-group" element={<ProductSubGroup />} />
            <Route path="brand" element={<Brand />} />
            <Route path="uom" element={<UnitOfMeasure />} />
            <Route path="currency" element={<CurrencyMaster />} />
            <Route path="hsn-master" element={<HsnMaster />} />
            <Route path="master" element={<ProductMaster />} />
            <Route path="master/create" element={<ProductMaster />} />
            <Route path="barcode" element={<Barcode />} />
            <Route path="purchase-price" element={<PurchasePrice />} />
            <Route path="sales-price" element={<SalesPrice />} />
            <Route path="customer-discount" element={<CustomerDiscount />} />
            <Route path="price-list" element={<PriceList />} />
          </Route>

          {/* Business Partner */}
          <Route path="partner">
            <Route index element={<SubMenuIndexPage navKey="partner" />} />
            <Route path="business-partner" element={<BusinessPartner />} />
            <Route path="business-partner/create" element={<BusinessPartner />} />
            <Route path="transport" element={<TransportMaster />} />
            <Route path="transport/create" element={<TransportMaster />} />
          </Route>

          {/* Purchase */}
          <Route path="purchase">
            <Route index element={<SubMenuIndexPage navKey="purchase" />} />
            <Route path="quotation" element={<PurchaseQuotation />} />
            <Route path="quotation/create" element={<PurchaseQuotation />} />
            <Route path="order" element={<PurchaseOrder />} />
            <Route path="order/create" element={<PurchaseOrder />} />
            <Route path="order/print-preview" element={<PurchaseOrderPrintPreview />} />
            <Route path="grn" element={<PurchaseGRN />} />
            <Route path="grn/create" element={<PurchaseGRN />} />
            <Route path="invoice" element={<PurchaseInvoice />} />
            <Route path="invoice/create" element={<PurchaseInvoice />} />
            <Route path="return" element={<PurchaseReturn />} />
            <Route path="return/create" element={<PurchaseReturn />} />
            <Route path="credit-memo" element={<PurchaseCreditMemo />} />
            <Route path="credit-memo/create" element={<PurchaseCreditMemo />} />
          </Route>

          {/* Sales */}
          <Route path="sales">
            <Route index element={<SubMenuIndexPage navKey="sales" />} />
            <Route path="quotation" element={<SalesQuotation />} />
            <Route path="quotation/create" element={<SalesQuotation />} />
            <Route path="order" element={<SalesOrder />} />
            <Route path="order/create" element={<SalesOrder />} />
            <Route path="delivery-challan" element={<DeliveryChallan />} />
            <Route path="delivery-challan/create" element={<DeliveryChallan />} />
            <Route path="invoice" element={<SalesInvoice />} />
            <Route path="invoice/create" element={<SalesInvoice />} />
            <Route path="credit-memo" element={<SalesCreditMemo />} />
            <Route path="credit-memo/create" element={<SalesCreditMemo />} />
            <Route path="return" element={<SalesReturn />} />
            <Route path="return/create" element={<SalesReturn />} />
            <Route path="enquiry" element={<Enquiry />} />
            <Route path="follow-up" element={<FollowUp />} />
          </Route>

          {/* Inventory */}
          <Route path="inventory">
            <Route index element={<SubMenuIndexPage navKey="inventory" />} />
            <Route path="stock-receipt" element={<StockReceipt />} />
            <Route path="stock-receipt/create" element={<StockReceipt />} />
            <Route path="stock-issue" element={<StockIssue />} />
            <Route path="stock-issue/create" element={<StockIssue />} />
            <Route path="stock-adjustment" element={<StockAdjustment />} />
            <Route path="stock-adjustment/create" element={<StockAdjustment />} />
            <Route path="stock-transfer">
              <Route index element={<SubMenuIndexPage navKey="stock-transfer" />} />
              <Route path="transfer" element={<StockTransfer />} />
              <Route path="transfer/create" element={<StockTransfer />} />
              <Route path="request" element={<StockTransferRequest />} />
              <Route path="request/create" element={<StockTransferRequest />} />
              <Route path="receipt" element={<StockTransferReceipt />} />
              <Route path="receipt/create" element={<StockTransferReceipt />} />
            </Route>
          </Route>

          {/* Receivables */}
          <Route path="receivables">
            <Route index element={<SubMenuIndexPage navKey="receivables" />} />
            <Route path="outstanding" element={<CustomerOutstandingList />} />
            <Route path="collection" element={<CollectionEntry />} />
            <Route path="collection/create" element={<CollectionEntry />} />
          </Route>

          {/* Payables */}
          <Route path="payables">
            <Route index element={<SubMenuIndexPage navKey="payables" />} />
            <Route path="outstanding" element={<SupplierOutstandingList />} />
            <Route path="payment" element={<PaymentEntry />} />
            <Route path="payment/create" element={<PaymentEntry />} />
          </Route>

          {/* Banking */}
          <Route path="banking">
            <Route index element={<SubMenuIndexPage navKey="banking" />} />
            <Route path="deposit" element={<DepositEntry />} />
            <Route path="deposit/create" element={<DepositEntry />} />
            <Route path="reconciliation" element={<BankReconciliation />} />
            <Route path="cheque-print" element={<ChequePrint />} />
            <Route path="payment-receipt" element={<PaymentReceipt />} />
            <Route path="payment-receipt/create" element={<PaymentReceipt />} />
            <Route path="payment-voucher" element={<PaymentVoucher />} />
            <Route path="payment-voucher/create" element={<PaymentVoucher />} />
          </Route>

          {/* Production Planning */}
          <Route path="production-planning">
            <Route index element={<SubMenuIndexPage navKey="production-planning" />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="dashboard" element={<ProductionPlanningDashboard />} />
            <Route path="generate-order-mrp" element={<GenerateOrderMrp />} />
            <Route path="order-generation-option" element={<OrderGenerationOption />} />
            <Route path="preview-order" element={<PreviewOrder />} />
            {/* "Generate Order" (plain) is the sidebar entry point for the whole
                generation flow; it renders the Generated Orders results screen
                (list of Production/Purchase/Subcontracting/Job Work orders
                produced by a Generate Order run), matching the reference design. */}
            <Route path="generate-order" element={<GeneratedOrders />} />
            <Route path="generate-order-manual" element={<GenerateOrderManual />} />
            <Route path="generate-order-sales-order" element={<GenerateOrderSalesOrder />} />
            <Route path="generate-order-forecast" element={<GenerateOrderForecast />} />
            <Route path="generate-order-project" element={<GenerateOrderProject />} />
            <Route path="generated-orders" element={<GeneratedOrders />} />
            <Route path="work-centers" element={<WorkCenters />} />
            <Route path="bom" element={<BillOfMaterials />} />
            <Route path="routing" element={<Routings />} />
          </Route>

          {/* Production Execution (own top-level menu, sibling to Production Planning) */}
          <Route path="production-execution">
            <Route index element={<SubMenuIndexPage navKey="production-execution" />} />
            <Route path="production-orders" element={<PEProductionOrders />} />
            <Route path="create-production-order" element={<PECreateProductionOrder />} />
            <Route path="view-order" element={<PEViewOrder />} />
            <Route path="view-order/:id" element={<PEViewOrder />} />
            <Route path="operations" element={<PEOperations />} />
            <Route path="production-execution-status" element={<PEProductionExecutionStatus />} />
            <Route path="material-requisition" element={<PEMaterialRequisition />} />
            <Route path="material-issue" element={<PEMaterialIssue />} />
            <Route path="material-receipt" element={<PEMaterialReceipt />} />
            <Route path="create-issue" element={<PECreateIssue />} />
            <Route path="record-production" element={<PERecordProduction />} />
            <Route path="production-history" element={<PEProductionHistory />} />
            <Route path="product-cost" element={<PEProductCost />} />
            <Route path="rework-scrap" element={<PEReworkScrap />} />
            <Route path="production-completion" element={<PEProductionCompletion />} />
            <Route path="production-closure" element={<PEProductionClosure />} />
            <Route path="reports" element={<PEReports />} />
            <Route path="notes" element={<PENotes />} />
            <Route path="create-requisition" element={<PECreateRequisition />} />
            <Route path="create-rework-entry" element={<PECreateReworkEntry />} />
            <Route path="production-order-report" element={<PEProductionOrderReport />} />
            <Route path="material-consumption-report" element={<PEMaterialConsumptionReport />} />
            <Route path="material-issue-report" element={<PEMaterialIssueReport />} />
            <Route path="rework-scrap-report" element={<PEReworkScrapReport />} />
            <Route path="production-closer-report" element={<PEProductionCloserReport />} />
            <Route path="work-center-performance" element={<PEWorkCenterPerformance />} />
            <Route path="operator-productivity" element={<PEOperatorProductivity />} />
            <Route path="costing-report" element={<PECostingReport />} />
          </Route>

          {/* Subcontracting (own top-level menu, sibling to Production
              Execution -- see navConfig.js's own comment on this node). */}
          <Route path="subcontracting">
            <Route index element={<SubMenuIndexPage navKey="subcontracting" />} />
            <Route path="dashboard" element={<SubcontractingDashboard />} />
            <Route path="subcontract-orders" element={<SubcontractOrders />} />
            <Route path="new-subcontracting-order" element={<NewSubcontractingOrder />} />
            <Route path="material-issue-to-subcon" element={<MaterialIssueToSubcon />} />
            <Route path="new-issue" element={<SubconNewIssue />} />
            <Route path="subcontract-inward" element={<SubcontractInward />} />
            <Route path="new-inward" element={<SubconNewInward />} />
            <Route path="quality-inspection" element={<SubconQualityInspection />} />
            <Route path="new-inspection" element={<SubconNewInspection />} />
            <Route path="subcontract-bills" element={<SubcontractBills />} />
            <Route path="new-bill" element={<SubconNewBill />} />
            <Route path="reports" element={<SubcontractingReports />} />
          </Route>

          {/* Quality (own top-level menu, sibling to Subcontracting -- see
              navConfig.js's own comment on this node). */}
          <Route path="quality">
            <Route index element={<SubMenuIndexPage navKey="quality" />} />
            <Route path="dashboard" element={<QualityDashboard />} />
            <Route path="inspection-planning" element={<InspectionPlanning />} />
            <Route path="new-plan" element={<NewInspectionPlan />} />
            <Route path="incoming-inspection" element={<IncomingInspection />} />
            <Route path="new-inspection" element={<QualityNewInspection />} />
            <Route path="in-process-inspection" element={<InProcessInspection />} />
            <Route path="new-in-process-inspection" element={<NewInProcessInspection />} />
            <Route path="final-inspection" element={<FinalInspection />} />
            <Route path="new-final-inspection" element={<NewFinalInspection />} />
            <Route path="ncr" element={<NonConformance />} />
            <Route path="new-ncr" element={<NewNCR />} />
            <Route path="capa" element={<CorrectiveAction />} />
            <Route path="new-capa" element={<NewCAPA />} />
            <Route path="report" element={<QualityReport />} />
          </Route>

          {/* Reports */}
          <Route path="reports">
            <Route index element={<SubMenuIndexPage navKey="reports" />} />

            <Route path="sales">
              <Route index element={<SubMenuIndexPage navKey="reports-sales" />} />
              <Route path="enquiry-register" element={<EnquiryRegister />} />
              <Route path="enquiry-analysis" element={<EnquiryAnalysis />} />
              <Route path="quotation-register" element={<SalesQuotationRegister />} />
              <Route path="invoice-register" element={<SalesInvoiceRegister />} />
              <Route path="customer-wise" element={<CustomerWiseSales />} />
              <Route path="product-wise" element={<ProductWiseSales />} />
              <Route path="salesman-wise" element={<SalesmanWiseSales />} />
              <Route path="pending-order" element={<PendingSalesOrder />} />
              <Route path="profitability" element={<ProfitabilityAnalysis />} />
              <Route path="customer-ledger" element={<CustomerLedger />} />
              <Route path="customer-aging" element={<CustomerAgingReport />} />
            </Route>

            <Route path="purchase">
              <Route index element={<SubMenuIndexPage navKey="reports-purchase" />} />
              <Route path="order-register" element={<PurchaseOrderRegister />} />
              <Route path="invoice-register" element={<PurchaseInvoiceRegister />} />
              <Route path="vendor-wise" element={<VendorWisePurchase />} />
              <Route path="pending-order" element={<PendingPurchaseOrder />} />
              <Route path="price-comparison" element={<PriceComparison />} />
              <Route path="price-history" element={<PurchasePriceHistory />} />
            </Route>

            <Route path="inventory">
              <Route index element={<SubMenuIndexPage navKey="reports-inventory" />} />
              <Route path="stock-summary" element={<StockSummary />} />
              <Route path="stock-valuation" element={<StockValuation />} />
              <Route path="low-stock" element={<LowStockReport />} />
              <Route path="slow-moving" element={<SlowMovingStock />} />
              <Route path="dead-stock" element={<DeadStock />} />
              <Route path="reorder-level" element={<ReorderLevel />} />
              <Route path="available-balance" element={<AvailableBalance />} />
            </Route>

            <Route path="receivable">
              <Route index element={<SubMenuIndexPage navKey="reports-receivable" />} />
              <Route path="customer-outstanding" element={<CustomerOutstanding />} />
              <Route path="collection-register" element={<CollectionRegister />} />
            </Route>

            <Route path="payable">
              <Route index element={<SubMenuIndexPage navKey="reports-payable" />} />
              <Route path="supplier-outstanding" element={<SupplierOutstanding />} />
              <Route path="payment-register" element={<PaymentRegister />} />
            </Route>

            <Route path="cash-bank">
              <Route index element={<SubMenuIndexPage navKey="reports-cash-bank" />} />
              <Route path="cash-book" element={<CashBook />} />
              <Route path="day-book" element={<DayBook />} />
              <Route path="bank-book" element={<BankBook />} />
              <Route path="deposit-register" element={<DepositRegister />} />
            </Route>

            {/* Tax Reports — Input Tax Report, Output Tax Report and Payable
                Tax Report (net GST payable = Output Tax less Input Tax,
                viewable All / Customer Wise / Invoice Wise) are all fully
                built. Add a further <Route path="..."> here alongside its
                navConfig.js entry as more reports land. */}
            <Route path="tax-reports">
              <Route index element={<SubMenuIndexPage navKey="reports-tax-reports" />} />
              <Route path="tax-report" element={<TaxReport />} />
              <Route path="output-tax-report" element={<OutputTaxReport />} />
              <Route path="payable-tax-report" element={<PayableTaxReport />} />
            </Route>
          </Route>

          {/* User Management */}
          <Route path="user" element={<UserManagement />} />

          {/* Settings & Profile */}
          <Route path="settings" element={<Settings />} />
          <Route path="settings/profile" element={<Profile />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
