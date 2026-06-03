import { pinLogin } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect = "/dashboard" } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0F172A" }}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <svg className="w-14 h-14 mx-auto mb-4" viewBox="0 0 24 24" fill="none"
            stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C12 2 4 12.5 4 17a8 8 0 1 0 16 0C20 12.5 12 2 12 2Z" fill="#3B82F6" opacity=".15" />
            <path d="M12 2C12 2 4 12.5 4 17a8 8 0 1 0 16 0C20 12.5 12 2 12 2Z" />
          </svg>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#F8FAFC" }}>SEGGUINÉE</h1>
          <p className="text-sm mt-2" style={{ color: "#94A3B8" }}>Portail Opérateur — Société des Eaux de Guinée</p>
        </div>

        {/* PIN form */}
        <div className="rounded-2xl p-8" style={{ background: "#1E293B", border: "1px solid #334155" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-6 text-center" style={{ color: "#64748B" }}>
            Accès sécurisé
          </p>

          <form action={pinLogin} className="space-y-4">
            <input type="hidden" name="redirect" value={redirect} />
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#CBD5E1" }}>
                Code PIN
              </label>
              <input
                type="password" name="pin" required maxLength={4}
                inputMode="numeric" autoComplete="off" autoFocus
                placeholder="••••"
                className="w-full px-4 py-3 rounded-lg text-sm text-center tracking-[0.5em] border outline-none transition-colors"
                style={{ background: "#0F172A", border: "1px solid #334155", color: "#F8FAFC" }}
              />
            </div>

            {error === "invalid_pin" && (
              <p className="text-xs px-3 py-2 rounded text-center"
                style={{ background: "rgba(239,68,68,.12)", color: "#F87171" }}>
                Code PIN incorrect. Veuillez réessayer.
              </p>
            )}

            <button type="submit"
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "#3B82F6", color: "#F8FAFC" }}>
              Accéder
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: "#64748B" }}>
          SEGGUINÉE · Portail sécurisé · Accès réservé au personnel autorisé
        </p>
      </div>
    </div>
  );
}
