import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tabs, Tab,
} from '@mui/material';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "New Subcontracting Order" create screen,
// rebuilt to match the reference screenshot the user supplied (two copies of
// the same image). Same convention as the rest of this project: no
// Subcontracting data model exists in this schema, so this is fixed mock
// data only -- nothing persists or calls the server, and Save/Save & New/
// Preview/Submit do not do anything beyond what's visible here. The
// breadcrumb trail in the header is cosmetic text matching the image, laid
// out inline here the same way as the other Subcontracting screens.
// ---------------------------------------------------------------------------

const TABS = ['Items', 'Process Details', 'Attachments', 'Terms & Conditions', 'Additional Info'];
const TAB_ICONS = [GridViewOutlinedIcon, ViewListOutlinedIcon, AttachFileOutlinedIcon, DescriptionOutlinedIcon, InfoOutlinedIcon];

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', drawingNo: 'DR-001', spec: 'HT-01', process: 'Heat Treatment', orderQty: 500, uom: 'Nos', rate: 250.0, requiredDate: '2026-10-25', remarks: 'Harden to 58 HRC' },
  { no: 2, code: 'FG-1002', desc: 'Motor Bracket', drawingNo: 'DR-002', spec: 'QT-01', process: 'CNC Machining', orderQty: 300, uom: 'Nos', rate: 300.0, requiredDate: '2026-10-28', remarks: 'As per drawing' },
  { no: 3, code: 'FG-1003', desc: 'Valve Body', drawingNo: 'DR-003', spec: 'PL-01', process: 'Surface Coating', orderQty: 200, uom: 'Nos', rate: 280.0, requiredDate: '2026-10-27', remarks: 'Zinc Plating' },
];

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionHeading({ icon: Icon, label }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
      <Icon fontSize="small" color="primary" />
      <Typography variant="subtitle1" fontWeight={700}>{label}</Typography>
    </Stack>
  );
}

