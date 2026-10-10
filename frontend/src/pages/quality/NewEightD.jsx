import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, InputAdornment, Checkbox,
  Radio, RadioGroup, FormControlLabel,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TroubleshootOutlinedIcon from '@mui/icons-material/TroubleshootOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import OpenInFullOutlinedIcon from '@mui/icons-material/OpenInFullOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';

// ---------------------------------------------------------------------------
// "Quality > 8D Management > New 8D" -- static UI-only mock of the 8D create
// screen, built to match the reference screenshot the user supplied. Opens
// from 8D Management's "New 8D" button. Same convention as the rest of this
// codebase: fixed mock data only -- nothing persists or calls the server;
// Save / Save & New / Submit only toast + (for Submit) navigate back to the
// 8D Management list. Only the D0 - Plan & Team step has full reference
// content; D1-D8 render a generic placeholder, same pattern used for the
// Required Resources tabs on the New Operation screen.
// ---------------------------------------------------------------------------

const EIGHT_D_TYPES = ['Customer Complaint', 'Internal', 'Supplier Issue'];
const SOURCES = ['Customer', 'Internal', 'Supplier'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const DEPARTMENTS = ['Production', 'Quality', 'Engineering', 'Supply Chain'];
const REPORTED_BY_OPTIONS = ['Customer', 'Internal', 'Supplier'];

const D_STEPS = [
  { code: 'D0', label: 'Plan & Team' },
  { code: 'D1', label: 'Problem Description' },
  { code: 'D2', label: 'Containment Action' },
  { code: 'D3', label: 'Root Cause Analysis' },
  { code: 'D4', label: 'Corrective Action' },
  { code: 'D5', label: 'Verify Effectiveness' },
  { code: 'D6', label: 'Prevent Recurrence' },
  { code: 'D7', label: 'Close & Congratulate' },
  { code: 'D8', label: 'Lessons Learned' },
];

const TEAM_MEMBER_ROWS = [
  { no: 1, name: 'Dheena', dept: 'Production', role: 'Member' },
  { no: 2, name: 'Pradeep', dept: 'Quality', role: 'Member' },
  { no: 3, name: 'Indrakumar', dept: 'Engineering', role: 'Member' },
  { no: 4, name: 'Ganga', dept: 'Production', role: 'Member' },
];

// D1 - Problem Description
const PROBLEM_CATEGORIES = ['Dimensional', 'Functional', 'Cosmetic', 'Packaging'];
const DEFECT_TYPES = ['Machining Marks', 'Surface Finish', 'Dimension Out of Tolerance', 'Crack / Defect', 'Material Issue'];
const NC_CATEGORIES = ['Functional', 'Cosmetic', 'Critical', 'Minor'];
const SEVERITIES = ['Critical', 'Major', 'Minor'];
const DETECTED_BY_OPTIONS = ['Customer Inspection', 'Internal Audit', 'Incoming Inspection', 'In-process Inspection', 'Final Inspection'];
const WHERE_DETECTED_OPTIONS = ['At Customer Site', 'In-house', 'At Supplier Site', 'In Transit'];
const QTY_UNIT_OPTIONS = ['Nos', 'Kg', 'Set'];

const EVIDENCE_ROWS = [
  { no: 1, type: 'Photo', fileName: 'GH_Defect1.jpg', desc: 'Surface finish marks', uploadedOn: '25-Sep-2026' },
  { no: 2, type: 'Measurement Report', fileName: 'GH_Dimension.pdf', desc: 'Dimensional variation', uploadedOn: '25-Sep-2026' },
  { no: 3, type: 'Customer Complaint', fileName: 'Customer_Mail.pdf', desc: 'Customer complaint mail', uploadedOn: '25-Sep-2026' },
];

const EVIDENCE_THUMBNAILS = ['GH_Defect1.jpg', 'Surface finish marks', 'GH-001 Drawing'];

// D2 - Containment Action
const RESPONSIBLE_PERSONS = ['Pradeep', 'Dheena', 'Ganga', 'Kannan P', 'Indrakumar'];
const DEPARTMENTS_D2 = ['Production', 'Quality', 'Engineering', 'Supply Chain'];
const CONTAINMENT_STATUSES = ['In Progress', 'Completed', 'Pending'];
const CONTAINMENT_RESULTS = ['OK', 'Not OK', 'Pending'];

const CONTAINMENT_ACTION_ROWS = [
  { no: 1, desc: 'Stop shipment of affected batch BH-20260925', type: 'Material Containment', person: 'Pradeep', targetDate: '25-Sep-2026', actualDate: '25-Sep-2026', status: 'Completed', effectiveness: 'Effective', remarks: 'Shipment stopped' },
  { no: 2, desc: '100% inspection of surface finish and dimension', type: 'Inspection', person: 'Dheena', targetDate: '26-Sep-2026', actualDate: '26-Sep-2026', status: 'Completed', effectiveness: 'Effective', remarks: 'No defective found' },
  { no: 3, desc: 'Segregate and hold existing stock', type: 'Stock Control', person: 'Ganga', targetDate: '25-Sep-2026', actualDate: '25-Sep-2026', status: 'Completed', effectiveness: 'Effective', remarks: '500 pcs held' },
  { no: 4, desc: 'Inform customer about issue', type: 'Customer Communication', person: 'Kannan P', targetDate: '26-Sep-2026', actualDate: '26-Sep-2026', status: 'In Progress', effectiveness: 'Pending', remarks: 'Customer notified' },
];

const CONTAINMENT_STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', Pending: 'default' };
const EFFECTIVENESS_COLOR = { Effective: 'success', Pending: 'default', 'Not Effective': 'error' };

const D2_ATTACHMENTS = [
  { name: 'Containment_Action_Plan.pdf', date: '25-Sep-2026', size: '1.2 MB', kind: 'pdf' },
  { name: 'Stock_Hold_Photo.jpg', date: '25-Sep-2026', size: '0.8 MB', kind: 'image' },
];

// D3 - Root Cause Analysis
const ANALYSIS_METHODS = ['5 Why + Fishbone', '5 Why', 'Fishbone (Ishikawa)', 'Pareto Analysis', 'FMEA'];
const ROOT_CAUSE_CATEGORIES = ['Man, Machine, Method, Material', 'Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'];
const ROOT_CAUSE_CATEGORY_CHIP_COLOR = { Method: 'warning', Machine: 'info', Man: 'primary', Material: 'error', Measurement: 'info', Environment: 'success' };

const FISHBONE_TOP = [
  { label: 'Man', color: '#e3f2fd', border: '#1976d2', causes: ['Operator not followed SOP', 'Inadequate training'] },
  { label: 'Machine', color: '#e8f5e9', border: '#2e7d32', causes: ['Spindle runout', 'Tool wear'] },
  { label: 'Method', color: '#fff8e1', border: '#ed6c02', causes: ['No tool inspection', 'Incorrect setup'] },
];
const FISHBONE_BOTTOM = [
  { label: 'Material', color: '#ffebee', border: '#d32f2f', causes: ['Material variation', 'Casting defects'] },
  { label: 'Measurement', color: '#e3f2fd', border: '#1976d2', causes: ['Inaccurate dimension check', 'Wrong gauge'] },
  { label: 'Environment', color: '#e8f5e9', border: '#2e7d32', causes: ['Poor lighting', 'Temperature variation'] },
];
const FISHBONE_EFFECT = 'Dimensional Variation';

function FishboneDiagram() {
  const spineY = 140;
  const spineX1 = 50;
  const spineX2 = 600;
  const convX = [160, 330, 500];
  const topHeaderY = 28;
  const bottomHeaderY = 252;

  const lerp = (a, b, t) => a + (b - a) * t;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg viewBox="0 0 760 280" width="100%" height="280" style={{ minWidth: 640 }}>
        {/* Spine */}
        <line x1={spineX1} y1={spineY} x2={spineX2} y2={spineY} stroke="#64748b" strokeWidth={2} />
        <polygon points={`${spineX2 - 14},${spineY - 10} ${spineX2 - 14},${spineY + 10} ${spineX2},${spineY}`} fill="#64748b" />

        {/* Effect box */}
        <rect x={spineX2} y={spineY - 30} width={140} height={60} rx={8} fill="#e3f2fd" stroke="#1976d2" strokeWidth={1.5} />
        <text x={spineX2 + 70} y={spineY - 2} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0d47a1">
          {FISHBONE_EFFECT.split(' ')[0]}
        </text>
        <text x={spineX2 + 70} y={spineY + 14} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0d47a1">
          {FISHBONE_EFFECT.split(' ').slice(1).join(' ')}
        </text>

        {/* Top branches */}
        {FISHBONE_TOP.map((cat, i) => {
          const cx = convX[i];
          const hx = cx - 150;
          return (
            <g key={cat.label}>
              <line x1={hx} y1={topHeaderY + 14} x2={cx} y2={spineY} stroke="#94a3b8" strokeWidth={1.5} />
              <rect x={hx - 32} y={topHeaderY - 14} width={88} height={22} rx={4} fill={cat.color} stroke={cat.border} strokeWidth={1} />
              <text x={hx + 12} y={topHeaderY + 1} textAnchor="middle" fontSize={12} fontWeight={700} fill={cat.border}>{cat.label}</text>
              {cat.causes.map((c, ci) => {
                const t = 0.32 + ci * 0.32;
                const px = lerp(hx, cx, t);
                const py = lerp(topHeaderY + 14, spineY, t);
                return (
                  <g key={c}>
                    <line x1={px - 6} y1={py + 6} x2={px + 6} y2={py - 6} stroke="#94a3b8" strokeWidth={1} />
                    <text x={px + 8} y={py - 6} fontSize={10.5} fill="#475569">{c}</text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Bottom branches */}
        {FISHBONE_BOTTOM.map((cat, i) => {
          const cx = convX[i];
          const hx = cx - 150;
          return (
            <g key={cat.label}>
              <line x1={hx} y1={bottomHeaderY - 14} x2={cx} y2={spineY} stroke="#94a3b8" strokeWidth={1.5} />
              <rect x={hx - 32} y={bottomHeaderY - 8} width={88} height={22} rx={4} fill={cat.color} stroke={cat.border} strokeWidth={1} />
              <text x={hx + 12} y={bottomHeaderY + 7} textAnchor="middle" fontSize={12} fontWeight={700} fill={cat.border}>{cat.label}</text>
              {cat.causes.map((c, ci) => {
                const t = 0.32 + ci * 0.32;
                const px = lerp(hx, cx, t);
                const py = lerp(bottomHeaderY - 14, spineY, t);
                return (
                  <g key={c}>
                    <line x1={px - 6} y1={py - 6} x2={px + 6} y2={py + 6} stroke="#94a3b8" strokeWidth={1} />
                    <text x={px + 8} y={py + 14} fontSize={10.5} fill="#475569">{c}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

const FIVE_WHY_ROWS = [
  { level: 1, question: 'Why is dimension out of tolerance?', answer: 'Due to machining marks and oversize.' },
  { level: 2, question: 'Why did machining marks occur?', answer: 'Due to excessive tool wear.' },
  { level: 3, question: 'Why was the tool worn?', answer: 'Tool inspection not done as per plan.' },
  { level: 4, question: 'Why was inspection not done?', answer: 'No defined tool check frequency in work instruction.' },
  { level: 5, question: 'Why is there no defined frequency?', answer: 'Control plan not updated after new batch.' },
];

const ROOT_CAUSE_ROWS = [
  { no: 1, cause: 'Tool inspection not performed as per plan', category: 'Method', verified: 'Yes', evidence: 'Inspection records, operator statement', remarks: 'Control plan not updated' },
  { no: 2, cause: 'Excessive tool wear', category: 'Machine', verified: 'Yes', evidence: 'Tool wear report, machining marks on part', remarks: 'Tool life exceeded' },
];

const D3_ATTACHMENTS = [
  { name: 'Fishbone_Analysis.png', date: '26-Sep-2026', size: '0.6 MB', kind: 'image' },
  { name: '5Why_Analysis.pdf', date: '26-Sep-2026', size: '1.2 MB', kind: 'pdf' },
  { name: 'Tool_Wear_Report.jpg', date: '26-Sep-2026', size: '0.8 MB', kind: 'image' },
];

// D4 - Corrective Action
const VERIFICATION_METHODS = ['Dimension inspection, capability study', 'Process capability study', 'Inspection sampling', 'Control chart monitoring'];
const CORRECTIVE_STATUSES = ['Not Started', 'In Progress', 'Completed'];
const CORRECTIVE_STATUS_COLOR = { 'Not Started': 'error', 'In Progress': 'warning', Completed: 'success' };

const CORRECTIVE_ACTION_ROWS = [
  { no: 1, action: 'Implement tool inspection checklist', type: 'Process', person: 'Ganga', targetDate: '05-Oct-2026', actualDate: '-', status: 'In Progress', effectiveness: '-', remarks: 'Checklist created and training planned' },
  { no: 2, action: 'Operator re-training on machining process', type: 'Man', person: 'Dheena', targetDate: '07-Oct-2026', actualDate: '-', status: 'Not Started', effectiveness: '-', remarks: 'Training session scheduled' },
  { no: 3, action: 'Machine maintenance and alignment', type: 'Machine', person: 'Pradeep', targetDate: '10-Oct-2026', actualDate: '-', status: 'Not Started', effectiveness: '-', remarks: 'Prevent tool wear and vibration' },
];

const D4_ATTACHMENTS = [
  { no: 1, name: 'Corrective_Action_Plan.pdf', desc: 'Detailed CAPA plan', uploadedOn: '28-Sep-2026' },
  { no: 2, name: 'Training_Plan.jpg', desc: 'Operator training plan', uploadedOn: '28-Sep-2026' },
];

// D5 - Verify Effectiveness
const D5_VERIFICATION_METHODS = ['Production Trial + Inspection + Customer Feedback', 'Production Trial', 'Customer Feedback', 'Process Capability Study'];
const D5_STATUSES = ['In Progress', 'Completed'];

const EFFECTIVENESS_DATA_ROWS = [
  { parameter: 'Defect Quantity (Nos)', before: '12', after: '0', target: '0', result: 'Achieved' },
  { parameter: 'Defect %', before: '12.00%', after: '0.00%', target: '< 1.00%', result: 'Achieved' },
  { parameter: 'Customer Complaints', before: '3', after: '0', target: '0', result: 'Achieved' },
  { parameter: 'Rejection Cost (₹)', before: '25,000', after: '0', target: '0', result: 'Achieved' },
  { parameter: 'Process Capability (Cpk)', before: '0.85', after: '1.45', target: '> 1.33', result: 'Achieved' },
];

const DEFECT_TREND_DATA = [
  { batch: 'Batch-1', before: 15, after: 0 },
  { batch: 'Batch-2', before: 12, after: 0 },
  { batch: 'Batch-3', before: 10, after: 0 },
  { batch: 'Batch-4', before: 0, after: 0 },
  { batch: 'Batch-5', before: 0, after: 0 },
];

const VERIFICATION_ACTIVITY_ROWS = [
  { no: 1, desc: 'Inspect 3 consecutive batches', plannedDate: '06-Oct-2026', actualDate: '08-Oct-2026', person: 'Dheena', status: 'Completed', remarks: 'No defects found' },
  { no: 2, desc: 'Process capability study', plannedDate: '10-Oct-2026', actualDate: '12-Oct-2026', person: 'Pradeep', status: 'Completed', remarks: 'Cpk 1.45 achieved' },
  { no: 3, desc: 'Customer feedback', plannedDate: '15-Oct-2026', actualDate: '16-Oct-2026', person: 'Ganga', status: 'Completed', remarks: 'Customer confirmed OK' },
];

const D5_ATTACHMENTS = [
  { name: 'Before_After_Defect_Chart.png', date: '20-Oct-2026', size: '0.6 MB', kind: 'pdf' },
  { name: 'Customer_Feedback.pdf', date: '20-Oct-2026', size: '1.2 MB', kind: 'image' },
];

const SCOPE_OF_PREVENTION_OPTIONS = ['Similar products / Future production', 'Same product line only', 'All production lines', 'Supplier processes'];
const PREVENTIVE_ACTION_CATEGORIES = ['Process Improvement', 'Design Change', 'Training', 'Documentation Update', 'Supplier Development'];
const RELATED_PROCESS_OPTIONS = ['Machining', 'Assembly', 'Inspection', 'Packing', 'Procurement'];
const D6_STATUSES = ['Not Started', 'In Progress', 'Completed'];

const PREVENTIVE_ACTION_ROWS = [
  { no: 1, risk: 'Tool wear in similar machining components', action: 'Revise tool inspection checklist and frequency', doc: 'WI-MACH-015', person: 'Dheena', targetDate: '20-Oct-2026', status: 'Completed', implDate: '18-Oct-2026', remarks: 'Checklist updated' },
  { no: 2, risk: 'Incorrect program setup', action: 'Add program verification step in SOP', doc: 'SOP-MACH-022', person: 'Pradeep', targetDate: '25-Oct-2026', status: 'In Progress', implDate: '-', remarks: 'Training ongoing' },
  { no: 3, risk: 'Lack of operator skill', action: 'Conduct operator training for similar parts', doc: 'TRN-MACH-010', person: 'Ganga', targetDate: '28-Oct-2026', status: 'Not Started', implDate: '-', remarks: 'Schedule training' },
  { no: 4, risk: 'No periodic audit', action: 'Include in layer process audit', doc: 'LPA-PLAN-003', person: 'Kannan P', targetDate: '31-Oct-2026', status: 'Not Started', implDate: '-', remarks: 'Add in audit plan' },
];
const PREVENTIVE_STATUS_COLOR = { 'Not Started': 'error', 'In Progress': 'warning', Completed: 'success' };

const RISK_ASSESSMENT_ROWS = [
  { no: 1, product: 'Gear Cover (Machined)', risk: 'High', required: 'Yes', status: 'Planned' },
  { no: 2, product: 'Bearing Housing', risk: 'Medium', required: 'Yes', status: 'Planned' },
  { no: 3, product: 'Pump Body', risk: 'Low', required: 'No', status: 'NA' },
  { no: 4, product: 'Valve Housing', risk: 'Medium', required: 'Yes', status: 'Planned' },
];
const RISK_LEVEL_COLOR = { High: 'error', Medium: 'warning', Low: 'success' };

const D6_ATTACHMENTS = [
  { no: 1, name: 'Updated_SOP.pdf', desc: 'Revised machining SOP', uploadedOn: '10-Oct-2026' },
  { no: 2, name: 'Training_Plan.pdf', desc: 'Operator training plan', uploadedOn: '10-Oct-2026' },
];

const CLOSURE_VERIFICATION_STATUSES = ['Effective - Closed', 'Pending Verification', 'Reopened'];
const FINAL_RESULT_OPTIONS = ['Problem Eliminated', 'Problem Reduced', 'Problem Recurring'];
const CUSTOMER_NOTIFICATION_OPTIONS = ['Yes', 'No'];
const CUSTOMER_FEEDBACK_OPTIONS = ['Satisfied', 'Neutral', 'Dissatisfied', 'Pending'];
const RECOGNITION_TYPE_OPTIONS = ['Team Appreciation', 'Individual Award', 'Certificate', 'Monetary Reward'];

const TEAM_RECOGNITION_ROWS = [
  { no: 1, member: 'Pradeep', dept: 'Production', role: 'Team Leader', recognition: 'Certificate + Appreciation' },
  { no: 2, member: 'Dheena', dept: 'Quality', role: 'Analysis Lead', recognition: 'Certificate' },
  { no: 3, member: 'Ganga', dept: 'Production', role: 'Implementation Lead', recognition: 'Appreciation' },
  { no: 4, member: 'Kannan P', dept: 'Process Engg.', role: 'Support', recognition: 'Appreciation' },
];

const D7_ATTACHMENTS = [
  { no: 1, name: 'Customer_Feedback.pdf', desc: 'Customer feedback mail', uploadedOn: '29-Oct-2026' },
  { no: 2, name: 'Team_Appreciation.jpg', desc: 'Team appreciation photo', uploadedOn: '31-Oct-2026' },
  { no: 3, name: 'Closure_Report.pdf', desc: '8D closure report', uploadedOn: '31-Oct-2026' },
];

const RECIPIENT_OPTIONS = ['Customer, Internal Team', 'Customer Only', 'Internal Team Only'];
const EMAIL_TEMPLATE_OPTIONS = ['8D Closure Notification', 'Customer Thank You', 'Internal Closure Summary'];

const KNOWLEDGE_TYPE_OPTIONS = ['Process / Quality', 'Design', 'Material', 'Training'];
const APPLICATION_SCOPE_OPTIONS = ['Similar Products / All Lines', 'Same Product Line Only', 'All Production Lines'];
const STANDARDIZATION_REQUIRED_OPTIONS = ['Yes', 'No'];
const D8_STATUSES = ['In Progress', 'Completed'];

const LESSONS_LEARNED_ROWS = [
  { no: 1, lesson: 'Tool inspection checklist to be mandatory', category: 'Process', application: 'Gear housing & similar parts', person: 'Pradeep', targetDate: '10-Nov-2026', status: 'Implemented' },
  { no: 2, lesson: 'Operator skill training on machining marks', category: 'Man', application: 'All machining operators', person: 'Dheena', targetDate: '15-Nov-2026', status: 'Implemented' },
  { no: 3, lesson: 'Enhanced SOP with clear tolerance points', category: 'Method', application: 'Machining process', person: 'Ganga', targetDate: '20-Nov-2026', status: 'Implemented' },
  { no: 4, lesson: 'Include in PFMEA and Control Plan', category: 'System', application: 'New product development', person: 'Kannan P', targetDate: '30-Nov-2026', status: 'Planned' },
];
const LESSON_STATUS_COLOR = { Planned: 'warning', Implemented: 'success' };

const STANDARDIZATION_DOC_ROWS = [
  { no: 1, type: 'SOP', docNo: 'SOP-MACH-015', desc: 'Revised machining inspection SOP', updatedOn: '31-Oct-2026' },
  { no: 2, type: 'Work Instruction', docNo: 'WI-MACH-020', desc: 'Tool inspection work instruction', updatedOn: '31-Oct-2026' },
  { no: 3, type: 'Control Plan', docNo: 'CP-FG-001', desc: 'Updated control plan with key characteristics', updatedOn: '31-Oct-2026' },
  { no: 4, type: 'Training Material', docNo: 'TRN-MACH-010', desc: 'Operator training presentation', updatedOn: '31-Oct-2026' },
];

const SIMILAR_PRODUCT_ROWS = [
  { no: 1, code: 'FG-002', name: 'Bearing Housing', process: 'Machining' },
  { no: 2, code: 'FG-003', name: 'Pump Body', process: 'Machining' },
  { no: 3, code: 'FG-004', name: 'Valve Housing', process: 'Machining' },
];

export default function NewEightD() {
  const navigate = useNavigate();
  const notify = useNotify();

  // General Information
  const [eightDType, setEightDType] = useState('Customer Complaint');
  const [source, setSource] = useState('Customer');
  const [customer, setCustomer] = useState('ABC Industries Pvt Ltd');
  const [contactPerson, setContactPerson] = useState('Mr. Ravi Kumar');
  const [itemCode, setItemCode] = useState('FG-001');
  const [itemName, setItemName] = useState('Gear Housing');
  const [batchLotNo, setBatchLotNo] = useState('BH-20260925');
  const [quantity, setQuantity] = useState('100');
  const [complaintDate, setComplaintDate] = useState('25-Sep-2026');

  const [targetCloseDate, setTargetCloseDate] = useState('25-Oct-2026');
  const [priority, setPriority] = useState('High');
  const [department, setDepartment] = useState('Production');
  const [reportedBy, setReportedBy] = useState('Customer');
  const [responsiblePerson, setResponsiblePerson] = useState('Kannan P');
  const [teamMembers, setTeamMembers] = useState(['Dheena', 'Pradeep', 'Quality Team']);
  const [problemDescription, setProblemDescription] = useState('Gear housing surface finish not as per specification. Customer reported machining marks and dimensional variation.');
  const [customerRequirement, setCustomerRequirement] = useState('Surface finish Ra 3.2 and dimension 80.00 ±0.05 mm as per drawing GH-001.');
  const [remarks, setRemarks] = useState('Initiated 8D to analyze root cause and implement corrective actions.');

  const removeTeamMember = (name) => setTeamMembers((prev) => prev.filter((m) => m !== name));

  // D0 - Plan & Team
  const [activeStep, setActiveStep] = useState(0);
  const [teamLeader, setTeamLeader] = useState('Kannan P');
  const [initialProblemStatement, setInitialProblemStatement] = useState('Gear housing surface finish not as per specification. Customer reported machining marks and dimensional variation.');
  const [customerExpectation, setCustomerExpectation] = useState('Surface finish Ra 3.2 and dimension 80.00 ±0.05 mm as per drawing GH-001.');
  const [eightDObjective, setEightDObjective] = useState('Identify root cause, implement permanent corrective action and prevent recurrence.');
  const [kickoffDate, setKickoffDate] = useState('26-Sep-2026');
  const [plannedReviewDate, setPlannedReviewDate] = useState('30-Sep-2026');

  // D1 - Problem Description
  const [d1ProblemDetectedOn, setD1ProblemDetectedOn] = useState('25-Sep-2026');
  const [d1DetectedBy, setD1DetectedBy] = useState('Customer Inspection');
  const [d1WhereDetected, setD1WhereDetected] = useState('At Customer Site');
  const [d1ProblemDescription, setD1ProblemDescription] = useState('Gear housing surface finish not as per specification. Customer reported machining marks and dimensional variation beyond specified tolerance.');
  const [d1ProblemCategory, setD1ProblemCategory] = useState('Dimensional');
  const [d1DefectType, setD1DefectType] = useState('Machining Marks');
  const [d1NcCategory, setD1NcCategory] = useState('Functional');
  const [d1Severity, setD1Severity] = useState('Major');
  const [d1QtyAffected, setD1QtyAffected] = useState('100');
  const [d1QtyAffectedUnit, setD1QtyAffectedUnit] = useState('Nos');
  const [d1DefectQty, setD1DefectQty] = useState('12');
  const [d1DefectQtyUnit, setD1DefectQtyUnit] = useState('Nos');
  const [d1DefectPct, setD1DefectPct] = useState('12.00');
  const [d1Copq, setD1Copq] = useState('25,000.00');
  const [d1ContainmentNeed, setD1ContainmentNeed] = useState('Yes');
  const [d1ImmediateAction, setD1ImmediateAction] = useState('Stop further shipment. Initiate 100% inspection and hold stock.');
  const [d1RelatedNcr, setD1RelatedNcr] = useState('NCR-2026-015');
  const [d1RelatedInspection, setD1RelatedInspection] = useState('INSP-2026-078');
  const [d1RelatedSalesOrder, setD1RelatedSalesOrder] = useState('SO-2026-045');
  const [d1Remarks, setD1Remarks] = useState('Problem confirmed with customer drawing and inspection report.');
  const [evidenceChecked, setEvidenceChecked] = useState(() => new Set());
  const toggleOneEvidence = (no) => {
    setEvidenceChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  // D2 - Containment Action
  const [d2ContainmentStartDate, setD2ContainmentStartDate] = useState('25-Sep-2026');
  const [d2ContainmentEndDate, setD2ContainmentEndDate] = useState('30-Sep-2026');
  const [d2ContainmentActionPlan, setD2ContainmentActionPlan] = useState(
    '1. Stop further shipment of affected batch BH-20260925.\n2. 100% inspection of gear housing surface finish and dimension.\n3. Segregate and hold existing stock in Finished Goods area.\n4. Inform customer about the issue and revised delivery plan.'
  );
  const [d2ResponsiblePerson, setD2ResponsiblePerson] = useState('Pradeep');
  const [d2Department, setD2Department] = useState('Production');
  const [d2Priority, setD2Priority] = useState('High');
  const [d2Status, setD2Status] = useState('In Progress');
  const [d2EffectivenessCheckDate, setD2EffectivenessCheckDate] = useState('30-Sep-2026');
  const [d2ContainmentResult, setD2ContainmentResult] = useState('OK');
  const [d2Remarks, setD2Remarks] = useState('Containment actions implemented as per plan. No further shipment. Stock held and under 100% inspection.');
  const [containmentChecked, setContainmentChecked] = useState(() => new Set());
  const toggleOneContainment = (no) => {
    setContainmentChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  // D3 - Root Cause Analysis
  const [d3AnalysisTeam, setD3AnalysisTeam] = useState(['Dheena', 'Pradeep', 'Ganga']);
  const [d3AnalysisMethod, setD3AnalysisMethod] = useState('5 Why + Fishbone');
  const [d3RootCauseCategory, setD3RootCauseCategory] = useState('Man, Machine, Method, Material');
  const [d3AnalysisStartDate, setD3AnalysisStartDate] = useState('26-Sep-2026');
  const [d3AnalysisEndDate, setD3AnalysisEndDate] = useState('28-Sep-2026');
  const [d3IdentifiedRootCauses, setD3IdentifiedRootCauses] = useState('Incorrect machining dimension due to tool wear and missing tool inspection.');
  const [d3Remarks, setD3Remarks] = useState('Root cause verified with machining samples, tool inspection records and operator interview.');
  const removeAnalysisTeamMember = (name) => setD3AnalysisTeam((prev) => prev.filter((m) => m !== name));
  const [rootCauseChecked, setRootCauseChecked] = useState(() => new Set());
  const toggleOneRootCause = (no) => {
    setRootCauseChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  // D4 - Corrective Action
  const [d4RootCauses, setD4RootCauses] = useState('Incorrect machining dimension, tool wear');
  const [d4StartDate, setD4StartDate] = useState('28-Sep-2026');
  const [d4TargetCompletionDate, setD4TargetCompletionDate] = useState('10-Oct-2026');
  const [d4ResponsiblePerson, setD4ResponsiblePerson] = useState('Ganga');
  const [d4Department, setD4Department] = useState('Production');
  const [d4Priority, setD4Priority] = useState('High');
  const [d4Status, setD4Status] = useState('In Progress');
  const [d4VerificationMethod, setD4VerificationMethod] = useState('Dimension inspection, capability study');
  const [d4ExpectedResult, setD4ExpectedResult] = useState('Eliminate machining dimension issue permanently');
  const [d4Remarks, setD4Remarks] = useState('Implement tool inspection checklist, operator training and machine maintenance schedule.');
  const [correctiveChecked, setCorrectiveChecked] = useState(() => new Set());
  const toggleOneCorrective = (no) => {
    setCorrectiveChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d4AttachChecked, setD4AttachChecked] = useState(() => new Set());
  const toggleOneD4Attach = (no) => {
    setD4AttachChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d4VerificationDate, setD4VerificationDate] = useState('');
  const [d4VerifiedBy, setD4VerifiedBy] = useState('');
  const [d4VerificationResult, setD4VerificationResult] = useState('To be verified');
  const [d4VerificationRemarks, setD4VerificationRemarks] = useState('');

  // D5 - Verify Effectiveness
  const [d5VerificationStartDate, setD5VerificationStartDate] = useState('05-Oct-2026');
  const [d5VerificationEndDate, setD5VerificationEndDate] = useState('20-Oct-2026');
  const [d5VerificationMethod, setD5VerificationMethod] = useState('Production Trial + Inspection + Customer Feedback');
  const [d5ResponsiblePerson, setD5ResponsiblePerson] = useState('Pradeep');
  const [d5Department, setD5Department] = useState('Production');
  const [d5Status, setD5Status] = useState('In Progress');
  const [d5TargetCriteria, setD5TargetCriteria] = useState('Zero defect in 3 consecutive batches');
  const [d5ActualResult, setD5ActualResult] = useState('No defects observed in 3 batches. Customer confirmed OK.');
  const [d5Remarks, setD5Remarks] = useState('Corrective action effective and problem resolved. Monitoring continued for next 1 month.');
  const [verificationActivityChecked, setVerificationActivityChecked] = useState(() => new Set());
  const toggleOneVerificationActivity = (no) => {
    setVerificationActivityChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d5EffectivenessConfirmed, setD5EffectivenessConfirmed] = useState('Yes');
  const [d5ConfirmationDate, setD5ConfirmationDate] = useState('20-Oct-2026');
  const [d5ConfirmedBy, setD5ConfirmedBy] = useState('Kannan P');
  const [d5ConfirmRemarks, setD5ConfirmRemarks] = useState('Corrective action verified effective and problem does not recur.');

  // D6 - Prevent Recurrence
  const [d6ScopeOfPrevention, setD6ScopeOfPrevention] = useState('Similar products / Future production');
  const [d6ImplementationStartDate, setD6ImplementationStartDate] = useState('10-Oct-2026');
  const [d6ImplementationTargetDate, setD6ImplementationTargetDate] = useState('31-Oct-2026');
  const [d6ResponsiblePerson, setD6ResponsiblePerson] = useState('Pradeep');
  const [d6Department, setD6Department] = useState('Production');
  const [d6PreventiveActionCategory, setD6PreventiveActionCategory] = useState('Process Improvement');
  const [d6RelatedProcess, setD6RelatedProcess] = useState('Machining');
  const [d6RelatedDocuments, setD6RelatedDocuments] = useState('SOP, Work Instruction, Control Plan');
  const [d6Status, setD6Status] = useState('In Progress');
  const [d6Remarks, setD6Remarks] = useState('Update machining SOP, enhance tool inspection checklist and apply for all similar components.');
  const [preventiveActionChecked, setPreventiveActionChecked] = useState(() => new Set());
  const toggleOnePreventiveAction = (no) => {
    setPreventiveActionChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d6ReviewDate, setD6ReviewDate] = useState('15-Nov-2026');
  const [d6ReviewedBy, setD6ReviewedBy] = useState('Kannan P');
  const [d6FollowUpStatus, setD6FollowUpStatus] = useState('Open');
  const [d6FollowUpRemarks, setD6FollowUpRemarks] = useState('Will review implementation status and check for recurrence.');

  // D7 - Close & Congratulate
  const [d7ClosureDate, setD7ClosureDate] = useState('31-Oct-2026');
  const [d7VerificationStatus, setD7VerificationStatus] = useState('Effective - Closed');
  const [d7FinalResult, setD7FinalResult] = useState('Problem Eliminated');
  const [d7TeamLeader, setD7TeamLeader] = useState('Pradeep');
  const [d7Department, setD7Department] = useState('Production');
  const [d7CustomerNotification, setD7CustomerNotification] = useState('Yes');
  const [d7CustomerFeedback, setD7CustomerFeedback] = useState('Satisfied');
  const [d7RecognitionType, setD7RecognitionType] = useState('Team Appreciation');
  const [d7AppreciationMessage, setD7AppreciationMessage] = useState('Team effort successfully eliminated the machining dimension issue and improved inspection process.');
  const [teamRecognitionChecked, setTeamRecognitionChecked] = useState(() => new Set());
  const toggleOneTeamRecognition = (no) => {
    setTeamRecognitionChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d7AttachChecked, setD7AttachChecked] = useState(() => new Set());
  const toggleOneD7Attach = (no) => {
    setD7AttachChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d7FeedbackDate, setD7FeedbackDate] = useState('29-Oct-2026');
  const [d7FeedbackReceivedFrom, setD7FeedbackReceivedFrom] = useState('Mr. Ravi - Production Head');
  const [d7FeedbackSummary, setD7FeedbackSummary] = useState('Issue resolved. No further complaints. Improved inspection process is effective.');
  const [d7CustomerSatisfaction, setD7CustomerSatisfaction] = useState(4);
  const [d7CustomerComments, setD7CustomerComments] = useState('Good support and quick response from the team.');
  const [d7Recipients, setD7Recipients] = useState('Customer, Internal Team');
  const [d7EmailTemplate, setD7EmailTemplate] = useState('8D Closure Notification');
  const [d7SendDate, setD7SendDate] = useState('31-Oct-2026');
  const [d7ClosureRemarks, setD7ClosureRemarks] = useState('Closure mail sent to customer and internal stakeholders.');

  // D8 - Lessons Learned
  const [d8LessonsLearnedDate, setD8LessonsLearnedDate] = useState('31-Oct-2026');
  const [d8PreparedBy, setD8PreparedBy] = useState('Kannan P');
  const [d8Department, setD8Department] = useState('Production');
  const [d8KnowledgeType, setD8KnowledgeType] = useState('Process / Quality');
  const [d8ApplicationScope, setD8ApplicationScope] = useState('Similar Products / All Lines');
  const [d8StandardizationRequired, setD8StandardizationRequired] = useState('Yes');
  const [d8Status, setD8Status] = useState('Completed');
  const [d8Remarks, setD8Remarks] = useState('Added new tool inspection checklist, operator training and standard work instruction. Applied to all similar components.');
  const [lessonChecked, setLessonChecked] = useState(() => new Set());
  const toggleOneLesson = (no) => {
    setLessonChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [docChecked, setDocChecked] = useState(() => new Set());
  const toggleOneDoc = (no) => {
    setDocChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [similarProductChecked, setSimilarProductChecked] = useState(() => new Set());
  const toggleOneSimilarProduct = (no) => {
    setSimilarProductChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const [d8EightDStatus, setD8EightDStatus] = useState('Closed');
  const [d8ClosureDate, setD8ClosureDate] = useState('31-Oct-2026');
  const [d8ApprovedBy, setD8ApprovedBy] = useState('Kannan P');
  const [d8CompletionRemarks, setD8CompletionRemarks] = useState('8D completed. Lessons learned implemented and applied to similar products.');

  const handleBackToList = () => navigate('/quality/8d');
  const handleSave = () => notify.success('8D saved.');
  const handleSaveAndNew = () => notify.success('8D saved. Ready for a new entry.');
  const handleSubmit = () => {
    notify.success('8D submitted.');
    navigate('/quality/8d');
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>

    </Stack>
  );

  const isLastStep = activeStep === D_STEPS.length - 1;

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={handleBackToList}>Back to List</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={handleSave}>Save</Button>
        <Button variant="outlined" startIcon={<LibraryAddOutlinedIcon />} onClick={handleSaveAndNew}>Save &amp; New</Button>
        {isLastStep ? (
          <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={handleSubmit}>Submit</Button>
        ) : (
          <Button variant="contained" endIcon={<ArrowForwardOutlinedIcon />} onClick={() => setActiveStep((s) => Math.min(s + 1, D_STEPS.length - 1))}>
            Next ({D_STEPS[activeStep + 1].code})
          </Button>
        )}
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<FactCheckOutlinedIcon />}
        title="New 8D"
        subtitle="Create and manage 8D for internal, customer or supplier quality issues."
        rightContent={headerActions}
      />

      {/* General Information */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <FactCheckOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>1. General Information</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField fullWidth size="small" label="8D No." value="Auto" InputProps={{ readOnly: true }} />
                <TextField fullWidth size="small" required select label="8D Type" value={eightDType} onChange={(e) => setEightDType(e.target.value)}>
                  {EIGHT_D_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" required select label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
                  {SOURCES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField
                  fullWidth size="small" required label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" select label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}>
                  <MenuItem value="Mr. Ravi Kumar">Mr. Ravi Kumar</MenuItem>
                </TextField>
                <TextField
                  fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                <TextField fullWidth size="small" label="Batch / Lot No." value={batchLotNo} onChange={(e) => setBatchLotNo(e.target.value)} />
                <TextField fullWidth size="small" required label="Quantity (Nos)" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                <TextField
                  fullWidth size="small" required label="Complaint Date" value={complaintDate} onChange={(e) => setComplaintDate(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" required label="Target Close Date" value={targetCloseDate} onChange={(e) => setTargetCloseDate(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" required select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}
                  sx={priority === 'High' ? { '& .MuiOutlinedInput-root': { bgcolor: 'error.lighter' } } : undefined}
                >
                  {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" required select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" required select label="Reported By" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)}>
                  {REPORTED_BY_OPTIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
                <TextField
                  fullWidth size="small" required label="Responsible Person" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Team Members *</Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    {teamMembers.map((m) => (
                      <Chip key={m} size="small" label={m} onDelete={() => removeTeamMember(m)} />
                    ))}
                    <IconButton size="small" edge="end" sx={{ ml: 'auto' }}><SearchIcon fontSize="small" /></IconButton>
                  </Stack>
                </Box>
                <TextField fullWidth size="small" required multiline minRows={2} label="Problem Description" value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} />
                <TextField fullWidth size="small" multiline minRows={2} label="Customer Requirement" value={customerRequirement} onChange={(e) => setCustomerRequirement(e.target.value)} />
                <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* D-Step Tabs */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {D_STEPS.map((step, idx) => (
              <Button
                key={step.code}
                variant={activeStep === idx ? 'contained' : 'outlined'}
                onClick={() => setActiveStep(idx)}
                sx={{ flexDirection: 'column', lineHeight: 1.3, py: 0.75, minWidth: 92 }}
              >
                <Typography variant="body2" fontWeight={700} component="span">{step.code}</Typography>
                <Typography variant="caption" component="span" sx={{ textTransform: 'none' }}>{step.label}</Typography>
              </Button>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* D-Step Content */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={0.25} sx={{ mb: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              {activeStep === 1 ? <DescriptionOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 2 ? <HealthAndSafetyOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 3 ? <TroubleshootOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 4 ? <BuildCircleOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 5 ? <VerifiedUserOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 6 ? <GppGoodOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 7 ? <EmojiEventsOutlinedIcon color="primary" fontSize="small" />
                : activeStep === 8 ? <MenuBookOutlinedIcon color="primary" fontSize="small" />
                : <GroupsOutlinedIcon color="primary" fontSize="small" />}
              <Typography variant="subtitle1" fontWeight={700}>
                {D_STEPS[activeStep].code} - {D_STEPS[activeStep].code === 'D0' ? 'Plan & Form Team' : D_STEPS[activeStep].label}
              </Typography>
            </Stack>
            {activeStep === 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Clearly describe the problem using facts, data and evidence.
              </Typography>
            )}
            {activeStep === 2 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Define and implement immediate containment actions to protect customer and prevent further occurrence.
              </Typography>
            )}
            {activeStep === 3 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Identify and verify the root cause(s) using appropriate analysis tools (5-Why, Fishbone, etc.).
              </Typography>
            )}
            {activeStep === 4 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Define, plan and implement permanent corrective actions to eliminate the root cause(s).
              </Typography>
            )}
            {activeStep === 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Verify that the implemented corrective actions have eliminated the root cause(s) and the problem does not recur.
              </Typography>
            )}
            {activeStep === 6 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Define and implement actions to prevent recurrence of similar problems in the future.
              </Typography>
            )}
            {activeStep === 7 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Recognize the team efforts, formally close the 8D and communicate the success.
              </Typography>
            )}
            {activeStep === 8 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Document the lessons learned and apply them to similar products, processes or projects to prevent recurrence.
              </Typography>
            )}
          </Stack>

          {activeStep === 0 ? (
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <TextField
                    fullWidth size="small" required label="Team Leader" value={teamLeader} onChange={(e) => setTeamLeader(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Team Members *</Typography>
                    <ScrollableTableContainer maxHeight="clamp(140px, calc(100vh - 900px), 240px)">
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                            <TableCell>S.No</TableCell>
                            <TableCell>Employee</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {TEAM_MEMBER_ROWS.map((m) => (
                            <TableRow key={m.no} hover>
                              <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
                              <TableCell>{m.no}</TableCell>
                              <TableCell>{m.name}</TableCell>
                              <TableCell>{m.dept}</TableCell>
                              <TableCell>{m.role}</TableCell>
                              <TableCell>
                                <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                  </Box>
                  <Button variant="contained" startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start' }}>Add Member</Button>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <TextField fullWidth size="small" required multiline minRows={2} label="Initial Problem Statement" value={initialProblemStatement} onChange={(e) => setInitialProblemStatement(e.target.value)} />
                  <TextField fullWidth size="small" multiline minRows={2} label="Customer Expectation" value={customerExpectation} onChange={(e) => setCustomerExpectation(e.target.value)} />
                  <TextField fullWidth size="small" multiline minRows={2} label="8D Objective" value={eightDObjective} onChange={(e) => setEightDObjective(e.target.value)} />
                  <TextField
                    fullWidth size="small" required label="Kick-off Date" value={kickoffDate} onChange={(e) => setKickoffDate(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <TextField
                    fullWidth size="small" label="Planned Review Date" value={plannedReviewDate} onChange={(e) => setPlannedReviewDate(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Stack>
              </Grid>
            </Grid>
          ) : activeStep === 1 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Batch / Lot No." value={batchLotNo} onChange={(e) => setBatchLotNo(e.target.value)} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Problem Detected On" value={d1ProblemDetectedOn} onChange={(e) => setD1ProblemDetectedOn(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" select label="Detected By" value={d1DetectedBy} onChange={(e) => setD1DetectedBy(e.target.value)}>
                      {DETECTED_BY_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Where Detected" value={d1WhereDetected} onChange={(e) => setD1WhereDetected(e.target.value)}>
                      {WHERE_DETECTED_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Problem Category" value={d1ProblemCategory} onChange={(e) => setD1ProblemCategory(e.target.value)}>
                      {PROBLEM_CATEGORIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Defect Type" value={d1DefectType} onChange={(e) => setD1DefectType(e.target.value)}>
                      {DEFECT_TYPES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Non Conformance Category" value={d1NcCategory} onChange={(e) => setD1NcCategory(e.target.value)}>
                      {NC_CATEGORIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Severity" value={d1Severity} onChange={(e) => setD1Severity(e.target.value)}
                      sx={d1Severity === 'Major' || d1Severity === 'Critical' ? { '& .MuiOutlinedInput-root': { bgcolor: 'error.lighter' } } : undefined}
                    >
                      {SEVERITIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" label="Quantity Affected" value={d1QtyAffected} onChange={(e) => setD1QtyAffected(e.target.value)} />
                      <TextField size="small" select value={d1QtyAffectedUnit} onChange={(e) => setD1QtyAffectedUnit(e.target.value)} sx={{ width: 100 }}>
                        {QTY_UNIT_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" label="Defect Quantity" value={d1DefectQty} onChange={(e) => setD1DefectQty(e.target.value)} />
                      <TextField size="small" select value={d1DefectQtyUnit} onChange={(e) => setD1DefectQtyUnit(e.target.value)} sx={{ width: 100 }}>
                        {QTY_UNIT_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <TextField
                      fullWidth size="small" label="Defect %" value={d1DefectPct} onChange={(e) => setD1DefectPct(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" label="Cost of Poor Quality (Est.)" value={d1Copq} onChange={(e) => setD1Copq(e.target.value)}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    />
                  </Stack>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2.5 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Problem Description *</Typography>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Stack direction="row" spacing={0.25} sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <IconButton size="small"><FormatBoldIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatItalicIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatUnderlinedIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatListBulletedIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatListNumberedIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><LinkIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><AutoAwesomeOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  <TextField
                    fullWidth size="small" multiline minRows={3} value={d1ProblemDescription} onChange={(e) => setD1ProblemDescription(e.target.value)}
                    variant="standard" InputProps={{ disableUnderline: true, sx: { px: 1.5, py: 1 } }}
                  />
                </Box>
              </Box>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={8}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Evidence / Supporting Data</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add Evidence</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(140px, calc(100vh - 900px), 240px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                          <TableCell>S.No</TableCell>
                          <TableCell>Document Type</TableCell>
                          <TableCell>File Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Uploaded On</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {EVIDENCE_ROWS.map((r) => (
                          <TableRow key={r.no} hover selected={evidenceChecked.has(r.no)}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={evidenceChecked.has(r.no)} onChange={() => toggleOneEvidence(r.no)} />
                            </TableCell>
                            <TableCell>{r.no}</TableCell>
                            <TableCell>{r.type}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="primary.main" fontWeight={600}>{r.fileName}</Typography>
                            </TableCell>
                            <TableCell>{r.desc}</TableCell>
                            <TableCell>{r.uploadedOn}</TableCell>
                            <TableCell>
                              <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>

                  <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    {EVIDENCE_THUMBNAILS.map((caption) => (
                      <Grid item xs={4} key={caption}>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                          <Box sx={{ height: 110, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ImageOutlinedIcon fontSize="large" color="disabled" />
                          </Box>
                          <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ py: 0.5 }}>{caption}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Stack spacing={2.5}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <ShieldOutlinedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={700}>Containment Need</Typography>
                      </Stack>
                      <RadioGroup row value={d1ContainmentNeed} onChange={(e) => setD1ContainmentNeed(e.target.value)} sx={{ mb: 1.5 }}>
                        <FormControlLabel value="Yes" control={<Radio size="small" />} label="Yes" />
                        <FormControlLabel value="No" control={<Radio size="small" />} label="No" />
                      </RadioGroup>
                      <TextField
                        fullWidth size="small" multiline minRows={2} label="Immediate Action Required"
                        value={d1ImmediateAction} onChange={(e) => setD1ImmediateAction(e.target.value)}
                      />
                    </Box>

                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <DescriptionOutlinedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={700}>Reference</Typography>
                      </Stack>
                      <Stack spacing={2}>
                        <TextField
                          fullWidth size="small" label="Related NCR No." value={d1RelatedNcr} onChange={(e) => setD1RelatedNcr(e.target.value)}
                          InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                        />
                        <TextField
                          fullWidth size="small" label="Related Inspection Report" value={d1RelatedInspection} onChange={(e) => setD1RelatedInspection(e.target.value)}
                          InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                        />
                        <TextField
                          fullWidth size="small" label="Related Sales Order" value={d1RelatedSalesOrder} onChange={(e) => setD1RelatedSalesOrder(e.target.value)}
                          InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                        />
                      </Stack>
                    </Box>

                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <ChatBubbleOutlineOutlinedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={700}>Remarks</Typography>
                      </Stack>
                      <TextField fullWidth size="small" multiline minRows={2} value={d1Remarks} onChange={(e) => setD1Remarks(e.target.value)} />
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 2 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Containment Start Date" value={d2ContainmentStartDate} onChange={(e) => setD2ContainmentStartDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Containment End Date" value={d2ContainmentEndDate} onChange={(e) => setD2ContainmentEndDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Responsible Person" value={d2ResponsiblePerson} onChange={(e) => setD2ResponsiblePerson(e.target.value)}>
                      {RESPONSIBLE_PERSONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Department" value={d2Department} onChange={(e) => setD2Department(e.target.value)}>
                      {DEPARTMENTS_D2.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Priority" value={d2Priority} onChange={(e) => setD2Priority(e.target.value)}
                      sx={d2Priority === 'High' ? { '& .MuiOutlinedInput-root': { bgcolor: 'error.lighter' } } : undefined}
                    >
                      {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Status" value={d2Status} onChange={(e) => setD2Status(e.target.value)}
                      sx={
                        d2Status === 'In Progress' ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.lighter' } }
                          : d2Status === 'Completed' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } }
                          : undefined
                      }
                    >
                      {CONTAINMENT_STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" label="Effectiveness Check Date" value={d2EffectivenessCheckDate} onChange={(e) => setD2EffectivenessCheckDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" select label="Containment Result" value={d2ContainmentResult} onChange={(e) => setD2ContainmentResult(e.target.value)}>
                      {CONTAINMENT_RESULTS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2.5 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Containment Action Plan *</Typography>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Stack direction="row" spacing={0.25} sx={{ px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <IconButton size="small"><FormatBoldIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatItalicIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatUnderlinedIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatListBulletedIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><FormatListNumberedIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><LinkIcon fontSize="small" /></IconButton>
                    <IconButton size="small"><AutoAwesomeOutlinedIcon fontSize="small" /></IconButton>
                  </Stack>
                  <TextField
                    fullWidth size="small" multiline minRows={4} value={d2ContainmentActionPlan} onChange={(e) => setD2ContainmentActionPlan(e.target.value)}
                    variant="standard" InputProps={{ disableUnderline: true, sx: { px: 1.5, py: 1, whiteSpace: 'pre-wrap' } }}
                  />
                </Box>
              </Box>

              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 3.5, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ListAltOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Containment Action List ({CONTAINMENT_ACTION_ROWS.length} records)</Typography>
                </Stack>
                <Button variant="contained" startIcon={<AddIcon />}>Add Action</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 820px), 360px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Action Description</TableCell>
                      <TableCell>Action Type</TableCell>
                      <TableCell>Responsible Person</TableCell>
                      <TableCell>Target Date</TableCell>
                      <TableCell>Actual Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Effectiveness</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {CONTAINMENT_ACTION_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={containmentChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={containmentChecked.has(r.no)} onChange={() => toggleOneContainment(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>{r.desc}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.person}</TableCell>
                        <TableCell>{r.targetDate}</TableCell>
                        <TableCell>{r.actualDate}</TableCell>
                        <TableCell><Chip size="small" label={r.status} color={CONTAINMENT_STATUS_COLOR[r.status] || 'default'} /></TableCell>
                        <TableCell><Chip size="small" label={r.effectiveness} color={EFFECTIVENESS_COLOR[r.effectiveness] || 'default'} /></TableCell>
                        <TableCell>{r.remarks}</TableCell>
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

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={8}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Attachments ({D2_ATTACHMENTS.length} files)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add File</Button>
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    {D2_ATTACHMENTS.map((f) => (
                      <Stack key={f.name} direction="row" spacing={1} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                        {f.kind === 'pdf'
                          ? <PictureAsPdfOutlinedIcon color="error" />
                          : <ImageOutlinedIcon color="primary" />}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{f.date} ({f.size})</Typography>
                        </Box>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <ChatBubbleOutlineOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Remarks</Typography>
                  </Stack>
                  <TextField fullWidth size="small" multiline minRows={3} value={d2Remarks} onChange={(e) => setD2Remarks(e.target.value)} />
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 3 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Analysis Team</Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                        {d3AnalysisTeam.map((m) => (
                          <Chip key={m} size="small" label={m} onDelete={() => removeAnalysisTeamMember(m)} />
                        ))}
                        <IconButton size="small" edge="end" sx={{ ml: 'auto' }}><SearchIcon fontSize="small" /></IconButton>
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Analysis Method" value={d3AnalysisMethod} onChange={(e) => setD3AnalysisMethod(e.target.value)}>
                      {ANALYSIS_METHODS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Root Cause Category" value={d3RootCauseCategory} onChange={(e) => setD3RootCauseCategory(e.target.value)}>
                      {ROOT_CAUSE_CATEGORIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" required label="Analysis Start Date" value={d3AnalysisStartDate} onChange={(e) => setD3AnalysisStartDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Analysis End Date" value={d3AnalysisEndDate} onChange={(e) => setD3AnalysisEndDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required multiline minRows={2} label="Identified Root Cause(s)"
                      value={d3IdentifiedRootCauses} onChange={(e) => setD3IdentifiedRootCauses(e.target.value)}
                    />
                  </Stack>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccountTreeOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Fishbone (Ishikawa) Analysis</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={<AddIcon />}>Add Cause</Button>
                      <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }}><OpenInFullOutlinedIcon fontSize="small" /></IconButton>
                    </Stack>
                  </Stack>
                  <FishboneDiagram />
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <QuizOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>5 Why Analysis</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={<AddIcon />}>Add Why</Button>
                      <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }}><OpenInFullOutlinedIcon fontSize="small" /></IconButton>
                    </Stack>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 760px), 400px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Level</TableCell>
                          <TableCell>Question / Why</TableCell>
                          <TableCell>Answer</TableCell>
                          <TableCell>Result</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {FIVE_WHY_ROWS.map((r, idx) => (
                          <TableRow key={r.level} hover>
                            <TableCell>{r.level}</TableCell>
                            <TableCell>{r.question}</TableCell>
                            <TableCell>{r.answer}</TableCell>
                            {idx === 0 && (
                              <TableCell rowSpan={FIVE_WHY_ROWS.length} sx={{ bgcolor: 'success.lighter', verticalAlign: 'middle', textAlign: 'center', minWidth: 140 }}>
                                <Stack spacing={0.5} alignItems="center">
                                  <CheckCircleOutlineIcon color="success" />
                                  <Typography variant="caption" fontWeight={700} color="success.dark">Root Cause Identified</Typography>
                                  <Typography variant="caption" color="text.secondary" align="center">
                                    Tool inspection not performed due to lack of control plan update.
                                  </Typography>
                                </Stack>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 3.5, mb: 1.5 }}>
                <ListAltOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>Root Cause(s) Identified ({ROOT_CAUSE_ROWS.length} records)</Typography>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 860px), 260px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Root Cause</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Verified (Yes/No)</TableCell>
                      <TableCell>Evidence</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ROOT_CAUSE_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={rootCauseChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={rootCauseChecked.has(r.no)} onChange={() => toggleOneRootCause(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{r.cause}</Typography>
                        </TableCell>
                        <TableCell><Chip size="small" label={r.category} color={ROOT_CAUSE_CATEGORY_CHIP_COLOR[r.category] || 'default'} /></TableCell>
                        <TableCell><Chip size="small" label={r.verified} color={r.verified === 'Yes' ? 'success' : 'error'} /></TableCell>
                        <TableCell>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{r.evidence}</Typography>
                        </TableCell>
                        <TableCell>{r.remarks}</TableCell>
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

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={8}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Attachments ({D3_ATTACHMENTS.length} files)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add File</Button>
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    {D3_ATTACHMENTS.map((f) => (
                      <Stack key={f.name} direction="row" spacing={1} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                        {f.kind === 'pdf'
                          ? <PictureAsPdfOutlinedIcon color="error" />
                          : <ImageOutlinedIcon color="primary" />}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{f.date} ({f.size})</Typography>
                        </Box>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <ChatBubbleOutlineOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Remarks</Typography>
                  </Stack>
                  <TextField fullWidth size="small" multiline minRows={3} value={d3Remarks} onChange={(e) => setD3Remarks(e.target.value)} />
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 4 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Root Cause(s)" value={d4RootCauses} onChange={(e) => setD4RootCauses(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Corrective Action Start Date" value={d4StartDate} onChange={(e) => setD4StartDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Target Completion Date" value={d4TargetCompletionDate} onChange={(e) => setD4TargetCompletionDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Responsible Person" value={d4ResponsiblePerson} onChange={(e) => setD4ResponsiblePerson(e.target.value)}>
                      {RESPONSIBLE_PERSONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Department" value={d4Department} onChange={(e) => setD4Department(e.target.value)}>
                      {DEPARTMENTS_D2.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Priority" value={d4Priority} onChange={(e) => setD4Priority(e.target.value)}
                      sx={d4Priority === 'High' ? { '& .MuiOutlinedInput-root': { bgcolor: 'error.lighter' } } : undefined}
                    >
                      {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Status" value={d4Status} onChange={(e) => setD4Status(e.target.value)}
                      sx={
                        d4Status === 'In Progress' ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.lighter' } }
                          : d4Status === 'Completed' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } }
                          : undefined
                      }
                    >
                      {CORRECTIVE_STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Verification Method" value={d4VerificationMethod} onChange={(e) => setD4VerificationMethod(e.target.value)}>
                      {VERIFICATION_METHODS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Expected Result" value={d4ExpectedResult} onChange={(e) => setD4ExpectedResult(e.target.value)} />
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={d4Remarks} onChange={(e) => setD4Remarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>

              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 3.5, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ListAltOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Corrective Action List ({CORRECTIVE_ACTION_ROWS.length} records)</Typography>
                </Stack>
                <Button variant="contained" startIcon={<AddIcon />}>Add Corrective Action</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 820px), 360px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Corrective Action</TableCell>
                      <TableCell>Action Type</TableCell>
                      <TableCell>Responsible Person</TableCell>
                      <TableCell>Target Date</TableCell>
                      <TableCell>Actual Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Effectiveness</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {CORRECTIVE_ACTION_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={correctiveChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={correctiveChecked.has(r.no)} onChange={() => toggleOneCorrective(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>{r.action}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.person}</TableCell>
                        <TableCell>{r.targetDate}</TableCell>
                        <TableCell>{r.actualDate}</TableCell>
                        <TableCell><Chip size="small" label={r.status} color={CORRECTIVE_STATUS_COLOR[r.status] || 'default'} /></TableCell>
                        <TableCell><Chip size="small" label={r.effectiveness} color="default" /></TableCell>
                        <TableCell>{r.remarks}</TableCell>
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

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Attachments ({D4_ATTACHMENTS.length} files)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add File</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(140px, calc(100vh - 900px), 220px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                          <TableCell>S.No</TableCell>
                          <TableCell>File Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Uploaded On</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {D4_ATTACHMENTS.map((f) => (
                          <TableRow key={f.no} hover selected={d4AttachChecked.has(f.no)}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={d4AttachChecked.has(f.no)} onChange={() => toggleOneD4Attach(f.no)} />
                            </TableCell>
                            <TableCell>{f.no}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography>
                            </TableCell>
                            <TableCell>{f.desc}</TableCell>
                            <TableCell>{f.uploadedOn}</TableCell>
                            <TableCell>
                              <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                    <VerifiedUserOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Effectiveness Criteria</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                    Verification of Corrective Action Effectiveness
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5}>
                      <TextField
                        fullWidth size="small" label="Verification Date" placeholder="Select Date" value={d4VerificationDate} onChange={(e) => setD4VerificationDate(e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                      />
                      <TextField
                        fullWidth size="small" select label="Result" value={d4VerificationResult} onChange={(e) => setD4VerificationResult(e.target.value)}
                        sx={{ '& .MuiOutlinedInput-root': { color: 'warning.dark' } }}
                      >
                        <MenuItem value="To be verified">To be verified</MenuItem>
                        <MenuItem value="Effective">Effective</MenuItem>
                        <MenuItem value="Not Effective">Not Effective</MenuItem>
                      </TextField>
                    </Stack>
                    <TextField fullWidth size="small" select label="Verified By" value={d4VerifiedBy} onChange={(e) => setD4VerifiedBy(e.target.value)} displayEmpty SelectProps={{ displayEmpty: true }}>
                      <MenuItem value=""><em>Select User</em></MenuItem>
                      {RESPONSIBLE_PERSONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" multiline minRows={3} label="Remarks" placeholder="Enter verification remarks..."
                      value={d4VerificationRemarks} onChange={(e) => setD4VerificationRemarks(e.target.value)}
                    />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 5 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Verification Start Date" value={d5VerificationStartDate} onChange={(e) => setD5VerificationStartDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Verification End Date" value={d5VerificationEndDate} onChange={(e) => setD5VerificationEndDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" required select label="Verification Method" value={d5VerificationMethod} onChange={(e) => setD5VerificationMethod(e.target.value)}>
                      {D5_VERIFICATION_METHODS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Responsible Person" value={d5ResponsiblePerson} onChange={(e) => setD5ResponsiblePerson(e.target.value)}>
                      {RESPONSIBLE_PERSONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Department" value={d5Department} onChange={(e) => setD5Department(e.target.value)}>
                      {DEPARTMENTS_D2.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Status" value={d5Status} onChange={(e) => setD5Status(e.target.value)}
                      sx={
                        d5Status === 'In Progress' ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.lighter' } }
                          : d5Status === 'Completed' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } }
                          : undefined
                      }
                    >
                      {D5_STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Target Criteria" value={d5TargetCriteria} onChange={(e) => setD5TargetCriteria(e.target.value)} />
                    <TextField fullWidth size="small" label="Actual Result" value={d5ActualResult} onChange={(e) => setD5ActualResult(e.target.value)} />
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={d5Remarks} onChange={(e) => setD5Remarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <TableChartOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Effectiveness Data (Before vs After)</Typography>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 780px), 320px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Parameter</TableCell>
                          <TableCell align="right">Before Action</TableCell>
                          <TableCell align="right">After Action</TableCell>
                          <TableCell align="right">Target</TableCell>
                          <TableCell>Result</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {EFFECTIVENESS_DATA_ROWS.map((r) => (
                          <TableRow key={r.parameter} hover>
                            <TableCell>{r.parameter}</TableCell>
                            <TableCell align="right">{r.before}</TableCell>
                            <TableCell align="right">{r.after}</TableCell>
                            <TableCell align="right">{r.target}</TableCell>
                            <TableCell><Chip size="small" label={r.result} color="success" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <BarChartOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Defect Trend Chart</Typography>
                  </Stack>
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={DEFECT_TREND_DATA} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="batch" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 20]} label={{ value: 'Defect Quantity', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                        <RTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="before" fill="#dc2626" radius={[3, 3, 0, 0]} name="Before Action" barSize={22} />
                        <Bar dataKey="after" fill="#1976d2" radius={[3, 3, 0, 0]} name="After Action" barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>

              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 3.5, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PlaylistAddCheckOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Verification Activities ({VERIFICATION_ACTIVITY_ROWS.length} records)</Typography>
                </Stack>
                <Button variant="contained" startIcon={<AddIcon />}>Add Activity</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 820px), 360px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Activity Description</TableCell>
                      <TableCell>Planned Date</TableCell>
                      <TableCell>Actual Date</TableCell>
                      <TableCell>Responsible Person</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {VERIFICATION_ACTIVITY_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={verificationActivityChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={verificationActivityChecked.has(r.no)} onChange={() => toggleOneVerificationActivity(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>{r.desc}</TableCell>
                        <TableCell>{r.plannedDate}</TableCell>
                        <TableCell>{r.actualDate}</TableCell>
                        <TableCell>{r.person}</TableCell>
                        <TableCell><Chip size="small" label={r.status} color="success" /></TableCell>
                        <TableCell>{r.remarks}</TableCell>
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

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Attachments ({D5_ATTACHMENTS.length} files)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add File</Button>
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                    {D5_ATTACHMENTS.map((f) => (
                      <Stack key={f.name} direction="row" spacing={1} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, minWidth: 220 }}>
                        {f.kind === 'pdf'
                          ? <PictureAsPdfOutlinedIcon color="error" />
                          : <ImageOutlinedIcon color="primary" />}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{f.date} ({f.size})</Typography>
                        </Box>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <CheckBoxOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Confirm Effectiveness</Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Effectiveness Confirmed</Typography>
                      <RadioGroup row value={d5EffectivenessConfirmed} onChange={(e) => setD5EffectivenessConfirmed(e.target.value)}>
                        <FormControlLabel value="Yes" control={<Radio size="small" />} label="Yes" />
                        <FormControlLabel value="No" control={<Radio size="small" />} label="No" />
                      </RadioGroup>
                    </Box>
                    <TextField
                      fullWidth size="small" required label="Confirmation Date" value={d5ConfirmationDate} onChange={(e) => setD5ConfirmationDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Confirmed By" value={d5ConfirmedBy} onChange={(e) => setD5ConfirmedBy(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={d5ConfirmRemarks} onChange={(e) => setD5ConfirmRemarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 6 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" required select label="Scope of Prevention" value={d6ScopeOfPrevention} onChange={(e) => setD6ScopeOfPrevention(e.target.value)}>
                      {SCOPE_OF_PREVENTION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" required label="Implementation Start Date" value={d6ImplementationStartDate} onChange={(e) => setD6ImplementationStartDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Implementation Target Date" value={d6ImplementationTargetDate} onChange={(e) => setD6ImplementationTargetDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Responsible Person" value={d6ResponsiblePerson} onChange={(e) => setD6ResponsiblePerson(e.target.value)}>
                      {RESPONSIBLE_PERSONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Department" value={d6Department} onChange={(e) => setD6Department(e.target.value)}>
                      {DEPARTMENTS_D2.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Preventive Action Category" value={d6PreventiveActionCategory} onChange={(e) => setD6PreventiveActionCategory(e.target.value)}>
                      {PREVENTIVE_ACTION_CATEGORIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Related Process" value={d6RelatedProcess} onChange={(e) => setD6RelatedProcess(e.target.value)}>
                      {RELATED_PROCESS_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Related Documents" value={d6RelatedDocuments} onChange={(e) => setD6RelatedDocuments(e.target.value)} />
                    <TextField
                      fullWidth size="small" select label="Status" value={d6Status} onChange={(e) => setD6Status(e.target.value)}
                      sx={
                        d6Status === 'In Progress' ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.lighter' } }
                          : d6Status === 'Completed' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } }
                          : undefined
                      }
                    >
                      {D6_STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={d6Remarks} onChange={(e) => setD6Remarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>

              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 3.5, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ListAltOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Preventive Action Plan ({PREVENTIVE_ACTION_ROWS.length} records)</Typography>
                </Stack>
                <Button variant="contained" startIcon={<AddIcon />}>Add Preventive Action</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 780px), 360px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Potential Risk / Similar Issue</TableCell>
                      <TableCell>Preventive Action</TableCell>
                      <TableCell>Related Document</TableCell>
                      <TableCell>Responsible Person</TableCell>
                      <TableCell>Target Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Implementation Date</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {PREVENTIVE_ACTION_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={preventiveActionChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={preventiveActionChecked.has(r.no)} onChange={() => toggleOnePreventiveAction(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>{r.risk}</TableCell>
                        <TableCell>{r.action}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{r.doc}</Typography>
                        </TableCell>
                        <TableCell>{r.person}</TableCell>
                        <TableCell>{r.targetDate}</TableCell>
                        <TableCell><Chip size="small" label={r.status} color={PREVENTIVE_STATUS_COLOR[r.status] || 'default'} /></TableCell>
                        <TableCell>{r.implDate}</TableCell>
                        <TableCell>{r.remarks}</TableCell>
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

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <AssessmentOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Risk Assessment for Similar Products</Typography>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 860px), 260px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Product / Process</TableCell>
                          <TableCell>Risk Level</TableCell>
                          <TableCell>Preventive Action Required</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {RISK_ASSESSMENT_ROWS.map((r) => (
                          <TableRow key={r.no} hover>
                            <TableCell>{r.no}</TableCell>
                            <TableCell>{r.product}</TableCell>
                            <TableCell><Chip size="small" label={r.risk} color={RISK_LEVEL_COLOR[r.risk] || 'default'} /></TableCell>
                            <TableCell>{r.required}</TableCell>
                            <TableCell>{r.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Attachments ({D6_ATTACHMENTS.length} files)</Typography>
                    </Stack>
                    <Button variant="contained" size="small" startIcon={<AddIcon />}>Add File</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 860px), 260px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>File Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Uploaded On</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {D6_ATTACHMENTS.map((f) => (
                          <TableRow key={f.no} hover>
                            <TableCell>
                              <Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography>
                            </TableCell>
                            <TableCell>{f.desc}</TableCell>
                            <TableCell>{f.uploadedOn}</TableCell>
                            <TableCell>
                              <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <EventAvailableOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Follow Up / Monitoring</Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth size="small" label="Review Date" value={d6ReviewDate} onChange={(e) => setD6ReviewDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" label="Reviewed By" value={d6ReviewedBy} onChange={(e) => setD6ReviewedBy(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" select label="Status" value={d6FollowUpStatus} onChange={(e) => setD6FollowUpStatus(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'warning.lighter' } }}
                    >
                      <MenuItem value="Open">Open</MenuItem>
                      <MenuItem value="Closed">Closed</MenuItem>
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={3} label="Remarks" value={d6FollowUpRemarks} onChange={(e) => setD6FollowUpRemarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 7 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Closure Date" value={d7ClosureDate} onChange={(e) => setD7ClosureDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" required select label="Verification Status" value={d7VerificationStatus} onChange={(e) => setD7VerificationStatus(e.target.value)}>
                      {CLOSURE_VERIFICATION_STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Final Result" value={d7FinalResult} onChange={(e) => setD7FinalResult(e.target.value)}>
                      {FINAL_RESULT_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Team Leader" value={d7TeamLeader} onChange={(e) => setD7TeamLeader(e.target.value)}>
                      {RESPONSIBLE_PERSONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Department" value={d7Department} onChange={(e) => setD7Department(e.target.value)}>
                      {DEPARTMENTS_D2.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Customer Notification" value={d7CustomerNotification} onChange={(e) => setD7CustomerNotification(e.target.value)}>
                      {CUSTOMER_NOTIFICATION_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" required select label="Customer Feedback" value={d7CustomerFeedback} onChange={(e) => setD7CustomerFeedback(e.target.value)}
                      sx={d7CustomerFeedback === 'Satisfied' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                    >
                      {CUSTOMER_FEEDBACK_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Recognition Type" value={d7RecognitionType} onChange={(e) => setD7RecognitionType(e.target.value)}>
                      {RECOGNITION_TYPE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={2} label="Appreciation Message" value={d7AppreciationMessage} onChange={(e) => setD7AppreciationMessage(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <GroupsOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Team Members & Recognition ({TEAM_RECOGNITION_ROWS.length} records)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add Member</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 820px), 320px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                          <TableCell>S.No</TableCell>
                          <TableCell>Team Member</TableCell>
                          <TableCell>Department</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Recognition</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {TEAM_RECOGNITION_ROWS.map((r) => (
                          <TableRow key={r.no} hover selected={teamRecognitionChecked.has(r.no)}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={teamRecognitionChecked.has(r.no)} onChange={() => toggleOneTeamRecognition(r.no)} />
                            </TableCell>
                            <TableCell>{r.no}</TableCell>
                            <TableCell>{r.member}</TableCell>
                            <TableCell>{r.dept}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>{r.role}</Typography>
                            </TableCell>
                            <TableCell>{r.recognition}</TableCell>
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
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <ChatBubbleOutlineOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Customer Feedback</Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth size="small" label="Feedback Date" value={d7FeedbackDate} onChange={(e) => setD7FeedbackDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" select label="Feedback Received From" value={d7FeedbackReceivedFrom} onChange={(e) => setD7FeedbackReceivedFrom(e.target.value)}>
                      <MenuItem value={d7FeedbackReceivedFrom}>{d7FeedbackReceivedFrom}</MenuItem>
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={2} label="Feedback Summary" value={d7FeedbackSummary} onChange={(e) => setD7FeedbackSummary(e.target.value)} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>Customer Satisfaction</Typography>
                      <Stack direction="row" spacing={0.25}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <IconButton key={n} size="small" onClick={() => setD7CustomerSatisfaction(n)} sx={{ color: 'warning.main' }}>
                            {n <= d7CustomerSatisfaction ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                          </IconButton>
                        ))}
                      </Stack>
                    </Box>
                    <TextField fullWidth size="small" multiline minRows={2} label="Customer Comments" value={d7CustomerComments} onChange={(e) => setD7CustomerComments(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={7}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AttachFileOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Attachments ({D7_ATTACHMENTS.length} files)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add File</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 860px), 240px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                          <TableCell>S.No</TableCell>
                          <TableCell>File Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Uploaded On</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {D7_ATTACHMENTS.map((f) => (
                          <TableRow key={f.no} hover selected={d7AttachChecked.has(f.no)}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={d7AttachChecked.has(f.no)} onChange={() => toggleOneD7Attach(f.no)} />
                            </TableCell>
                            <TableCell>{f.no}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography>
                            </TableCell>
                            <TableCell>{f.desc}</TableCell>
                            <TableCell>{f.uploadedOn}</TableCell>
                            <TableCell>
                              <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>

                <Grid item xs={12} md={5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Closure Communication</Typography>
                    </Stack>
                    <Button variant="contained" size="small" startIcon={<SendOutlinedIcon fontSize="small" />}>Send Email</Button>
                  </Stack>
                  <Stack spacing={2}>
                    <TextField fullWidth size="small" select label="Recipient(s)" value={d7Recipients} onChange={(e) => setD7Recipients(e.target.value)}>
                      {RECIPIENT_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Email Template" value={d7EmailTemplate} onChange={(e) => setD7EmailTemplate(e.target.value)}>
                      {EMAIL_TEMPLATE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" label="Send Date" value={d7SendDate} onChange={(e) => setD7SendDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={d7ClosureRemarks} onChange={(e) => setD7ClosureRemarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          ) : activeStep === 8 ? (
            <Box>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="8D No." value="8D-2026-0001" InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Customer / Supplier" value={customer} onChange={(e) => setCustomer(e.target.value)} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" required label="Lessons Learned Date" value={d8LessonsLearnedDate} onChange={(e) => setD8LessonsLearnedDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Prepared By" value={d8PreparedBy} onChange={(e) => setD8PreparedBy(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required select label="Department" value={d8Department} onChange={(e) => setD8Department(e.target.value)}>
                      {DEPARTMENTS_D2.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Knowledge Type" value={d8KnowledgeType} onChange={(e) => setD8KnowledgeType(e.target.value)}>
                      {KNOWLEDGE_TYPE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Application Scope" value={d8ApplicationScope} onChange={(e) => setD8ApplicationScope(e.target.value)}>
                      {APPLICATION_SCOPE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" required select label="Standardization Required" value={d8StandardizationRequired} onChange={(e) => setD8StandardizationRequired(e.target.value)}>
                      {STANDARDIZATION_REQUIRED_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" select label="Status" value={d8Status} onChange={(e) => setD8Status(e.target.value)}
                      sx={
                        d8Status === 'In Progress' ? { '& .MuiOutlinedInput-root': { bgcolor: 'warning.lighter' } }
                          : d8Status === 'Completed' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } }
                          : undefined
                      }
                    >
                      {D8_STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={d8Remarks} onChange={(e) => setD8Remarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ListAltOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Lessons Learned Details ({LESSONS_LEARNED_ROWS.length} records)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add Lesson</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 780px), 320px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                          <TableCell>S.No</TableCell>
                          <TableCell>Lesson Learned</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Application</TableCell>
                          <TableCell>Responsibility</TableCell>
                          <TableCell>Target Date</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {LESSONS_LEARNED_ROWS.map((r) => (
                          <TableRow key={r.no} hover selected={lessonChecked.has(r.no)}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={lessonChecked.has(r.no)} onChange={() => toggleOneLesson(r.no)} />
                            </TableCell>
                            <TableCell>{r.no}</TableCell>
                            <TableCell>{r.lesson}</TableCell>
                            <TableCell>{r.category}</TableCell>
                            <TableCell>{r.application}</TableCell>
                            <TableCell>{r.person}</TableCell>
                            <TableCell>{r.targetDate}</TableCell>
                            <TableCell><Chip size="small" label={r.status} color={LESSON_STATUS_COLOR[r.status] || 'default'} /></TableCell>
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
                </Grid>

                <Grid item xs={12} md={6}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DescriptionOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Standardization / Document Update</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add Document</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 780px), 320px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Document Type</TableCell>
                          <TableCell>Document No.</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Updated On</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {STANDARDIZATION_DOC_ROWS.map((r) => (
                          <TableRow key={r.no} hover selected={docChecked.has(r.no)}>
                            <TableCell>{r.no}</TableCell>
                            <TableCell>{r.type}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="primary.main" fontWeight={600}>{r.docNo}</Typography>
                            </TableCell>
                            <TableCell>{r.desc}</TableCell>
                            <TableCell>{r.updatedOn}</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.25}>
                                <IconButton size="small" color="primary" onClick={() => toggleOneDoc(r.no)}><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InventoryOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700}>Application to Similar Products ({SIMILAR_PRODUCT_ROWS.length} records)</Typography>
                    </Stack>
                    <Button variant="contained" startIcon={<AddIcon />}>Add Product</Button>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 860px), 260px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox"><Checkbox size="small" disabled /></TableCell>
                          <TableCell>S.No</TableCell>
                          <TableCell>Product Code</TableCell>
                          <TableCell>Product Name</TableCell>
                          <TableCell>Process</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {SIMILAR_PRODUCT_ROWS.map((r) => (
                          <TableRow key={r.no} hover selected={similarProductChecked.has(r.no)}>
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={similarProductChecked.has(r.no)} onChange={() => toggleOneSimilarProduct(r.no)} />
                            </TableCell>
                            <TableCell>{r.no}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography>
                            </TableCell>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{r.process}</TableCell>
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
                </Grid>

                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <InsightsOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Effectiveness Summary</Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    {[
                      { label: 'Total Lessons Learned', value: LESSONS_LEARNED_ROWS.length, color: 'info.lighter' },
                      { label: 'Applied to Similar Products', value: SIMILAR_PRODUCT_ROWS.length, color: 'success.lighter' },
                      { label: 'Documents Updated', value: STANDARDIZATION_DOC_ROWS.length, color: 'info.lighter' },
                      { label: 'Training Completed', value: 'Yes', color: 'success.lighter' },
                    ].map((s) => (
                      <Box key={s.label}>
                        <Typography variant="caption" color="primary.main" fontWeight={600} display="block" sx={{ mb: 0.5 }}>{s.label}</Typography>
                        <Box sx={{ bgcolor: s.color, borderRadius: 1, px: 1.5, py: 0.75 }}>
                          <Typography variant="subtitle2" fontWeight={700}>{s.value}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <DoneAllOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>Completion</Typography>
                  </Stack>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth size="small" select label="8D Status" value={d8EightDStatus} onChange={(e) => setD8EightDStatus(e.target.value)}
                      sx={d8EightDStatus === 'Closed' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                    >
                      <MenuItem value="Open">Open</MenuItem>
                      <MenuItem value="Closed">Closed</MenuItem>
                    </TextField>
                    <TextField
                      fullWidth size="small" required label="Closure Date" value={d8ClosureDate} onChange={(e) => setD8ClosureDate(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" required label="Approved By" value={d8ApprovedBy} onChange={(e) => setD8ApprovedBy(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" multiline minRows={3} label="Remarks" value={d8CompletionRemarks} onChange={(e) => setD8CompletionRemarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No {D_STEPS[activeStep].label.toLowerCase()} details added yet.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
