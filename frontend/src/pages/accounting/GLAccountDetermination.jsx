import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Stack, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, TextField, Select, MenuItem, Typography, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import EmptyState from '../../components/data-display/EmptyState';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import { financialYearApi, glAccountDeterminationApi } from '../../features/resources';
import { CanAdd, CanEdit } from '../../components/common/PermissionGate';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const GL_DETERMINATION_LIST_TABLE_ROW_HEIGHT = 0;
const GL_DETERMINATION_LIST_TABLE_CELL_PADDING_Y = 6;
// The list at /accounting/gl-account-determination — one row per saved
// determination (Financial Year), matching the reference "G/L Account
// Determination" grid: search box, Show N per page, a plain #/List of
// Year/Actions table, and First/Previous/Page X of Y/Next/Last paging.
// Add New and Edit both hand off to GLAccountDeterminationForm.jsx.
export default function GLAccountDetermination() {
  const navigate = useNavigate();
  const isMobile = useIsMobileListView();
  const { data: years } = financialYearApi.useList();
  const { data: determinations, isLoading } = glAccountDeterminationApi.useList();

  const yearNameById = useMemo(() => new Map((years || []).map((y) => [y.id, y.financialYearName])), [years]);

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const list = (determinations || []).map((d) => ({
      id: d.id,
      year: yearNameById.get(d.financialYearId) || `Year #${d.financialYearId}`,
    }));
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter((r) => r.year.toLowerCase().includes(q)) : list;
    return filtered.sort((a, b) => a.year.localeCompare(b.year, undefined, { numeric: true }));
  }, [determinations, yearNameById, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <Box>
      <EntityHeaderCard
        icon={<RuleOutlinedIcon />}
        title="G/L Account Determination"
        subtitle="Default G/L accounts used when posting sales, purchasing, and inventory documents, by Financial Year."
        rightContent={
          <CanAdd>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/accounting/gl-account-determination/new')}
            >
              Add New
            </Button>
          </CanAdd>
        }
      />

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ px: 2, pt: 2, pb: 1.5 }}
          >
            <TextField
              size="small"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ width: { xs: '100%', sm: 340 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="disabled" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">Show</Typography>
              <Select
                size="small"
                value={pageSize}
                onChange={(e) => { setPageSize(e.target.value); setPage(0); }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </Select>
              <Typography variant="body2" color="text.secondary">per page</Typography>
            </Stack>
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row, i) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.year}
                  fields={[{ label: '#', value: currentPage * pageSize + i + 1 }]}
                  onEdit={() => navigate(`/accounting/gl-account-determination/${row.id}/edit`)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState
                  icon={<RuleOutlinedIcon sx={{ fontSize: 48 }} />}
                  title={search ? 'No matches' : 'No GL Account Determinations yet'}
                  message={search ? 'Try adjusting your search' : 'Click "Add New" to create one'}
                />
              )}
            </Box>
          ) : (
          <TableContainer>
            <Table
              size="small"
              sx={{
                '& th, & td': {
                  height: GL_DETERMINATION_LIST_TABLE_ROW_HEIGHT,
                  paddingTop: `${GL_DETERMINATION_LIST_TABLE_CELL_PADDING_Y}px`,
                  paddingBottom: `${GL_DETERMINATION_LIST_TABLE_CELL_PADDING_Y}px`,
                  boxSizing: 'border-box',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell width={64}>#</TableCell>
                  <TableCell>List of Year</TableCell>
                  <TableCell width={120}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isLoading && pagedRows.map((row, i) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{currentPage * pageSize + i + 1}</TableCell>
                    <TableCell>{row.year}</TableCell>
                    <TableCell>
                      <CanEdit>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => navigate(`/accounting/gl-account-determination/${row.id}/edit`)}
                        >
                          Edit
                        </Button>
                      </CanEdit>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ border: 'none' }}>
                      <EmptyState
                        icon={<RuleOutlinedIcon sx={{ fontSize: 48 }} />}
                        title={search ? 'No matches' : 'No GL Account Determinations yet'}
                        message={search ? 'Try adjusting your search' : 'Click "Add New" to create one'}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" flexWrap="wrap" useFlexGap sx={{ py: 2.5, px: 2 }}>
            <Button size="small" variant="contained" disabled={currentPage === 0} onClick={() => setPage(0)}>
              First
            </Button>
            <Button size="small" variant="contained" disabled={currentPage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
              Page {currentPage + 1} of {pageCount}
            </Typography>
            <Button
              size="small"
              variant="contained"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(pageCount - 1)}
            >
              Last
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
