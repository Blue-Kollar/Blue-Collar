export interface CategoryConfig {
  label: string;
  iconName: string;
  ariaLabel: string;
  bg: string;
  text: string;
  border: string;
  icon: string;
  hex: string;
}

export const categoryConfig: Record<string, CategoryConfig> = {
  plumber: {
    label: "Plumber",
    iconName: "Droplets",
    ariaLabel: "Plumber category",
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
    icon: "text-blue-600",
    hex: "#2563EB",
  },
  electrician: {
    label: "Electrician",
    iconName: "Zap",
    ariaLabel: "Electrician category",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
    icon: "text-yellow-500",
    hex: "#D97706",
  },
  carpenter: {
    label: "Carpenter",
    iconName: "Hammer",
    ariaLabel: "Carpenter category",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
    icon: "text-amber-700",
    hex: "#B45309",
  },
  painter: {
    label: "Painter",
    iconName: "PaintBucket",
    ariaLabel: "Painter category",
    bg: "bg-pink-100",
    text: "text-pink-800",
    border: "border-pink-200",
    icon: "text-pink-600",
    hex: "#DB2777",
  },
  welder: {
    label: "Welder",
    iconName: "Flame",
    ariaLabel: "Welder category",
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-200",
    icon: "text-orange-600",
    hex: "#EA580C",
  },
  mason: {
    label: "Mason",
    iconName: "Building2",
    ariaLabel: "Mason / bricklayer category",
    bg: "bg-stone-100",
    text: "text-stone-800",
    border: "border-stone-200",
    icon: "text-stone-600",
    hex: "#78716C",
  },
  hvac: {
    label: "HVAC",
    iconName: "Wind",
    ariaLabel: "HVAC technician category",
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    border: "border-cyan-200",
    icon: "text-cyan-600",
    hex: "#0891B2",
  },
  landscaper: {
    label: "Landscaper",
    iconName: "Leaf",
    ariaLabel: "Landscaper category",
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
    icon: "text-green-600",
    hex: "#16A34A",
  },
  cleaner: {
    label: "Cleaner",
    iconName: "Sparkles",
    ariaLabel: "Cleaner category",
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200",
    icon: "text-purple-600",
    hex: "#9333EA",
  },
  other: {
    label: "Other",
    iconName: "Wrench",
    ariaLabel: "Other trade category",
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    icon: "text-gray-500",
    hex: "#6B7280",
  },
};

export function getCategoryConfig(slug?: string): CategoryConfig {
  return categoryConfig[slug?.toLowerCase() ?? ""] ?? categoryConfig.other!;
}
