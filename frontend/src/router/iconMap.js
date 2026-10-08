// Maps the string icon names used in navConfig.js to actual MUI icon
// components — imported individually to keep bundle size down (never
// import the whole icon library).
import Dashboard from '@mui/icons-material/Dashboard';
import Business from '@mui/icons-material/Business';
import Domain from '@mui/icons-material/Domain';
import AccountTree from '@mui/icons-material/AccountTree';
import DateRange from '@mui/icons-material/DateRange';
import Numbers from '@mui/icons-material/Numbers';
import Percent from '@mui/icons-material/Percent';
import AccountBalance from '@mui/icons-material/AccountBalance';
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';
import Badge from '@mui/icons-material/Badge';
import Rule from '@mui/icons-material/Rule';
import Inventory2 from '@mui/icons-material/Inventory2';
import Category from '@mui/icons-material/Category';
import Sell from '@mui/icons-material/Sell';
import Straighten from '@mui/icons-material/Straighten';
import Inventory from '@mui/icons-material/Inventory';
import MenuBook from '@mui/icons-material/MenuBook';
import QrCode from '@mui/icons-material/QrCode';
import PriceChange from '@mui/icons-material/PriceChange';
import Discount from '@mui/icons-material/Discount';
import Groups from '@mui/icons-material/Groups';
import Person from '@mui/icons-material/Person';
import LocalShipping from '@mui/icons-material/LocalShipping';
import DirectionsCar from '@mui/icons-material/DirectionsCar';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import RequestQuote from '@mui/icons-material/RequestQuote';
import Assignment from '@mui/icons-material/Assignment';
import Receipt from '@mui/icons-material/Receipt';
import PointOfSale from '@mui/icons-material/PointOfSale';
import Warehouse from '@mui/icons-material/Warehouse';
import MoveToInbox from '@mui/icons-material/MoveToInbox';
import Outbox from '@mui/icons-material/Outbox';
import Tune from '@mui/icons-material/Tune';
import TrendingUp from '@mui/icons-material/TrendingUp';
import TrendingDown from '@mui/icons-material/TrendingDown';
import Payments from '@mui/icons-material/Payments';
import Savings from '@mui/icons-material/Savings';
import Balance from '@mui/icons-material/Balance';
import Print from '@mui/icons-material/Print';
import Settings from '@mui/icons-material/Settings';
import ContactMail from '@mui/icons-material/ContactMail';
import EventRepeat from '@mui/icons-material/EventRepeat';
import NoteAdd from '@mui/icons-material/NoteAdd';
import MoreTime from '@mui/icons-material/MoreTime';
import Layers from '@mui/icons-material/Layers';
import BrandingWatermark from '@mui/icons-material/BrandingWatermark';
import Circle from '@mui/icons-material/FiberManualRecord';
import Assessment from '@mui/icons-material/Assessment';
import ListAlt from '@mui/icons-material/ListAlt';
import Analytics from '@mui/icons-material/Analytics';
import PersonSearch from '@mui/icons-material/PersonSearch';
import BarChart from '@mui/icons-material/BarChart';
import Leaderboard from '@mui/icons-material/Leaderboard';
import HourglassBottom from '@mui/icons-material/HourglassBottom';
import CompareArrows from '@mui/icons-material/CompareArrows';
import History from '@mui/icons-material/History';
import PriceCheck from '@mui/icons-material/PriceCheck';
import WarningAmber from '@mui/icons-material/WarningAmber';
import Speed from '@mui/icons-material/Speed';
import Block from '@mui/icons-material/Block';
import Replay from '@mui/icons-material/Replay';
import Book from '@mui/icons-material/Book';
import Today from '@mui/icons-material/Today';
import Place from '@mui/icons-material/Place';
import Calculate from '@mui/icons-material/Calculate';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import AssignmentReturn from '@mui/icons-material/AssignmentReturn';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import CurrencyExchange from '@mui/icons-material/CurrencyExchange';
import Apartment from '@mui/icons-material/Apartment';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import Factory from '@mui/icons-material/Factory';
import Insights from '@mui/icons-material/Insights';
import Visibility from '@mui/icons-material/Visibility';
import PlaylistAddCheck from '@mui/icons-material/PlaylistAddCheck';
import EditNote from '@mui/icons-material/EditNote';
import Engineering from '@mui/icons-material/Engineering';

export const iconMap = {
  Dashboard, Business, Domain, AccountTree, DateRange, Numbers, Percent,
  AccountBalance, AccountBalanceWallet, Badge, Rule, Inventory2, Category,
  Sell, Straighten, Inventory, MenuBook, QrCode, PriceChange, Discount,
  Groups, Person, LocalShipping, DirectionsCar, ShoppingCart, RequestQuote,
  Assignment, Receipt, PointOfSale, Warehouse, MoveToInbox, Outbox, Tune,
  TrendingUp, TrendingDown, Payments, Savings, Balance, Print, Settings,
  ContactMail, EventRepeat, NoteAdd, MoreTime, Layers, BrandingWatermark,
  Assessment, ListAlt, Analytics, PersonSearch, BarChart, Leaderboard,
  HourglassBottom, CompareArrows, History, PriceCheck, WarningAmber, Speed,
  Block, Replay, Book, Today, Place, Calculate, AccountTreeOutlined,
  ReceiptLong, ReceiptLongIcon,PointOfSaleIcon, AccountBalanceWalletIcon,
  AssignmentReturn,
  ManageAccounts,
  CurrencyExchange,
  Apartment,
  Factory,
  Insights,
  Visibility,
  PlaylistAddCheck,
  EditNote,
  Engineering,
};

export function getNavIcon(name) {
  return iconMap[name] || Circle;
}
