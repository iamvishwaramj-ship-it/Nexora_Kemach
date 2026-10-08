import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Tabs, Tab, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AddIcon from '@mui/icons-material/Add';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import NoteIcon from '@mui/icons-material/Note';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen with its
// Notes & Attachments tab active, built to match the reference design the
// user supplied for the Production Execution > Notes submenu. Same
// convention as the other Production Execution screens (Production
// Orders, View Order, Operations, Production Execution, Material
// Requisition, Material Issue, Material Receipt, Create Issue, Record
// Production, Product Cost, Production Completion): there is no
// ProductionOrder / Note / Attachment data model in this schema, so this
// lays out the screen exactly as designed with fixed mock data for one
// order (PO-2026-001) rather than fabricating "real" records against
// tables that don't exist. Local state only -- nothing here persists or
// calls the server; the tab strip just switches which panel label is
// active (only "Notes & Attachments" has mock content here, matching the
// reference image -- the other tabs show a neutral empty state, same
// pattern used on the other tabbed Production Execution pages).
// ---------------------------------------------------------------------------

const ORDER = {
  no: 'PO-2026-001',
  orderDate: '01-Oct-2026',
  plannedStart: '01-Oct-2026',
  plannedEnd: '10-Oct-2026',
  status: 'Released',
  priority: 'High',
  itemCode: 'FG-1001',
  itemDesc: 'Gear Housing',
  uom: 'Nos',
  plannedQty: 500,
  producedQty: 320,
  balanceQty: 180,
  productionType: 'In-House',
  project: 'PRJ-2026-001',
  salesOrder: 'SO-2026-09-001',
  plant: 'Main Plant',
  workCenter: 'WC-01 - Machining',
  routingVersion: 'V1',
  bomVersion: 'V1',
  createdBy: 'Kannan P',
  createdOn: '01-Oct-2026 09:30',
  updatedBy: 'Dheena S',
  updatedOn: '02-Oct-2026 14:20',
};

const STATUS_COLOR = { Released: 'info', Completed: 'success', 'In Progress': 'success', Planned: 'warning' };
const PRIORITY_COLOR = { High: 'error', Medium: 'warning', Low: 'info' };
const NOTE_TYPE_COLOR = { General: 'info', Production: 'success', Quality: 'warning', Issue: 'error' };

const NOTES = [
  { no: 1, dateTime: '01-Oct-2026 09:30', type: 'General', title: 'Production Start', desc: 'Production order released as per plan.', addedBy: 'Kannan P', visibility: 'Internal' },
  { no: 2, dateTime: '02-Oct-2026 11:15', type: 'Production', title: 'Material Issue Note', desc: 'Raw material issued partially.', addedBy: 'Dheena S', visibility: 'Internal' },
  { no: 3, dateTime: '03-Oct-2026 14:20', type: 'Quality', title: 'Dimensional Check', desc: 'First lot inspected. All dimensions OK.', addedBy: 'Mani', visibility: 'Internal' },
  { no: 4, dateTime: '04-Oct-2026 10:45', type: 'Issue', title: 'Delay Note', desc: 'Machine breakdown caused 2 hours delay.', addedBy: 'Arunkumar', visibility: 'Internal' },
];

const NOTES_SUMMARY = [
  { label: 'Total Notes', value: 4, icon: NoteIcon, color: 'primary.main' },
  { label: 'General', value: 1, icon: DescriptionIcon, color: 'info.main' },
  { label: 'Production', value: 1, icon: DescriptionIcon, color: 'success.main' },
  { label: 'Quality', value: 1, icon: DescriptionIcon, color: 'warning.main' },
  { label: 'Issue / Delay', value: 1, icon: DescriptionIcon, color: 'error.main' },
];

const FILE_TYPE_META = {
  PDF: { icon: PictureAsPdfIcon, color: 'error.main' },
  Excel: { icon: DescriptionIcon, color: 'success.main' },
  Image: { icon: ImageIcon, color: 'info.main' },
};

