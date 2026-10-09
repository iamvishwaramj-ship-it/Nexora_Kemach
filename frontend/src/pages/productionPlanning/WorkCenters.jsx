import React from 'react';
import { z } from 'zod';
import BuildIcon from '@mui/icons-material/Build';
import MasterCrudPage from '../../components/common/MasterCrudPage';
import { FormGrid } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import { requiredString, optionalString, statusEnum, nonNegativeNumber, optionalNonNegativeNumber } from '../../lib/validation/common';
import { branchApi } from '../../features/resources';
import { workCenterApi } from '../../features/productionApi';

// Production Planning > Work Centers — Phase A manufacturing foundation. A
// plain master (see schema.prisma's WorkCenter model / routes/
// productionMasters.js's crudRouter mount), so this reuses MasterCrudPage
// exactly like any other simple master in this app, rather than a bespoke
// page.

const schema = z.object({
  workCenterCode: requiredString('Work center code'),
  name: requiredString('Name'),
  branch: optionalString(),
  capacityPerDay: optionalNonNegativeNumber('Capacity per day'),
  costPerHour: nonNegativeNumber('Cost per hour'),
  status: statusEnum(),
});

const defaultValues = { workCenterCode: '', name: '', branch: '', capacityPerDay: '', costPerHour: 0, status: 'Active' };

const columns = [
  { field: 'workCenterCode', headerName: 'Work Center Code' },
  { field: 'name', headerName: 'Name' },
  { field: 'branch', headerName: 'Branch' },
  { field: 'capacityPerDay', headerName: 'Capacity / Day', filter: false },
  { field: 'costPerHour', headerName: 'Cost / Hour', filter: false },
  { field: 'status', headerName: 'Status' },
];

export default function WorkCenters() {
  const { data: branches } = branchApi.useList();
  const branchOptions = (branches || []).map((b) => ({ label: b.branchName, value: b.branchName }));

  return (
    <>
      <EntityHeaderCard
        icon={<BuildIcon />}
        title="Work Centers"
        subtitle="Define the work centers (machines/lines/cells) used to build Routings and Production Orders."
      />
      <MasterCrudPage
        title="Work Centers"
        columns={columns}
        schema={schema}
        defaultValues={defaultValues}
        api={workCenterApi}
        formColumns={3}
        renderFields={() => (
          <>
            <FormTextField name="workCenterCode" label="Work Center Code" />
            <FormTextField name="name" label="Name" />
            <FormSelect name="branch" label="Branch" options={branchOptions} />
            <FormTextField name="capacityPerDay" label="Capacity / Day" type="number" />
            <FormTextField name="costPerHour" label="Cost / Hour" type="number" />
            <FormSelect name="status" label="Status" options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} />
          </>
        )}
      />
    </>
  );
}
