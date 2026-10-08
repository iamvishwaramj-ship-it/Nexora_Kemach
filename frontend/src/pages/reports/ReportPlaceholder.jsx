import React, { useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import { useNotify } from '../../components/feedback/NotificationProvider';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';

// Shared shell for every Reports > * > * leaf page. Per tempmem.md's
// bespoke-report template (CustomerOutstanding.jsx): EntityHeaderCard +
// a Filters card (From/To Date, not a create/edit form — no Zod schema,
// no mutation) + a list card with the report's own column set. Each real
// report's data source (aggregation route + RTK Query hook) gets wired in
// here individually as its backend endpoint is built; until then this
// renders a proper empty state instead of a blank/broken route.
export default function ReportPlaceholder({ title, subtitle, icon, columns }) {
  const notify = useNotify();
  const methods = useForm({ defaultValues: { fromDate: null, toDate: null } });
  const { handleSubmit } = methods;

  const [hasSearched, setHasSearched] = useState(false);

  // No data source is wired up yet, so `rows` is empty — but the search,
  // sort and filter controls are already in place, so each real report only
  // has to supply its rows when its endpoint lands.
  const rows = [];
  const tableColumns = useMemo(
    () => columns.map((c) => ({ field: c, headerName: c, filter: 'text' })),
    [columns]
  );
  const table = useTableFeatures(rows, tableColumns);

  const onView = handleSubmit(() => setHasSearched(true));
  const handleExport = () => notify.info('No data available to export for the selected criteria');

  return (
    <Box>
      <EntityHeaderCard
        icon={icon}
        title={title}
        subtitle={subtitle}
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={3}>
                <FormDatePicker name="fromDate" label="From Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormDatePicker name="toDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SearchIcon />}
                  onClick={onView}
                  fullWidth
                  sx={{ height: 40 }}
                >
                  View
                </Button>
              </Grid>
            </Grid>
          </FormProvider>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="flex-end"
            gap={1.5}
            sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}
          >
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                Export
              </Button>
              <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                Print
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" justifyContent="flex-end" sx={{ px: 3, pb: 1.5 }}>
            <TableSearchFilter table={table} placeholder="Search..." width={240} />
          </Stack>

          <TableFilterPanel table={table} />

          <ScrollableTableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {columns.map((c) => (
                    <SortableHeaderCell
                      key={c}
                      field={c}
                      sort={table.sort}
                      onSort={table.toggleSort}
                      align={c === 'Amount' || c.includes('Value') || c.includes('Qty') ? 'right' : 'left'}
                    >
                      {c}
                    </SortableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                      {hasSearched
                        ? 'No records found for the selected criteria'
                        : 'Select filters and click View to generate this report'}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
