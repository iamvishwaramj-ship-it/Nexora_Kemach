import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Checkbox, FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Menu,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import RecyclingIcon from '@mui/icons-material/Recycling';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DoneIcon from '@mui/icons-material/Done';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Rework & Scrap" screen, built to match the
// reference design the user supplied for the Production Execution > Rework
// & Scrap submenu. Same convention as the other Production Execution
// screens (Material Requisition, Material Issue, Material Receipt,
// Production Completion, ...): there is no Rework/Scrap data model in this
// schema, so this lays out the screen exactly as designed with fixed mock
// data rather than fabricating "real" records against tables that don't
// exist. Local state only -- nothing here persists or calls the server.
// ---------------------------------------------------------------------------

const TYPE_META = {
  Scrap: { color: 'warning' },
  Rework: { color: 'info' },
};

const STATUS_META = {
  Approved: { color: 'success' },
  'In Process': { color: 'info' },
  Rejected: { color: 'error' },
};

const ENTRIES = [
  { no: 'RS-2026-001', date: '01-Oct-2026', po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', type: 'Scrap', qty: 5, reason: 'Dimension out of tolerance', workCenter: 'WC-01', status: 'Approved' },
  { no: 'RS-2026-002', date: '02-Oct-2026', po: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', type: 'Rework', qty: 10, reason: 'Surface finish issue', workCenter: 'WC-02', status: 'In Process' },
  { no: 'RS-2026-003', date: '02-Oct-2026', po: 'PO-2026-003', code: 'FG-1003', desc: 'Pump Cover', type: 'Scrap', qty: 3, reason: 'Crack detected', workCenter: 'WC-03', status: 'Approved' },
  { no: 'RS-2026-004', date: '03-Oct-2026', po: 'PO-2026-004', code: 'FG-1004', desc: 'Valve Body', type: 'Rework', qty: 8, reason: 'Machining rework', workCenter: 'WC-01', status: 'In Process' },
  { no: 'RS-2026-005', date: '04-Oct-2026', po: 'PO-2026-005', code: 'RM-2001', desc: 'Cast Iron (RM)', type: 'Scrap', qty: 20, reason: 'Raw material defect', workCenter: 'Stores', status: 'Approved' },
  { no: 'RS-2026-006', date: '05-Oct-2026', po: 'PO-2026-006', code: 'FG-1005', desc: 'Flange', type: 'Rework', qty: 6, reason: 'Drilling rework', workCenter: 'WC-02', status: 'In Process' },
  { no: 'RS-2026-007', date: '06-Oct-2026', po: 'PO-2026-007', code: 'FG-1006', desc: 'Shaft', type: 'Scrap', qty: 4, reason: 'Tool breakage', workCenter: 'WC-03', status: 'Rejected' },
  { no: 'RS-2026-008', date: '08-Oct-2026', po: 'PO-2026-008', code: 'FG-1007', desc: 'Gear Cover', type: 'Rework', qty: 12, reason: 'Re-machining required', workCenter: 'WC-01', status: 'Approved' },
];

const TOTAL_RECORDS = ENTRIES.length;
const TOTAL_QTY = ENTRIES.reduce((sum, e) => sum + e.qty, 0);
const SCRAP_QTY = ENTRIES.filter((e) => e.type === 'Scrap').reduce((sum, e) => sum + e.qty, 0);
const REWORK_QTY = ENTRIES.filter((e) => e.type === 'Rework').reduce((sum, e) => sum + e.qty, 0);

const REASON_SUMMARY = [
  { label: 'Dimension issue', value: 8, color: '#d32f2f' },
  { label: 'Surface finish', value: 6, color: '#1976d2' },
  { label: 'Raw material defect', value: 5, color: '#f9a825' },
  { label: 'Machining error', value: 7, color: '#2e7d32' },
  { label: 'Other', value: 8, color: '#7b1fa2' },
];
const REASON_TOTAL = REASON_SUMMARY.reduce((sum, r) => sum + r.value, 0);

const TOP_ITEMS = [
  { rank: 1, name: 'Gear Housing', qty: 5 },
  { rank: 2, name: 'Cast Iron (RM)', qty: 20 },
  { rank: 3, name: 'Motor Bracket', qty: 10 },
  { rank: 4, name: 'Gear Cover', qty: 12 },
  { rank: 5, name: 'Valve Body', qty: 8 },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function RowActionMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => setAnchorEl(null)}><DoneIcon fontSize="small" sx={{ mr: 1 }} /> Approve</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><CancelOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Reject</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete</MenuItem>
      </Menu>
    </>
  );
}

