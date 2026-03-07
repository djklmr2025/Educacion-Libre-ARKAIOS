import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  UserCircle2,
  Lock,
  LogOut,
  Wallet,
  History,
  CheckCircle2,
  AlertCircle,
  Shield,
  Store,
  Users,
} from "lucide-react";

type BizRole = "admin" | "cajero" | "cliente";

interface BizAccount {
  id: string;
  nip: string;
  name: string;
  role: BizRole;
  balance: number;
  history: { id: string; type: "VENTA" | "RECARGA"; amount: number; ts: string }[];
}

const STORAGE_KEY = "ark_business_accounts";
const MOVEMENTS_KEY = "ark_business_movements";

const loadAccounts = (): BizAccount[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveAccounts = (list: BizAccount[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
};

const seedIfEmpty = () => {
  const list = loadAccounts();
  if (list.length === 0) {
    const now = Date.now();
    const demo: BizAccount[] = [
      {
        id: "ADM-NEG-001",
        nip: "1111",
        name: "Admin Negocio",
        role: "admin",
        balance: 1,
        history: [
          { id: "TXA1", type: "RECARGA", amount: 1, ts: new Date(now - 86400000).toISOString() },
        ],
      },
      {
        id: "CAJA-NEG-001",
        nip: "2222",
        name: "Caja Principal",
        role: "cajero",
        balance: 1,
        history: [
          { id: "TXC1", type: "RECARGA", amount: 1, ts: new Date(now - 7200000).toISOString() },
        ],
      },
      {
        id: "CLI-NEG-001",
        nip: "3333",
        name: "Cliente Empresarial 1",
        role: "cliente",
        balance: 150,
        history: [{ id: "TXU1", type: "RECARGA", amount: 150, ts: new Date(now - 5400000).toISOString() }],
      },
      {
        id: "CLI-NEG-002",
        nip: "4444",
        name: "Cliente Empresarial 2",
        role: "cliente",
        balance: 80,
        history: [{ id: "TXU2", type: "RECARGA", amount: 80, ts: new Date(now - 3600000).toISOString() }],
      },
    ];
    saveAccounts(demo);
  }
};

seedIfEmpty();

const fmtDate = (s: string) => new Date(s).toLocaleString();

const BusinessAccess: React.FC = () => {
  const [role, setRole] = useState<BizRole>("admin");
  const [id, setId] = useState("");
  const [nip, setNip] = useState("");
  const [amount, setAmount] = useState("0");
  const [accounts, setAccounts] = useState<BizAccount[]>([]);
  const [active, setActive] = useState<BizAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(loadAccounts());
  }, []);

  const persistAccounts = (next: BizAccount[]) => {
    setAccounts(next);
    saveAccounts(next);
  };

  const movementLog = (line: string) => {
    try {
      const existing = localStorage.getItem(MOVEMENTS_KEY);
      const rows = existing ? JSON.parse(existing) : [];
      rows.unshift({ ts: new Date().toISOString(), line });
      localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(rows.slice(0, 2000)));
    } catch {}
  };

  const login = () => {
    const found = accounts.find(
      (a) => a.id === id.trim() && a.nip === nip.trim() && a.role === role
    );
    if (!found) {
      setError("ID o NIP incorrecto para este perfil.");
      return;
    }
    setError(null);
    setActive(found);
  };

  const refreshActive = (nextAccounts: BizAccount[]) => {
    if (!active) return;
    const updated = nextAccounts.find((a) => a.id === active.id) || null;
    setActive(updated);
  };

  const applyMovement = (targetId: string, type: "RECARGA" | "VENTA") => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError("Monto invalido.");
      return;
    }
    const next = accounts.map((a) => {
      if (a.id !== targetId) return a;
      const signed = type === "VENTA" ? -Math.abs(numeric) : Math.abs(numeric);
      return {
        ...a,
        balance: Math.max(0, a.balance + signed),
        history: [
          {
            id: `TX-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            type,
            amount: signed,
            ts: new Date().toISOString(),
          },
          ...a.history,
        ].slice(0, 50),
      };
    });
    persistAccounts(next);
    refreshActive(next);
    const actor = active ? `${active.id}(${active.role})` : "system";
    movementLog(`${actor} -> ${type} ${numeric.toFixed(2)} en ${targetId}`);
    setError(null);
  };

  const logout = () => {
    setActive(null);
    setId("");
    setNip("");
  };

  const registerClient = () => {
    const newAcc: BizAccount = {
      id: `CLI-${Date.now().toString().slice(-6)}`,
      nip: "0000",
      name: "Cliente Nuevo",
      role: "cliente",
      balance: 0,
      history: [],
    };
    const list = [...accounts, newAcc];
    persistAccounts(list);
    setId(newAcc.id);
    setNip(newAcc.nip);
    setRole("cliente");
    movementLog(`ALTA cliente ${newAcc.id}`);
  };

  const visibleAccounts = useMemo(() => {
    if (!active) return [];
    if (active.role === "cliente") return accounts.filter((a) => a.id === active.id);
    if (active.role === "cajero") return accounts.filter((a) => a.role === "cliente");
    return accounts;
  }, [active, accounts]);

  const roleLabel = (r: BizRole) => {
    if (r === "admin") return "Admin";
    if (r === "cajero") return "Caja";
    return "Cliente";
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-green-600">
              Acceso Empresarial
            </div>
            <div className="text-2xl font-black text-gray-900">
              Cuentas Empresariales
            </div>
            <p className="text-sm text-gray-500">
              Categoria secundaria: Admin, Caja y Clientes.
            </p>
          </div>
          <div className="flex gap-2 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setRole("admin")}
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                role === "admin" ? "bg-indigo-600 text-white" : "text-gray-700"
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => setRole("cajero")}
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                role === "cajero" ? "bg-green-600 text-white" : "text-gray-700"
              }`}
            >
              Caja
            </button>
            <button
              onClick={() => setRole("cliente")}
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                role === "cliente" ? "bg-blue-600 text-white" : "text-gray-700"
              }`}
            >
              Soy Cliente
            </button>
          </div>
        </div>

        {!active && (
          <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="font-black text-slate-800">Credenciales demo:</span>{" "}
            <span className="font-mono">ADM-NEG-001/1111</span>,{" "}
            <span className="font-mono">CAJA-NEG-001/2222</span>,{" "}
            <span className="font-mono">CLI-NEG-001/3333</span>,{" "}
            <span className="font-mono">CLI-NEG-002/4444</span>
          </div>
        )}

        {!active ? (
          <div className="grid gap-4">
            <div className="relative">
              <UserCircle2 className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Ingresa ID..."
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 font-mono font-bold focus:border-green-500 outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={nip}
                onChange={(e) => setNip(e.target.value.replace(/\D/g, ""))}
                placeholder="NIP de seguridad"
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 font-mono font-black focus:border-green-500 outline-none"
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={login}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black shadow hover:bg-green-700 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Iniciar Sesión
              </button>
              <button
                onClick={registerClient}
                className="px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Crear cliente demo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-widest text-green-600">
                    {active.role === "admin"
                      ? "Cuenta Admin"
                      : active.role === "cajero"
                        ? "Cuenta de Caja"
                        : "Cuenta Cliente"}
                  </div>
                  <div className="text-xl font-black text-gray-900">
                    {active.name}
                  </div>
                  <div className="text-xs font-mono text-gray-500">{active.id}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-red-500 font-bold flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Cerrar
              </button>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-green-700">
                  Saldo disponible
                </div>
                <div className="text-4xl font-black text-green-700">
                  ${active.balance.toFixed(2)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white border border-green-200 text-green-700">
                  {roleLabel(active.role)}
                </span>
                <Wallet className="w-10 h-10 text-green-500" />
              </div>
            </div>

            {(active.role === "admin" || active.role === "cajero") && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                  Operacion de caja
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(",", "."))}
                    className="border border-slate-200 rounded-xl px-4 py-2 font-mono font-bold"
                    placeholder="Monto"
                  />
                  <button
                    onClick={() => applyMovement(active.id, "RECARGA")}
                    className="rounded-xl px-4 py-2 bg-emerald-600 text-white font-black"
                  >
                    Recargar mi cuenta
                  </button>
                  <button
                    onClick={() => applyMovement(active.id, "VENTA")}
                    className="rounded-xl px-4 py-2 bg-slate-800 text-white font-black"
                  >
                    Registrar gasto
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                {active.role === "admin" ? (
                  <Shield className="w-4 h-4" />
                ) : active.role === "cajero" ? (
                  <Store className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                Cuentas visibles ({visibleAccounts.length})
              </div>
              <div className="divide-y divide-gray-100">
                {visibleAccounts.map((acc) => (
                  <div key={acc.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-black text-slate-800">{acc.name}</div>
                      <div className="font-mono text-xs text-slate-500">{acc.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black uppercase text-slate-500">{roleLabel(acc.role)}</div>
                      <div className="font-black text-blue-700">${acc.balance.toFixed(2)}</div>
                    </div>
                    {(active.role === "admin" || active.role === "cajero") && acc.role === "cliente" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => applyMovement(acc.id, "RECARGA")}
                          className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-black"
                        >
                          +Saldo
                        </button>
                        <button
                          onClick={() => applyMovement(acc.id, "VENTA")}
                          className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 text-xs font-black"
                        >
                          -Cobro
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-[11px] font-black uppercase tracking-widest text-gray-500">
                <History className="w-4 h-4" /> Historial reciente
              </div>
              <div className="divide-y divide-gray-100">
                {active.history.length === 0 && (
                  <div className="p-4 text-gray-400 text-sm">Sin movimientos.</div>
                )}
                {active.history.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-800">{tx.type}</div>
                      <div className="text-xs text-gray-500">{fmtDate(tx.ts)}</div>
                    </div>
                    <div
                      className={`font-black ${
                        tx.type === "VENTA" ? "text-red-500" : "text-green-600"
                      }`}
                    >
                      {tx.type === "VENTA" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessAccess;
