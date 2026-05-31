import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Maximize2, X } from "lucide-react";
import { useCompany } from "../app/CompanyContext.tsx";

const appWindow = getCurrentWindow();

export interface TitleBarInfo {
  label: string;
  dotColor: string;
}

export default function TitleBar({ info, isLoginPage }: { info?: TitleBarInfo, isLoginPage?: boolean }) {
  const { activeCompany } = useCompany();

  return (
    <div className="h-10 bg-white border-b border-zinc-200 flex items-center justify-between px-3 select-none">

      {/* DRAG AREA (left + center only) */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-3 flex-1"
      >
        <div className={`w-2 h-2 rounded-full ${info?.dotColor ?? "bg-emerald-500"}`} />

        <span className="text-sm text-zinc-800 font-semibold">
          {info?.label ?? "AtlasPaie"}
        </span>

        {!isLoginPage && activeCompany && (
          <>
            <span className="text-zinc-300 font-light">/</span>
            <span className="text-sm text-zinc-500 font-medium">
              {activeCompany.name}
            </span>
          </>
        )}
      </div>

      {/* BUTTONS (NOT draggable) */}
      <div className="flex items-center gap-1">
        <button
          data-tauri-drag-region={false}
          onClick={() => appWindow.minimize()}
          className="w-10 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <Minus size={16} />
        </button>

        <button
          data-tauri-drag-region={false}
          onClick={() => appWindow.toggleMaximize()}
          className="w-10 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <Maximize2 size={14} />
        </button>

        <button
          data-tauri-drag-region={false}
          onClick={() => appWindow.close()}
          className="w-10 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-red-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}