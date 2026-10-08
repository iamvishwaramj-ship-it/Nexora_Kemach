import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Avatar,
  Table, TableHead, TableBody, TableRow, TableCell, TextField, InputAdornment,
  Tabs, Tab, IconButton, Menu, MenuItem,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Generated Orders" results screen, built to
// match the reference design the user supplied. Same convention as the other
// Production Planning screens already built this way (Dashboard, Generate
// Order - MRP, Order Generation Options): Production/Purchase/Subcontracting/
// Job Work order documents from a Generate Order run have no backing data
// model in this schema, so this is fixed mock data laid out exactly as
// designed. Reached from the "Generate Orders" button on the Generate Order -
// MRP and Order Generation Options pages (wired for real navigation), not
// from the sidebar menu -- same as the reference design, which shows it only
// in the breadcrumb trail. Local state only -- nothing here persists or
// calls the server.
// ---------------------------------------------------------------------------

const HEADER_INFO = [
  { label: 'GO Number', value: 'GO-2026-10-001' },
  { label: 'Source Type', value: 'MRP', isSourceChip: true },
  { label: 'MRP Run', value: 'MRP-2026-10-01' },
  { label: 'GO Date', value: '01-Oct-2026' },
  { label: 'Required Delivery Date', value: '31-Dec-2026' },
  { label: 'Plant / Location', value: 'Main Plant' },
  { label: 'Status', value: 'Completed', isStatusChip: true },
];

const SUMMARY_CARDS = [
  { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: '#1565c0', value: 2, status: 'Created' },
  { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: '#e65100', value: 1, status: 'Created' },
  { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: '#6a1b9a', value: 0, status: '-' },
  { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: '#00695c', value: 0, status: '-' },
];

const PRODUCTION_ORDERS = [
  { no: 'PRO-2026-10-001', code: 'FG-1001', desc: 'Gear Housing', qty: 500, uom: 'Nos', start: '02-Oct-2026', due: '05-Oct-2026', routing: 'RT-01', createdOn: '01-Oct-2026 10:24', createdBy: 'Kannan P' },
  { no: 'PRO-2026-10-002', code: 'FG-1003', desc: 'Pump Cover', qty: 400, uom: 'Nos', start: '06-Oct-2026', due: '12-Oct-2026', routing: 'RT-03', createdOn: '01-Oct-2026 10:24', createdBy: 'Kannan P' },
];

const PURCHASE_ORDERS = [
  { no: 'PO-2026-10-001', code: 'RM-010', desc: 'Paint', qty: 50, uom: 'Nos', vendor: 'SUP-004', expected: '03-Oct-2026', createdOn: '01-Oct-2026 10:24', createdBy: 'Kannan P' },
];

const TABS = [
  { key: 'all', label: `All Orders (${PRODUCTION_ORDERS.length + PURCHASE_ORDERS.length})` },
  { key: 'production', label: `Production Orders (${PRODUCTION_ORDERS.length})` },
  { key: 'purchase', label: `Purchase Orders (${PURCHASE_ORDERS.length})` },
  { key: 'subcontracting', label: 'Subcontracting Orders (0)' },
  { key: 'jobwork', label: 'Job Work Orders (0)' },
];

function RowActionMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => setAnchorEl(null)}>View</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Print</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Edit</MenuItem>
      </Menu>
    </>
  );
}

