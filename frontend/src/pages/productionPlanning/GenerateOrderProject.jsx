import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Stack, Typography, Grid, Avatar, Button } from '@mui/material';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';

// ---------------------------------------------------------------------------
// Generate Order - Project — explicitly kept visible-but-disabled per the
// approved Phase 1 scope (decision 5): there is no Project concept anywhere
// in this schema (no Project model, no project field on SalesOrder), so
// this screen cannot be wired to real data without first designing and
// approving that concept — out of scope here. Shown so the entry point isn't
// silently removed from navigation, but takes no selection and creates
// nothing.
// ---------------------------------------------------------------------------

const METHODS = [
  { key: 'mrp', path: '/production-planning/generate-order-mrp', label: 'MRP', icon: AssignmentOutlinedIcon, color: '#e65100' },
  { key: 'manual', path: '/production-planning/generate-order-manual', label: 'Manual', icon: TouchAppIcon, color: '#1565c0' },
  { key: 'sales-order', path: '/production-planning/generate-order-sales-order', label: 'Sales Order', icon: DescriptionOutlinedIcon, color: '#2e7d32' },
  { key: 'forecast', path: '/production-planning/generate-order-forecast', label: 'Forecast', icon: InsightsIcon, color: '#6a1b9a' },
  { key: 'project', path: '/production-planning/generate-order-project', label: 'Project', icon: WorkOutlineIcon, color: '#00695c', disabled: true },
];

export default function GenerateOrderProject() {
  const navigate = useNavigate();

  return (
    <Box>
      <EntityHeaderCard
        icon={<WorkOutlineIcon />}
        title="Generate Order (Project)"
        subtitle="Not available yet — this system has no Project concept to generate orders from."
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = m.key === 'project';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && navigate(m.path)}
                sx={{ cursor: active ? 'default' : 'pointer', height: '100%', opacity: active ? 0.6 : 1 }}
              >
                <CardContent>
                  <Avatar sx={{ bgcolor: m.color, width: 40, height: 40 }}><Icon fontSize="small" /></Avatar>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>{m.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ bgcolor: 'rgba(33, 150, 243, 0.06)', borderColor: 'info.light' }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <InfoOutlinedIcon color="info" sx={{ mt: 0.25 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Project-based order generation is not available yet</Typography>
              <Typography variant="body2" color="text.secondary">
                This system does not currently have a Project concept (no Project master, and Sales Orders are not tagged with a
                project). Generating orders by project requires that concept to be designed and approved first. Until then, use
                MRP, Manual selection or Sales Order to generate orders.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button variant="contained" onClick={() => navigate('/production-planning/generate-order-mrp')}>Go to Generate Order - MRP</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
