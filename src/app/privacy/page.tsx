/**
 * Privacy Policy — SEGGUINÉE
 * Public page (no auth required). Required by Meta WhatsApp Business.
 */

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0F172A" }}>
      <div className="max-w-2xl w-full py-16">
        <svg className="w-10 h-10 mb-8" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <h1 className="text-2xl font-bold mb-6" style={{ color: "#F8FAFC" }}>Politique de Confidentialité</h1>
        <p className="text-sm mb-8" style={{ color: "#94A3B8" }}>Dernière mise à jour : 30 mai 2026</p>

        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>1. Collecte des données</h2>
            <p>SEGGUINÉE collecte uniquement les données nécessaires à la fourniture du service d&apos;eau potable : numéro de téléphone WhatsApp, relevés de compteur, historique de facturation, et signalements d&apos;incidents. Aucune donnée n&apos;est collectée sans consentement implicite par l&apos;utilisation du service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>2. Utilisation des données</h2>
            <p>Les données collectées sont utilisées exclusivement pour : la facturation du service d&apos;eau, la communication relative au service, la réponse aux demandes des clients, et l&apos;amélioration continue du service. Aucune donnée n&apos;est vendue, louée, ou partagée avec des tiers à des fins commerciales.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>3. Stockage et sécurité</h2>
            <p>Les données sont stockées sur des serveurs sécurisés avec chiffrement en transit et au repos. L&apos;accès est strictement limité au personnel autorisé de la SEGGUINÉE. Les communications WhatsApp sont traitées par un agent IA automatisé — aucun opérateur humain ne lit les messages, sauf en cas d&apos;escalade explicite.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>4. Droits des utilisateurs</h2>
            <p>Conformément à la législation guinéenne sur la protection des données, vous avez le droit d&apos;accéder à vos données, de les rectifier, et de demander leur suppression. Pour exercer ces droits, contactez-nous par WhatsApp ou par courrier au siège de la SEGGUINÉE, Conakry, République de Guinée.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2" style={{ color: "#F8FAFC" }}>5. Contact</h2>
            <p>Pour toute question relative à cette politique de confidentialité : contactez la Direction Générale de la SEGGUINÉE via le service client WhatsApp ou par courrier au siège social, Conakry.</p>
          </section>
        </div>

        <hr className="my-8" style={{ borderColor: "#334155" }} />
        <p className="text-xs" style={{ color: "#64748B" }}>SEGGUINÉE — Société des Eaux de Guinée · Conakry, République de Guinée</p>
      </div>
    </div>
  );
}