export default function GeneratedOrders() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [exportAnchor, setExportAnchor] = useState(null);

  const showProduction = tab === 'all' || tab === 'production';
  const showPurchase = tab === 'all' || tab === 'purchase';
  const showSubcontracting = tab === 'all' || tab === 'subcontracting';
  const showJobWork = tab === 'all' || tab === 'jobwork';

  const q = search.trim().toLowerCase();
  const filteredProduction = PRODUCTION_ORDERS.filter((r) => !q || r.no.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
  const filteredPurchase = PURCHASE_ORDERS.filter((r) => !q || r.no.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Generated Orders"
        subtitle="List of Production, Purchase, Subcontracting and Job Work orders generated from GO-2026-10-001."
      />

      {/* Header info strip */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Grid container spacing={2.5} sx={{ flex: 1 }}>
              {HEADER_INFO.map((f) => (
                <Grid item xs={6} sm={4} md={12 / HEADER_INFO.length} key={f.label}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{f.label}</Typography>
                  {f.isSourceChip ? (
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                      <Avatar sx={{ bgcolor: 'warning.main', width: 22, height: 22 }}>
                        <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />
                      </Avatar>
                      <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                    </Stack>
                  ) : f.isStatusChip ? (
                    <Chip size="small" label={f.value} color="success" variant="outlined" sx={{ mt: 0.25, fontWeight: 600 }} />
                  ) : (
                    <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                  )}
                </Grid>
              ))}
            </Grid>
            <Button variant="outlined" startIcon={<BarChartIcon />}>View GO Details</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SUMMARY_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={c.key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ bgcolor: c.color, width: 44, height: 44 }}>
                      <Icon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{c.label}</Typography>
                      <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.status}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Orders list */}
      <Card variant="outlined">
        <Stack
          direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}
          sx={{ px: 2.5, pt: 1 }}
        >
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44 } }}
          >
            {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
          </Tabs>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5 }} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" size="small" startIcon={<FilterAltOutlinedIcon />}>Filter</Button>
            <Button
              variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />} endIcon={<KeyboardArrowDownIcon />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
            >
              Export
            </Button>
            <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
              <MenuItem onClick={() => setExportAnchor(null)}><PictureAsPdfOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> PDF</MenuItem>
              <MenuItem onClick={() => setExportAnchor(null)}><InsertDriveFileOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Excel</MenuItem>
            </Menu>
          </Stack>
        </Stack>

        <Box sx={{ px: 2.5, pb: 2.5 }}>
          {showProduction && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#1565c0', width: 28, height: 28 }}>
                  <PrecisionManufacturingIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Production Orders ({filteredProduction.length})</Typography>
              </Stack>
              <ScrollableTableContainer maxHeight="none">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Production Order No.</TableCell>
                      <TableCell>FG Item Code</TableCell>
                      <TableCell>FG Description</TableCell>
                      <TableCell align="right">Order Qty</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Planned Start Date</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Routing</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created On</TableCell>
                      <TableCell>Created By</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProduction.map((r, idx) => (
                      <TableRow key={r.no} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                        <TableCell>{r.code}</TableCell>
                        <TableCell>{r.desc}</TableCell>
                        <TableCell align="right">{r.qty}</TableCell>
                        <TableCell>{r.uom}</TableCell>
                        <TableCell>{r.start}</TableCell>
                        <TableCell>{r.due}</TableCell>
                        <TableCell>{r.routing}</TableCell>
                        <TableCell><Chip size="small" label="Created" color="success" variant="outlined" /></TableCell>
                        <TableCell>{r.createdOn}</TableCell>
                        <TableCell>{r.createdBy}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell><RowActionMenu /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </Box>
          )}

          {showPurchase && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#e65100', width: 28, height: 28 }}>
                  <ShoppingCartIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Purchase Orders ({filteredPurchase.length})</Typography>
              </Stack>
              <ScrollableTableContainer maxHeight="none">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Purchase Order No.</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell align="right">Order Qty</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell>Expected Delivery Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created On</TableCell>
                      <TableCell>Created By</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPurchase.map((r, idx) => (
                      <TableRow key={r.no} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                        <TableCell>{r.code}</TableCell>
                        <TableCell>{r.desc}</TableCell>
                        <TableCell align="right">{r.qty}</TableCell>
                        <TableCell>{r.uom}</TableCell>
                        <TableCell>{r.vendor}</TableCell>
                        <TableCell>{r.expected}</TableCell>
                        <TableCell><Chip size="small" label="Created" color="success" variant="outlined" /></TableCell>
                        <TableCell>{r.createdOn}</TableCell>
                        <TableCell>{r.createdBy}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell><RowActionMenu /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </Box>
          )}

          {showSubcontracting && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#6a1b9a', width: 28, height: 28 }}>
                  <GroupsIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Subcontracting Orders (0)</Typography>
              </Stack>
              <ScrollableTableContainer maxHeight="none">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Subcontract Order No.</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell align="right">Order Qty</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Vendor / Subcontractor</TableCell>
                      <TableCell>Expected Delivery Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created On</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={12}>
                        <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ py: 2 }}>
                          <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">No subcontracting orders generated for this GO.</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </Box>
          )}

          {showJobWork && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#00695c', width: 28, height: 28 }}>
                  <BuildIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Job Work Orders (0)</Typography>
              </Stack>
              <ScrollableTableContainer maxHeight="none">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Job Work Order No.</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell align="right">Order Qty</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Vendor / Work Center</TableCell>
                      <TableCell>Expected Delivery Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created On</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={12}>
                        <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ py: 2 }}>
                          <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                          <Typography variant="body2" color="text.secondary">No job work orders generated for this GO.</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </Box>
          )}
        </Box>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>
          Back to Generate Orders
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<PictureAsPdfOutlinedIcon />}>Download Orders Report (PDF)</Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export to Excel</Button>
      </Stack>
    </Box>
  );
}
