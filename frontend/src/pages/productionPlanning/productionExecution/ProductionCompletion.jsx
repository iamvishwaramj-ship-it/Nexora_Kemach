import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Checkbox, FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Menu,
} from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DownloadDoneOutlinedIcon from '@mui/icons-material/DownloadDoneOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import WatchLaterOutlinedIcon from '@mui/icons-material/WatchLaterOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Completion" screen, built to
// match the reference design the user supplied for the Production
// Execution > Production Completion submenu. Same convention as the other
// Production Execution screens (Production Orders, View Order, Operations,
// Material Requisition, Material Issue, Material Receipt, Create Issue,
// Record Production, Product Cost): there is no ProductionCompletion data
// model in this schema, so this lays out the screen exactly as designed
// with fixed mock data rather than fabricating "real" records against
// tables that don't exist. Local state only -- nothing here persists or
// calls the server.
// ---------------------------------------------------------------------------

const STATUS_META = {
  Completed: { color: 'success' },
  Partial: { color: 'warning' },
  'Not Completed': { color: 'error' },
};

const COMPLETIONS = [
  { no: 'PC-2026-001', date: '03-Oct-2026', po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', planned: 500, completed: 500, uom: 'Nos', status: 'Completed', completedBy: 'Mani' },
  { no: 'PC-2026-002', date: '03-Oct-2026', po: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', planned: 1000, completed: 800, uom: 'Nos', status: 'Partial', completedBy: 'Dheena S' },
  { no: 'PC-2026-003', date: '04-Oct-2026', po: 'PO-2026-003', code: 'FG-1003', desc: 'Pump Cover', planned: 300, completed: 300, uom: 'Nos', status: 'Completed', completedBy: 'Arunkumar' },
  { no: 'PC-2026-004', date: '05-Oct-2026', po: 'PO-2026-004', code: 'FG-1004', desc: 'Valve Body', planned: 200, completed: 180, uom: 'Nos', status: 'Partial', completedBy: 'Mani' },
  { no: 'PC-2026-005', date: '06-Oct-2026', po: 'PO-2026-005', code: 'FG-1005', desc: 'Flange', planned: 400, completed: 400, uom: 'Nos', status: 'Completed', completedBy: 'Kannan P' },
  { no: 'PC-2026-006', date: '07-Oct-2026', po: 'PO-2026-006', code: 'FG-1006', desc: 'Shaft', planned: 150, completed: 150, uom: 'Nos', status: 'Completed', completedBy: 'Dheena S' },
  { no: 'PC-2026-007', date: '09-Oct-2026', po: 'PO-2026-007', code: 'FG-1007', desc: 'Gear Cover', planned: 500, completed: 450, uom: 'Nos', status: 'Partial', completedBy: 'Mani' },
  { no: 'PC-2026-008', date: '10-Oct-2026', po: 'PO-2026-008', code: 'FG-1008', desc: 'Spindle Housing', planned: 200, completed: 0, uom: 'Nos', status: 'Not Completed', completedBy: '-' },
];

const TOP_ITEMS = [
  { rank: 1, name: 'Gear Housing', qty: 500 },
  { rank: 2, name: 'Flange', qty: 400 },
  { rank: 3, name: 'Pump Cover', qty: 300 },
  { rank: 4, name: 'Shaft', qty: 150 },
  { rank: 5, name: 'Valve Body', qty: 120 },
];

const FINISHED_GOODS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', uom: 'Nos', planned: 500, completed: 500, accepted: 500, rework: 0, scrap: 0 },
  { no: 2, code: 'FG-1001', desc: 'Gear Housing (Sub)', uom: 'Nos', planned: 100, completed: 100, accepted: 95, rework: 3, scrap: 2 },
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
        <MenuItem onClick={() => setAnchorEl(null)}><CheckCircleOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Mark Completed</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><Inventory2OutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Post to Inventory</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><CancelOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Cancel Completion</MenuItem>
      </Menu>
    </>
  );
}

