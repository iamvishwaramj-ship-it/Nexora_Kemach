/**
 * empdepttrnck.js — empties the two Company Setup masters:
 *   - Employee Master   (sales_employees)
 *   - Department Master (department_master)
 *
 * and resets both identity counters, so the next record inserted starts at
 * id 1 again — i.e. the end state TRUNCATE TABLE would leave.
 *
 *   npm run empdepttrnck -- --yes
 *
 * DESTRUCTIVE AND IRREVERSIBLE. Without --yes it only prints what it would
 * delete and exits, matching seed/wipetable.js's own guard.
 *
 * ---------------------------------------------------------------------------
 * Why DELETE + DBCC CHECKIDENT rather than an actual TRUNCATE TABLE
 * ---------------------------------------------------------------------------
 * SQL Server refuses TRUNCATE TABLE on any table referenced by a foreign key
 * — even when the referencing table holds no matching rows, and even when the
 * FK is ON DELETE SET NULL. Both of these tables are referenced:
 *
 *     app_users.employee_id      -> sales_employees.id     (ON DELETE SET NULL)
 *     sales_employees.department_id -> department_master.id (ON DELETE NO ACTION)
 *
 * so `TRUNCATE TABLE sales_employees` fails outright with
 * "Cannot truncate table because it is being referenced by a FOREIGN KEY
 * constraint". DELETE has no such restriction, and DBCC CHECKIDENT(RESEED, 0)
 * supplies the identity reset that DELETE alone does not do — together they
 * reproduce TRUNCATE's result without dropping and re-creating constraints.
 *
 * Order matters: department_master is deleted LAST, because
 * sales_employees.department_id is NO ACTION (not SET NULL / CASCADE) — the
 * database would block deleting a department while any employee still points
 * at it.
 *
 * User accounts are unlinked first rather than deleted: an AppUser is a login,
 * not an employee record, and wiping the Employee Master must never destroy
 * someone's ability to sign in. Their employee_id / employee_code /
 * employee_name are cleared (the same thing the ON DELETE SET NULL would do
 * to employee_id, extended to the two denormalized columns beside it, which
 * the FK does not know about and would otherwise leave showing a deleted
 * employee's code and name).
 */
require('dotenv').config();
const prisma = require('../prisma/client');

// Identity reset. Kept separate from the deletes: it is the cosmetic half of
// the job, so a database where DBCC is not permitted (a restricted login)
// still gets the rows cleared rather than failing the whole run.
async function reseed(table) {
  try {
    await prisma.$executeRawUnsafe(`DBCC CHECKIDENT ('[dbo].[${table}]', RESEED, 0) WITH NO_INFOMSGS`);
    return true;
  } catch (err) {
    console.warn(`  ! could not reset the identity counter on ${table}: ${err.message}`);
    console.warn('    (rows are still deleted — the next id will just carry on from the old high-water mark)');
    return false;
  }
}

async function run() {
  const confirmed = process.argv.includes('--yes');

  const [employees, departments, linkedUsers] = await Promise.all([
    prisma.salesEmployee.count(),
    prisma.departmentMaster.count(),
    prisma.appUser.count({ where: { employeeId: { not: null } } }),
  ]);

  console.log('Company Setup — truncate Employee Master + Department Master');
  console.log('-----------------------------------------------------------');
  console.log(`  Employee Master   (sales_employees)   : ${employees} row(s) to delete`);
  console.log(`  Department Master (department_master) : ${departments} row(s) to delete`);
  console.log(`  User accounts linked to an employee   : ${linkedUsers} (will be UNLINKED, not deleted)`);
  console.log('');

  if (!confirmed) {
    console.error('Nothing has been changed — this is a dry run.');
    console.error('Re-run with:  npm run empdepttrnck -- --yes');
    process.exitCode = 1;
    return;
  }

  console.log('Deleting — this cannot be undone...');

  // One transaction so a failure part-way cannot leave employees deleted but
  // their departments still present (or user accounts unlinked for nothing).
  const [unlinked, employeesDeleted, departmentsDeleted] = await prisma.$transaction([
    prisma.appUser.updateMany({
      where: { employeeId: { not: null } },
      data: { employeeId: null, employeeCode: null, employeeName: null },
    }),
    prisma.salesEmployee.deleteMany({}),
    prisma.departmentMaster.deleteMany({}),
  ]);

  console.log(`  unlinked  ${unlinked.count} user account(s) from their employee record`);
  console.log(`  deleted   ${employeesDeleted.count} employee(s)`);
  console.log(`  deleted   ${departmentsDeleted.count} department(s)`);

  await reseed('sales_employees');
  await reseed('department_master');

  console.log('');
  console.log('Done. Both masters are empty and their ids restart at 1.');
  console.log('');
  console.log('Note: documents that recorded an employee by NAME (Sales Order');
  console.log('  salesPerson / preparedBy / approvedBy, and similar) keep that');
  console.log('  text — it is plain free text on those rows, not a foreign key,');
  console.log('  so nothing there breaks, but those names no longer resolve to');
  console.log('  an Employee Master record.');
  console.log('Note: any user account that was linked to an employee now has no');
  console.log('  employee. Employee Name is required on the User Master form for');
  console.log('  every account except the seeded admin, so re-open those users');
  console.log('  and pick an employee before saving them again.');
}

run()
  .catch((err) => {
    console.error('Truncate error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