export default function NewSubcontractingOrder() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const [orderDate, setOrderDate] = useState('2026-10-10');
  const [productionOrder, setProductionOrder] = useState('PO-2026-004');
  const [itemCode, setItemCode] = useState('FG-1001');
  const [itemDesc] = useState('Gear Housing');
  const [vendorCode, setVendorCode] = useState('V-001');
  const [vendorName] = useState('Sri Balaji Heat Treatment');
  const [process, setProcess] = useState('Heat Treatment');
  const [expectedDelivery, setExpectedDelivery] = useState('2026-10-25');
  const [referenceNo, setReferenceNo] = useState('');
  const [status] = useState('Draft');
  const [department, setDepartment] = useState('Production');
  const [workCenter, setWorkCenter] = useState('WC-HT');
  const [currency, setCurrency] = useState('INR');
  const [remarks, setRemarks] = useState('');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

  const [processParameters, setProcessParameters] = useState('Heat Treatment: Hardness 58-60 HRC\nQuenching & Tempering as per spec.');
  const [qualityRequirements, setQualityRequirements] = useState('100% hardness check\nProvide test certificate');
  const [specialInstructions, setSpecialInstructions] = useState('Handle with care\nMaintain surface finish');

  const [deliveryType, setDeliveryType] = useState('Full');
  const [noOfDeliveries, setNoOfDeliveries] = useState(1);
  const [partialDeliveryAllowed, setPartialDeliveryAllowed] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState('TechconZ Nexora Pvt Ltd\nPlot No. 12, SIPCOT Industrial Park\nCoimbatore - 641021');
  const [contactPerson, setContactPerson] = useState('Kannan P');
  const [contactNo, setContactNo] = useState('9940005487');

  const [discountPct, setDiscountPct] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [packingForwarding, setPackingForwarding] = useState(5000);
  const [freightCharges, setFreightCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [taxPct] = useState(18);

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const updateItem = (no, field, value) => {
    setItems((prev) => prev.map((it) => (it.no === no ? { ...it, [field]: value } : it)));
  };

  const removeItem = (no) => setItems((prev) => prev.filter((it) => it.no !== no));

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', drawingNo: '', spec: '', process: '', orderQty: 0, uom: '', rate: 0, requiredDate: '', remarks: '' },
    ]);
  };

  const totalQty = items.reduce((s, it) => s + Number(it.orderQty || 0), 0);
  const basicAmount = items.reduce((s, it) => s + Number(it.orderQty || 0) * Number(it.rate || 0), 0);
  const taxableAmount = basicAmount - Number(discountAmount || 0) + Number(packingForwarding || 0) + Number(freightCharges || 0) + Number(otherCharges || 0);
  const taxAmount = Math.round(taxableAmount * (taxPct / 100));
  const totalOrderValue = taxableAmount + taxAmount;

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
      {/* <Typography variant="caption" color="primary.main" fontWeight={600}>Manufacturing</Typography>
      <Typography variant="caption" color="text.disabled">&gt;</Typography>
      <Typography variant="caption" color="primary.main" fontWeight={600}>Subcontracting</Typography>
      <Typography variant="caption" color="text.disabled">&gt;</Typography>
      <Typography variant="caption" color="primary.main" fontWeight={600}>Subcontract Orders</Typography>
      <Typography variant="caption" color="text.disabled">&gt;</Typography>
      <Typography variant="caption" color="error.main" fontWeight={700}>New Subcontracting Order</Typography> */}
    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/subcontracting/subcontract-orders')}>Back to List</Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />}>Save</Button>
        <Button variant="contained" startIcon={<LibraryAddOutlinedIcon />}>Save &amp; New</Button>
        <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Preview</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} sx={{ bgcolor: '#17315c', '&:hover': { bgcolor: '#0f2142' } }}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<NoteAddOutlinedIcon />}
        title="New Subcontracting Order"
        subtitle="Create a new subcontract order for external vendor processing."
        rightContent={headerActions}
      />

      {/* Order Information */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={AssignmentOutlinedIcon} label="Order Information" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="SCO No." value="" placeholder="Auto Generate" disabled />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth size="small" required label="Vendor Code" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Status" value={status} disabled />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" required type="date" label="Order Date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Vendor Name" value={vendorName} disabled />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Quality">Quality</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth size="small" label="Production Order No." value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" required select label="Process" value={process} onChange={(e) => setProcess(e.target.value)}>
                <MenuItem value="Heat Treatment">Heat Treatment</MenuItem>
                <MenuItem value="CNC Machining">CNC Machining</MenuItem>
                <MenuItem value="Surface Coating">Surface Coating</MenuItem>
                <MenuItem value="Plating">Plating</MenuItem>
                <MenuItem value="Grinding">Grinding</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth size="small" label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" required type="date" label="Expected Delivery Date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <MenuItem value="INR">INR</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Item Description" value={itemDesc} disabled />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Reference No." placeholder="e.g., Quotation No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth size="small" label="Remarks" placeholder="Enter remarks..." value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs + Items */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 2, pt: 1.5 }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {TABS.map((t, i) => {
              const Icon = TAB_ICONS[i];
              return <Tab key={t} icon={<Icon fontSize="small" />} iconPosition="start" label={t} sx={{ minHeight: 44 }} />;
            })}
          </Tabs>
          {tab === 0 && (
            <Stack direction="row" spacing={1.25} sx={{ pb: 1 }}>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button variant="outlined" color="error" size="small" startIcon={<DeleteOutlineIcon />}>Delete</Button>
            </Stack>
          )}
        </Stack>

        <CardContent>
          {tab === 0 ? (
            <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 360px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell>Drawing No.</TableCell>
                    <TableCell>Specification</TableCell>
                    <TableCell>Process</TableCell>
                    <TableCell align="right">Order Qty</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell align="right">Rate (₹)</TableCell>
                    <TableCell align="right">Amount (₹)</TableCell>
                    <TableCell>Required Date</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(it.no)} onChange={() => toggleRow(it.no)} />
                      </TableCell>
                      <TableCell>{it.no}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{it.code}</Typography></TableCell>
                      <TableCell>{it.desc}</TableCell>
                      <TableCell>{it.drawingNo}</TableCell>
                      <TableCell>{it.spec}</TableCell>
                      <TableCell>{it.process}</TableCell>
                      <TableCell align="right">{it.orderQty}</TableCell>
                      <TableCell>{it.uom}</TableCell>
                      <TableCell align="right">{money(it.rate)}</TableCell>
                      <TableCell align="right">{money(Number(it.orderQty || 0) * Number(it.rate || 0))}</TableCell>
                      <TableCell>{it.requiredDate ? new Date(it.requiredDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : ''}</TableCell>
                      <TableCell>{it.remarks}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25}>
                          <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => removeItem(it.no)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No {TABS[tab].toLowerCase()} added yet.</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Process Requirements / Schedule & Delivery / Order Value Summary */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={EngineeringOutlinedIcon} label="Process Requirements" />
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" multiline minRows={2} label="Process Parameters"
                  value={processParameters} onChange={(e) => setProcessParameters(e.target.value)}
                />
                <TextField
                  fullWidth size="small" multiline minRows={2} label="Quality Requirements"
                  value={qualityRequirements} onChange={(e) => setQualityRequirements(e.target.value)}
                />
                <TextField
                  fullWidth size="small" multiline minRows={2} label="Special Instructions"
                  value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={EventOutlinedIcon} label="Schedule & Delivery" />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" select label="Delivery Type" value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
                    <MenuItem value="Full">Full</MenuItem>
                    <MenuItem value="Partial">Partial</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" type="number" label="No. of Deliveries"
                    value={noOfDeliveries} onChange={(e) => setNoOfDeliveries(Number(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={partialDeliveryAllowed} onChange={(e) => setPartialDeliveryAllowed(e.target.checked)} />}
                    label={<Typography variant="body2">Partial Delivery Allowed</Typography>}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" multiline minRows={3} label="Delivery Address"
                    value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Contact No." value={contactNo} onChange={(e) => setContactNo(e.target.value)} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={ReceiptLongOutlinedIcon} label="Order Value Summary" />
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Quantity</Typography>
                  <Typography variant="body2" fontWeight={600}>{totalQty.toLocaleString('en-IN')} Nos</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Basic Amount</Typography>
                  <Typography variant="body2" fontWeight={600}>{money(basicAmount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="body2" color="text.secondary">Discount</Typography>
                    <TextField select size="small" value="%" sx={{ width: 64 }}>
                      <MenuItem value="%">%</MenuItem>
                      <MenuItem value="₹">₹</MenuItem>
                    </TextField>
                  </Stack>
                  <TextField
                    size="small" type="number" value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    sx={{ width: 100 }} inputProps={{ style: { textAlign: 'right' } }}
                  />
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Packing &amp; Forwarding</Typography>
                  <Typography variant="body2" fontWeight={600}>{money(packingForwarding)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Freight Charges</Typography>
                  <Typography variant="body2" fontWeight={600}>{money(freightCharges)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Other Charges</Typography>
                  <Typography variant="body2" fontWeight={600}>{money(otherCharges)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Tax (GST {taxPct}%)</Typography>
                  <Typography variant="body2" fontWeight={600}>{money(taxAmount)}</Typography>
                </Stack>
                <Stack
                  direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1 }}
                >
                  <Typography variant="body2" fontWeight={700}>Total Order Value (₹)</Typography>
                  <Typography variant="subtitle1" fontWeight={700}>{money(totalOrderValue)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
