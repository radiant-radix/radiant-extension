import {
  Home, Wallet, Code2, Layers, Settings,
  ArrowUpRight, ArrowDownLeft, RefreshCw, Lock,
  Copy, Check, ChevronRight, ChevronDown, ChevronUp,
  Plus, Trash2, Edit3, Eye, EyeOff, Search,
  QrCode, Bell, BellOff, Shield, Key, Download,
  ExternalLink, AlertTriangle, Info, X, Menu,
  Activity, TrendingUp, Database, Cpu, Globe,
  LogOut, RotateCcw, Scan, Zap, Star,
  ArrowLeft, Send, Inbox, Coins, ImageIcon,
  BarChart2, FlaskConical, Network, BookOpen,
} from 'lucide-react'

const icons = {
  home: Home, wallet: Wallet, code: Code2, layers: Layers, settings: Settings,
  send: ArrowUpRight, receive: ArrowDownLeft, refresh: RefreshCw, lock: Lock,
  copy: Copy, check: Check, chevronRight: ChevronRight, chevronDown: ChevronDown,
  chevronUp: ChevronUp, plus: Plus, trash: Trash2, edit: Edit3,
  eye: Eye, eyeOff: EyeOff, search: Search, qr: QrCode,
  bell: Bell, bellOff: BellOff, shield: Shield, key: Key, download: Download,
  external: ExternalLink, warning: AlertTriangle, info: Info, close: X, menu: Menu,
  activity: Activity, trending: TrendingUp, database: Database, cpu: Cpu, globe: Globe,
  logout: LogOut, reset: RotateCcw, scan: Scan, zap: Zap, star: Star,
  back: ArrowLeft, sendAlt: Send, inbox: Inbox, coins: Coins, image: ImageIcon,
  chart: BarChart2, flask: FlaskConical, network: Network, book: BookOpen,
}

export default function Icon({ name, size = 16, className = '', strokeWidth = 1.75 }) {
  const Component = icons[name]
  if (!Component) return null
  return <Component size={size} strokeWidth={strokeWidth} className={className} />
}
