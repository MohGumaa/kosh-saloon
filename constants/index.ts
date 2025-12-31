import { modesProps } from "@/types";
import { MonitorCog, Moon, Sun } from "lucide-react";

export const MODES: modesProps[] = [
  { id: "system", label: "system", icon: MonitorCog },
  { id: "light", label: "light", icon: Sun },
  { id: "dark", label: "dark", icon: Moon }
]