export default function ReworkScrap() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [productionOrder, setProductionOrder] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [status, setStatus] = useState('All');
  const [recordedBy, setRecordedBy] = useState('All');

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [autoGenerate, setAutoGenerate] = useState(true);
  const [entryNo] = useState('RS-2026-009');
  const [entryDate, setEntryDate] = useState('2026-10-10');
  const [entryType, setEntryType] = useState('Rework');
  const [entryPO, setEntryPO] = useState('PO-2026-001');
  const [entryWorkCenter, setEntryWorkCenter] = useState('WC-01 - Machining');
  const [entryItemCode, setEntryItemCode] = useState('FG-1001');
  const [entryItemDesc] = useState('Gear Housing');
  const [entryUom] = useState('Nos');
  const [entryQty, setEntryQty] = useState(10);
  const [entryReason, setEntryReason] = useState('Machining size corrections');
  const [disposition, setDisposition] = useState('Send to Rework');
  const [remarks, setRemarks] = useState('Parts require re-machining due to size variation.');

  const [reworkOperation, setReworkOperation] = useState('');
  const [targetCost, setTargetCost] = useState(5000);
  const [targetCompletionDate, setTargetCompletionDate] = useState('2026-10-12');

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/create-rework-entry')}>Create Entry</Button>
      <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<RecyclingIcon />}
        title="Rework & Scrap"
        subtitle="Record and track rework and scrap of materials or finished goods."
        rightContent={headerActions}
      />

      {/* Search / Filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Search / Filter</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="From Date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="To Date"
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Production Order" placeholder="Search PO..."
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Item Code" placeholder="Search Item..."
                value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Reason" placeholder="Search reason..."
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Scrap">Scrap</MenuItem>
                <MenuItem value="Rework">Rework</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="WC-01">WC-01 - Machining</MenuItem>
                <MenuItem value="WC-02">WC-02 - Assembly</MenuItem>
                <MenuItem value="WC-03">WC-03 - Welding</MenuItem>
                <MenuItem value="Stores">Stores</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="In Process">In Process</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Recorded By" value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Mani">Mani</MenuItem>
                <MenuItem value="Dheena S">Dheena S</MenuItem>
                <MenuItem value="Arunkumar">Arunkumar</MenuItem>
                <MenuItem value="Kannan P">Kannan P</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Stack direction="row" spacing={1.5} sx={{ height: '100%' }} alignItems="flex-end">
                <Button fullWidth variant="outlined">Reset</Button>
                <Button fullWidth variant="contained" startIcon={<SearchIcon />}>Search</Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* List + summary */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={8.5}>
          <Card variant="outlined">
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Rework &amp; Scrap List ({TOTAL_RECORDS})</Typography>
            </Stack>

            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>Ref. No.</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Production Order</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Work Center</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ENTRIES.map((e, idx) => (
                    <TableRow key={e.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(e.no)} onChange={() => toggleRow(e.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{e.no}</Typography></TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{e.po}</Typography></TableCell>
                      <TableCell>{e.code}</TableCell>
                      <TableCell>{e.desc}</TableCell>
                      <TableCell>
                        <Chip size="small" label={e.type} color={TYPE_META[e.type]?.color || 'default'} />
                      </TableCell>
                      <TableCell align="right">{numberFmt(e.qty)}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                      <TableCell>{e.workCenter}</TableCell>
                      <TableCell>
                        <Chip size="small" label={e.status} color={STATUS_META[e.status]?.color || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25}>
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                          <RowActionMenu />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>

            <EntityListPagination
              total={TOTAL_RECORDS}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </Card>
        </Grid>

        {/* Right rail: summaries */}
        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Rework &amp; Scrap Summary</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'error.lighter', borderRadius: 2, py: 1.5 }}>
                    <Inventory2OutlinedIcon color="error" />
                    <Typography variant="h6" fontWeight={700}>{numberFmt(TOTAL_QTY)}</Typography>
                    <Typography variant="caption" color="text.secondary">Total Qty</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'success.lighter', borderRadius: 2, py: 1.5 }}>
                    <RecyclingIcon color="success" />
                    <Typography variant="h6" fontWeight={700}>{numberFmt(SCRAP_QTY)}</Typography>
                    <Typography variant="caption" color="text.secondary">Scrap Qty</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'warning.lighter', borderRadius: 2, py: 1.5 }}>
                    <BuildOutlinedIcon color="warning" />
                    <Typography variant="h6" fontWeight={700}>{numberFmt(REWORK_QTY)}</Typography>
                    <Typography variant="caption" color="text.secondary">Rework Qty</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'info.lighter', borderRadius: 2, py: 1.5 }}>
                    <DescriptionOutlinedIcon color="info" />
                    <Typography variant="h6" fontWeight={700}>{numberFmt(TOTAL_RECORDS)}</Typography>
                    <Typography variant="caption" color="text.secondary">Total Records</Typography>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Reason Wise Quantity</Typography>
              <Stack alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ position: 'relative', width: 150, height: 150 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={REASON_SUMMARY} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2}>
                        {REASON_SUMMARY.map((r) => <Cell key={r.label} fill={r.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="h6" fontWeight={700}>{REASON_TOTAL}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </Box>
                </Box>
              </Stack>
              <Stack spacing={0.75}>
                {REASON_SUMMARY.map((r) => (
                  <Stack key={r.label} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.color }} />
                      <Typography variant="caption" color="text.secondary">{r.label}</Typography>
                    </Stack>
                    <Typography variant="caption" fontWeight={700}>: {r.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Items Affected (Qty)</Typography>
              <Stack spacing={1}>
                {TOP_ITEMS.map((t) => (
                  <Stack key={t.rank} direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">{t.rank}. {t.name}</Typography>
                    <Typography variant="caption" fontWeight={700}>{numberFmt(t.qty)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Entry form + Rework Process Details + Attachments */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Rework / Scrap Entry</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Entry No." value={entryNo} disabled />
                  <FormControlLabel
                    sx={{ mt: 0.5 }}
                    control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                    label={<Typography variant="caption">Auto Generate</Typography>}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" required type="date" label="Entry Date"
                    value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" required select label="Type" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                    <MenuItem value="Rework">Rework</MenuItem>
                    <MenuItem value="Scrap">Scrap</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" required label="Production Order"
                    value={entryPO} onChange={(e) => setEntryPO(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" select label="Work Center" value={entryWorkCenter} onChange={(e) => setEntryWorkCenter(e.target.value)}>
                    <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
                    <MenuItem value="WC-02 - Assembly">WC-02 - Assembly</MenuItem>
                    <MenuItem value="WC-03 - Welding">WC-03 - Welding</MenuItem>
                    <MenuItem value="Stores">Stores</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" required label="Item Code"
                    value={entryItemCode} onChange={(e) => setEntryItemCode(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField fullWidth size="small" label="Item Description" value={entryItemDesc} disabled />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" label="UOM" value={entryUom} disabled />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" required type="number" label="Quantity"
                    value={entryQty} onChange={(e) => setEntryQty(Number(e.target.value))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" required select label="Disposition" value={disposition} onChange={(e) => setDisposition(e.target.value)}>
                    <MenuItem value="Send to Rework">Send to Rework</MenuItem>
                    <MenuItem value="Send to Scrap">Send to Scrap</MenuItem>
                    <MenuItem value="Send to Stores">Send to Stores</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" required label="Reason"
                    value={entryReason} onChange={(e) => setEntryReason(e.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Remarks" multiline minRows={3}
                    value={remarks} onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>
                    {remarks.length}/500
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Rework Process Details</Typography>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" select label="Rework Operation" value={reworkOperation} onChange={(e) => setReworkOperation(e.target.value)}>
                      <MenuItem value="">Select operation</MenuItem>
                      <MenuItem value="OP-10 - Machining">OP-10 - Machining</MenuItem>
                      <MenuItem value="OP-20 - Drilling">OP-20 - Drilling</MenuItem>
                      <MenuItem value="OP-30 - Inspection">OP-30 - Inspection</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth size="small" type="number" label="Target Cost (₹)"
                      value={targetCost} onChange={(e) => setTargetCost(Number(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth size="small" type="date" label="Target Completion Date"
                      value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Attachments</Typography>
                  <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Upload File</Button>
                </Stack>
                <Box sx={{
                  border: '1px dashed', borderColor: 'divider', borderRadius: 2, py: 4, textAlign: 'center',
                  bgcolor: 'action.hover',
                }}>
                  <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                  <Typography variant="body2" fontWeight={600}>Drag &amp; drop files here or click to upload</Typography>
                  <Typography variant="caption" color="text.secondary">(PDF, Excel, Image | Max size 10 MB per file)</Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
        <Button variant="contained" startIcon={<CheckCircleOutlineIcon />}>Submit</Button>
      </Stack>
    </Box>
  );
}