export default function ProductionCompletion() {
  const [productionOrder, setProductionOrder] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [status, setStatus] = useState('All');
  const [plant, setPlant] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [routingOperation, setRoutingOperation] = useState('All');
  const [completedByFilter, setCompletedByFilter] = useState('All');

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [autoGenerate, setAutoGenerate] = useState(true);
  const [completionNo] = useState('PC-2026-001');
  const [completionDate, setCompletionDate] = useState('2026-10-03');
  const [completionPO, setCompletionPO] = useState('PO-2026-001');
  const [completionPlant, setCompletionPlant] = useState('Main Plant');
  const [completionWorkCenter, setCompletionWorkCenter] = useState('WC-01 - Machining');
  const [completedBy, setCompletedBy] = useState('Mani');
  const [remarks, setRemarks] = useState('Production completed and finished goods received in stock.');

  const [goods, setGoods] = useState(FINISHED_GOODS);
  const [checkedGoods, setCheckedGoods] = useState(() => new Set());

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const toggleGoodsRow = (no) => {
    setCheckedGoods((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const removeGoodsRow = (no) => {
    setGoods((prev) => prev.filter((g) => g.no !== no));
  };

  const addGoodsRow = () => {
    setGoods((prev) => [
      ...prev,
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', planned: 0, completed: 0, accepted: 0, rework: 0, scrap: 0 },
    ]);
  };

  const totals = goods.reduce((acc, g) => ({
    planned: acc.planned + Number(g.planned || 0),
    completed: acc.completed + Number(g.completed || 0),
    accepted: acc.accepted + Number(g.accepted || 0),
    rework: acc.rework + Number(g.rework || 0),
    scrap: acc.scrap + Number(g.scrap || 0),
  }), { planned: 0, completed: 0, accepted: 0, rework: 0, scrap: 0 });

  const TOTAL_RECORDS = COMPLETIONS.length;

  return (
    <Box>
      <EntityHeaderCard
        icon={<TaskAltIcon />}
        title="Production Completion"
        subtitle="Complete production orders and post finished goods to inventory."
      />

      {/* Search / Filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Search / Filter</Typography>
          <Grid container spacing={2.5}>
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
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Partial">Partial</MenuItem>
                <MenuItem value="Not Completed">Not Completed</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
                <MenuItem value="WC-02 - Assembly">WC-02 - Assembly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Routing Operation" value={routingOperation} onChange={(e) => setRoutingOperation(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="OP-10 - Machining">OP-10 - Machining</MenuItem>
                <MenuItem value="OP-20 - Drilling">OP-20 - Drilling</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Completed By" value={completedByFilter} onChange={(e) => setCompletedByFilter(e.target.value)}>
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
              <Typography variant="subtitle1" fontWeight={700}>Production Completion List ({TOTAL_RECORDS})</Typography>
            </Stack>

            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>Completion No.</TableCell>
                    <TableCell>Completion Date</TableCell>
                    <TableCell>Production Order</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell align="right">Planned Qty</TableCell>
                    <TableCell align="right">Completed Qty</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Completed By</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {COMPLETIONS.map((c, idx) => (
                    <TableRow key={c.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(c.no)} onChange={() => toggleRow(c.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.no}</Typography></TableCell>
                      <TableCell>{c.date}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.po}</Typography></TableCell>
                      <TableCell>{c.code}</TableCell>
                      <TableCell>{c.desc}</TableCell>
                      <TableCell align="right">{numberFmt(c.planned)}</TableCell>
                      <TableCell align="right">{numberFmt(c.completed)}</TableCell>
                      <TableCell>{c.uom}</TableCell>
                      <TableCell>
                        <Chip size="small" label={c.status} color={STATUS_META[c.status]?.color || 'default'} />
                      </TableCell>
                      <TableCell>{c.completedBy}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25}>
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><PrintOutlinedIcon fontSize="small" /></IconButton>
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
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Completion Summary</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'success.lighter', borderRadius: 2, py: 1.5 }}>
                    <CheckCircleOutlineIcon color="success" />
                    <Typography variant="h6" fontWeight={700}>4</Typography>
                    <Typography variant="caption" color="text.secondary">Completed</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'warning.lighter', borderRadius: 2, py: 1.5 }}>
                    <WatchLaterOutlinedIcon color="warning" />
                    <Typography variant="h6" fontWeight={700}>3</Typography>
                    <Typography variant="caption" color="text.secondary">Partially Completed</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'error.lighter', borderRadius: 2, py: 1.5 }}>
                    <CancelIcon color="error" />
                    <Typography variant="h6" fontWeight={700}>1</Typography>
                    <Typography variant="caption" color="text.secondary">Not Completed</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={6}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'info.lighter', borderRadius: 2, py: 1.5 }}>
                    <Inventory2OutlinedIcon color="info" />
                    <Typography variant="h6" fontWeight={700}>2,780</Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">Total Completed Qty</Typography>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Completed Items (Qty)</Typography>
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

      {/* Completion Details form + Finished Goods Items */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4.5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Completion Details</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Completion No." value={completionNo} disabled />
                  <FormControlLabel
                    sx={{ mt: 0.5 }}
                    control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                    label={<Typography variant="caption">Auto Generate</Typography>}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" required type="date" label="Completion Date"
                    value={completionDate} onChange={(e) => setCompletionDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" required label="Production Order"
                    value={completionPO} onChange={(e) => setCompletionPO(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" required select label="Plant / Location" value={completionPlant} onChange={(e) => setCompletionPlant(e.target.value)}>
                    <MenuItem value="Main Plant">Main Plant</MenuItem>
                    <MenuItem value="Plant 2">Plant 2</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" required select label="Work Center" value={completionWorkCenter} onChange={(e) => setCompletionWorkCenter(e.target.value)}>
                    <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
                    <MenuItem value="WC-02 - Assembly">WC-02 - Assembly</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" required select label="Completed By" value={completedBy} onChange={(e) => setCompletedBy(e.target.value)}>
                    <MenuItem value="Mani">Mani</MenuItem>
                    <MenuItem value="Dheena S">Dheena S</MenuItem>
                    <MenuItem value="Arunkumar">Arunkumar</MenuItem>
                    <MenuItem value="Kannan P">Kannan P</MenuItem>
                  </TextField>
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

        <Grid item xs={12} md={7.5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Finished Goods Items</Typography>
                <Stack direction="row" spacing={1.25}>
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addGoodsRow}>Add Item</Button>
                  <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import from Production Order</Button>
                </Stack>
              </Stack>

              <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 640px), 260px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>S.No</TableCell>
                      <TableCell sx={{ minWidth: 110 }}>Item Code *</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell align="right">Planned Qty</TableCell>
                      <TableCell align="right" sx={{ minWidth: 100 }}>Completed Qty *</TableCell>
                      <TableCell align="right">Accepted Qty</TableCell>
                      <TableCell align="right">Rework Qty</TableCell>
                      <TableCell align="right">Scrap Qty</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {goods.map((g) => (
                      <TableRow key={g.no} hover>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checkedGoods.has(g.no)} onChange={() => toggleGoodsRow(g.no)} />
                        </TableCell>
                        <TableCell>{g.no}</TableCell>
                        <TableCell>
                          <TextField
                            size="small" variant="standard" value={g.code}
                            onChange={(e) => setGoods((prev) => prev.map((row) => (row.no === g.no ? { ...row, code: e.target.value } : row)))}
                            InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon sx={{ fontSize: 14 }} /></InputAdornment> }}
                          />
                        </TableCell>
                        <TableCell>{g.desc}</TableCell>
                        <TableCell>{g.uom}</TableCell>
                        <TableCell align="right">{numberFmt(g.planned)}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" variant="standard" type="number" value={g.completed}
                            onChange={(e) => setGoods((prev) => prev.map((row) => (row.no === g.no ? { ...row, completed: Number(e.target.value) } : row)))}
                            inputProps={{ style: { textAlign: 'right' } }}
                            sx={{ width: 70 }}
                          />
                        </TableCell>
                        <TableCell align="right">{numberFmt(g.accepted)}</TableCell>
                        <TableCell align="right">{numberFmt(g.rework)}</TableCell>
                        <TableCell align="right">{numberFmt(g.scrap)}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => removeGoodsRow(g.no)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell />
                      <TableCell />
                      <TableCell colSpan={3}><Typography variant="body2" fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={700}>{numberFmt(totals.planned)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={700}>{numberFmt(totals.completed)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={700}>{numberFmt(totals.accepted)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={700}>{numberFmt(totals.rework)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="body2" fontWeight={700}>{numberFmt(totals.scrap)}</Typography></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTableContainer>

              <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
                <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
                <Button variant="contained" startIcon={<CheckCircleOutlineIcon />}>Complete Production</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
