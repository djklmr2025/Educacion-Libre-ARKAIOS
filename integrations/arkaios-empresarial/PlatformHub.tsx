import React, { useState } from "react";
import { Briefcase, GraduationCap } from "lucide-react";
import App from "../App-backup";
import BusinessAccess from "./BusinessAccess";

type PlatformMode = "educativo" | "empresarial";

const PlatformHub: React.FC = () => {
  const [mode, setMode] = useState<PlatformMode>("educativo");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 pb-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-slate-500">
              ARKAIOS Core
            </div>
            <div className="text-lg font-black text-slate-900">
              Categoria Primaria + Categoria Secundaria
            </div>
          </div>
          <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setMode("educativo")}
              className={`px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2 ${
                mode === "educativo"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Cuentas Educativas
            </button>
            <button
              onClick={() => setMode("empresarial")}
              className={`px-4 py-2 rounded-lg text-sm font-black flex items-center gap-2 ${
                mode === "empresarial"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Cuentas Empresariales
            </button>
          </div>
        </div>
      </div>
      {mode === "educativo" ? <App /> : <BusinessAccess />}
    </div>
  );
};

export default PlatformHub;