const ATTACHMENTS = [
  { no: 1, name: 'Drawing_FG1001.pdf', type: 'PDF', size: '1.2 MB', desc: 'Component drawing', uploadedBy: 'Kannan P', uploadedOn: '01-Oct-2026 09:35' },
  { no: 2, name: 'BOM_FG1001.xlsx', type: 'Excel', size: '350 KB', desc: 'Approved BOM', uploadedBy: 'Dheena S', uploadedOn: '01-Oct-2026 09:40' },
  { no: 3, name: 'Work_Instructions.pdf', type: 'PDF', size: '800 KB', desc: 'Machining work instruction', uploadedBy: 'Mani', uploadedOn: '02-Oct-2026 10:20' },
  { no: 4, name: 'Quality_Checksheet.xlsx', type: 'Excel', size: '420 KB', desc: 'Inspection checklist', uploadedBy: 'Arunkumar', uploadedOn: '03-Oct-2026 14:10' },
  { no: 5, name: 'Photo_Component.jpg', type: 'Image', size: '250 KB', desc: 'Sample component image', uploadedBy: 'Mani', uploadedOn: '04-Oct-2026 11:00' },
];

const ATTACHMENT_SUMMARY = [
  { label: 'PDF', value: 2, color: '#d32f2f' },
  { label: 'Excel', value: 2, color: '#2e7d32' },
  { label: 'Image', value: 1, color: '#1976d2' },
  { label: 'Others', value: 0, color: '#9c27b0' },
];

const TOTAL_FILES = ATTACHMENT_SUMMARY.reduce((sum, a) => sum + a.value, 0);
const TOTAL_FILE_SIZE = '3.02 MB';

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Product Cost', 'Notes & Attachments'];

function fieldRow(label, value) {
  return (
    <Grid item xs={6} sm={4} md={3} lg={2.4} key={label}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Grid>
  );
}

