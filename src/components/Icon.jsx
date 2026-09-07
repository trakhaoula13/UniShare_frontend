import React from "react";
import {
  Archive, ArrowLeft, ArrowUpRight, ArrowUpCircle, Book, LogOut, ExternalLink,
  CalendarClock, CalendarHeart, Calendar, CheckCircle, CheckCircle2,
  Check, CheckSquare, ListChecks, Circle, ClipboardCheck, Cpu, Mail,
  MailCheck, AlertTriangle, Eye, EyeOff, FileText, Globe, Hourglass,
  Info, BookMarked, BookOpen, NotebookText, KeyRound, Link as LinkIcon,
  Menu, Moon, GraduationCap, Pencil, Users, User, UserCircle, UserCog,
  Plus, HelpCircle, Save, Search, ShieldCheck, Lock, Gauge, Square,
  Sparkles, Sun, MoreVertical, Trash2, Unlock, XCircle, X, Bell,
  Flag, AlertCircle, Clock, Palette, GripVertical, Send,
} from "lucide-react";

// Registre unique : associe un nom semantique (identique aux anciennes
// classes Bootstrap Icons, prefixe "bi-" en moins) a un composant Lucide.
// Toutes les icones de l'application passent par ce composant -- un seul
// endroit a modifier pour changer une icone ou en ajouter une nouvelle.
const REGISTRY = {
  archive: Archive,
  "arrow-left": ArrowLeft,
  "arrow-up-right-circle": ArrowUpRight,
  "arrow-up-circle": ArrowUpCircle,
  book: Book,
  "box-arrow-right": LogOut,
  "box-arrow-up-right": ExternalLink,
  "calendar-event": CalendarClock,
  "calendar-heart": CalendarHeart,
  calendar3: Calendar,
  "check-circle": CheckCircle,
  "check-circle-fill": CheckCircle2,
  "check-lg": Check,
  "check-square-fill": CheckSquare,
  "check2-square": ListChecks,
  circle: Circle,
  "clipboard-check": ClipboardCheck,
  cpu: Cpu,
  envelope: Mail,
  "envelope-check-fill": MailCheck,
  "exclamation-triangle-fill": AlertTriangle,
  "exclamation-triangle": AlertTriangle,
  eye: Eye,
  "eye-slash": EyeOff,
  "file-earmark-pdf-fill": FileText,
  "file-earmark-text": FileText,
  globe: Globe,
  "hourglass-split": Hourglass,
  "info-circle-fill": Info,
  "journal-bookmark": BookMarked,
  "journal-richtext": BookOpen,
  "journal-text": NotebookText,
  "key-fill": KeyRound,
  "link-45deg": LinkIcon,
  list: Menu,
  "list-check": ListChecks,
  "moon-stars": Moon,
  mortarboard: GraduationCap,
  "mortarboard-fill": GraduationCap,
  pencil: Pencil,
  people: Users,
  person: User,
  "person-circle": UserCircle,
  "person-gear": UserCog,
  "plus-lg": Plus,
  "question-circle-fill": HelpCircle,
  save: Save,
  search: Search,
  "shield-check": ShieldCheck,
  "shield-lock": Lock,
  "shield-lock-fill": Lock,
  speedometer2: Gauge,
  square: Square,
  stars: Sparkles,
  sun: Sun,
  "three-dots-vertical": MoreVertical,
  trash: Trash2,
  unlock: Unlock,
  "x-circle-fill": XCircle,
  "x-lg": X,
  // Ajoutees pour les nouvelles fonctionnalites (notifications, priorites...)
  bell: Bell,
  flag: Flag,
  "alert-circle": AlertCircle,
  clock: Clock,
  palette: Palette,
  "grip-vertical": GripVertical,
  send: Send,
};

// Accepte aussi bien "book" que l'ancien format "bi-book" (compatibilite
// avec des donnees deja enregistrees, ex: icones de liens rapides en base).
const Icon = ({ name, className = "", size = 16, ...rest }) => {
  const key = name?.startsWith("bi-") ? name.slice(3) : name;
  const Cmp = REGISTRY[key];
  if (!Cmp) return null;
  return <Cmp className={`app-icon ${className}`.trim()} size={size} {...rest} />;
};

export default Icon;