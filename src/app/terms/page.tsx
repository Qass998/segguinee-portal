/**
 * Terms of Service — SEGGUINÉE
 * Public page (no auth required). Required by Meta WhatsApp Business.
 */

export default function TermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0F172A" }}>
      <div className="max-w-2xl w-full py-16">
        <svg className="w-10 h-10 mb-8" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <h1 className="text-2xl font-bold mb-6" style={{ color: "#F8FAFC" }}>Conditions Générales d&apos;Utilisation</h1>
        <p className="text-sm mb-8" style={{ color: "#94A3B8" }}>Dernière mise à jour : 30 mai 2026</p>

        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>1. Service</h2>
            <p>SEGGUINÉE fournit un service de distribution d&apos;eau potable en République de Guinée. Le service client automatisé via WhatsApp constitue un canal de communication officiel entre la SEGGUINÉE et ses abonnés. Les informations fournies par ce canal ont valeur informative. Les relevés officiels et factures papier font foi en cas de divergence.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>2. Utilisation du canal WhatsApp</h2>
            <p>Le service WhatsApp de la SEGGUINÉE est destiné aux abonnés enregistrés. En utilisant ce service, vous acceptez de recevoir des messages relatifs à votre contrat : factures, rappels de paiement, alertes de service, et confirmations. Vous pouvez vous désabonner à tout moment en envoyant STOP par WhatsApp.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>3. Paiement et facturation</h2>
            <p>Les montants communiqués par WhatsApp sont indicatifs. Les factures officielles restent le document de référence pour le paiement. Tout paiement doit être effectué selon les modalités indiquées sur la facture officielle. La SEGGUINÉE se réserve le droit de suspendre le service en cas de non-paiement conformément à la réglementation en vigueur.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>4. Responsabilité</h2>
            <p>La SEGGUINÉE s&apos;engage à maintenir le service WhatsApp opérationnel dans la mesure du possible. Des interruptions techniques peuvent survenir indépendamment de notre volonté. En cas d&apos;urgence (coupure d&apos;eau, contamination), contactez le service technique au numéro officiel en complément du signalement WhatsApp.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>5. Modification des conditions</h2>
            <p>La SEGGUINÉE se réserve le droit de modifier les présentes conditions à tout moment. Les modifications seront communiquées via le canal WhatsApp et publiées sur cette page. L&apos;utilisation continue du service après modification vaut acceptation des nouvelles conditions.</p>
          </section>
        </div>

        <hr className="my-8" style={{ borderColor: "#334155" }} />
        <p className="text-xs" style={{ color: "#64748B" }}>SEGGUINÉE — Société des Eaux de Guinée · Conakry, République de Guinée</p>
      </div>
    </div>
  );
}