export default function Notes() {
  const [tab, setTab] = useState(7); // Notes & Attachments tab active, matching the reference image
  const [checkedAttachments, setCheckedAttachments] = useState(() => new Set());

  const toggleAttachment = (no) => {
    setCheckedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />}>Copy</Button>
      <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />}>Cancel Order</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Order - View"
        subtitle="View production order details, item components, material status, operations and production progress."
        rightContent={headerActions}
      />

      {/* Production Order Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Production Order Details</Typography>
          <Grid container spacing={2.5}>
            {fieldRow('Production Order No.', ORDER.no)}
            {fieldRow('Order Date', ORDER.orderDate)}
            {fieldRow('Planned Start Date', ORDER.plannedStart)}
            {fieldRow('Planned End Date', ORDER.plannedEnd)}
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <Chip size="small" label={ORDER.status} color={STATUS_COLOR[ORDER.status] || 'default'} sx={{ mt: 0.25 }} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Priority</Typography>
              <Chip size="small" label={ORDER.priority} color={PRIORITY_COLOR[ORDER.priority] || 'default'} variant="outlined" sx={{ mt: 0.25 }} />
            </Grid>

            {fieldRow('Item Code', ORDER.itemCode)}
            {fieldRow('Item Description', ORDER.itemDesc)}
            {fieldRow('UOM', ORDER.uom)}
            {fieldRow('Planned Qty', ORDER.plannedQty)}
            {fieldRow('Produced Qty', ORDER.producedQty)}
            {fieldRow('Balance Qty', ORDER.balanceQty)}
            {fieldRow('Production Type', ORDER.productionType)}
            {fieldRow('Project', ORDER.project)}
            {fieldRow('Sales Order', ORDER.salesOrder)}

            {fieldRow('Plant / Location', ORDER.plant)}
            {fieldRow('Work Center', ORDER.workCenter)}
            {fieldRow('Routing Version', ORDER.routingVersion)}
            {fieldRow('BOM Version', ORDER.bomVersion)}
            {fieldRow('Created By', ORDER.createdBy)}
            {fieldRow('Created On', ORDER.createdOn)}
            {fieldRow('Last Updated By', ORDER.updatedBy)}
            {fieldRow('Last Updated On', ORDER.updatedOn)}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {TABS.map((t) => <Tab key={t} label={t} />)}
          </Tabs>
        </Box>
        <CardContent>
          {tab === 7 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Notes ({NOTES.length})</Typography>
                  <Button size="small" variant="contained" startIcon={<AddIcon />}>Add Note</Button>
                </Stack>

                <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 660px), 300px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Date &amp; Time</TableCell>
                        <TableCell>Note Type</TableCell>
                        <TableCell>Title</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Added By</TableCell>
                        <TableCell>Visibility</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {NOTES.map((n) => (
                        <TableRow key={n.no} hover>
                          <TableCell>{n.no}</TableCell>
                          <TableCell>{n.dateTime}</TableCell>
                          <TableCell>
                            <Chip size="small" label={n.type} color={NOTE_TYPE_COLOR[n.type] || 'default'} />
                          </TableCell>
                          <TableCell><Typography variant="body2" fontWeight={600}>{n.title}</Typography></TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>{n.desc}</TableCell>
                          <TableCell>{n.addedBy}</TableCell>
                          <TableCell>{n.visibility}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.25}>
                              <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                              <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                {/* Attachments */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Attachments ({ATTACHMENTS.length})</Typography>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="contained" startIcon={<UploadFileOutlinedIcon />}>Upload File</Button>
                    <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Download</Button>
                    <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}>View</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
                  </Stack>
                </Stack>

                <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 660px), 300px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>S.No</TableCell>
                        <TableCell>File Name</TableCell>
                        <TableCell>File Type</TableCell>
                        <TableCell>File Size</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Uploaded By</TableCell>
                        <TableCell>Uploaded On</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ATTACHMENTS.map((a) => {
                        const meta = FILE_TYPE_META[a.type] || {};
                        const Icon = meta.icon || DescriptionIcon;
                        return (
                          <TableRow key={a.no} hover>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={checkedAttachments.has(a.no)} onChange={() => toggleAttachment(a.no)} />
                            </TableCell>
                            <TableCell>{a.no}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Icon sx={{ fontSize: 16, color: meta.color }} />
                                <Typography variant="body2">{a.type}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>{a.size}</TableCell>
                            <TableCell sx={{ fontStyle: 'italic', color: 'text.secondary' }}>{a.desc}</TableCell>
                            <TableCell>{a.uploadedBy}</TableCell>
                            <TableCell>{a.uploadedOn}</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.25}>
                                <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small"><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>
              </Grid>

              {/* Right rail */}
              <Grid item xs={12} lg={3.5}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Notes Summary</Typography>
                    <Stack spacing={1.25}>
                      {NOTES_SUMMARY.map((s) => {
                        const Icon = s.icon;
                        return (
                          <Stack key={s.label} direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Icon sx={{ fontSize: 18, color: s.color }} />
                              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                            </Stack>
                            <Typography variant="caption" fontWeight={700}>: {s.value}</Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Attachment Summary</Typography>
                    <Stack alignItems="center" sx={{ mb: 2 }}>
                      <Box sx={{ position: 'relative', width: 140, height: 140 }}>
                        <svg viewBox="0 0 140 140" width="140" height="140">
                          {(() => {
                            let cumulative = 0;
                            const radius = 56;
                            const circumference = 2 * Math.PI * radius;
                            return ATTACHMENT_SUMMARY.filter((a) => a.value > 0).map((a) => {
                              const fraction = a.value / TOTAL_FILES;
                              const dash = fraction * circumference;
                              const offset = cumulative * circumference;
                              cumulative += fraction;
                              return (
                                <circle
                                  key={a.label}
                                  cx="70" cy="70" r={radius}
                                  fill="none" stroke={a.color} strokeWidth="18"
                                  strokeDasharray={`${dash} ${circumference - dash}`}
                                  strokeDashoffset={-offset}
                                  transform="rotate(-90 70 70)"
                                />
                              );
                            });
                          })()}
                        </svg>
                        <Box sx={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="h6" fontWeight={700}>{TOTAL_FILES}</Typography>
                          <Typography variant="caption" color="text.secondary">Files</Typography>
                        </Box>
                      </Box>
                    </Stack>
                    <Stack spacing={0.75} sx={{ mb: 2 }}>
                      {ATTACHMENT_SUMMARY.map((a) => (
                        <Stack key={a.label} direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: a.color }} />
                            <Typography variant="caption" color="text.secondary">{a.label}</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={700}>: {a.value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Total File Size : {TOTAL_FILE_SIZE}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                      Allowed File Types
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      PDF, Excel, Word, Image (JPG, PNG)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Max File Size : 10 MB (per file)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No {TABS[tab].toLowerCase()} recorded for this production order yet.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<EditOutlinedIcon />}>Edit</Button>
        <Button variant="outlined" startIcon={<RocketLaunchOutlinedIcon />}>Release</Button>
        <Button variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />}>Close</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
      </Stack>
    </Box>
  );
}
