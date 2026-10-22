"use client";

export function PromoteurSectionStyles() {
  return (
    <style jsx global>{`
main[data-promoteur-section="overview"] #sessions-personnel,main[data-promoteur-section="overview"] #pharmaciens,main[data-promoteur-section="overview"] #clotures-caisses,main[data-promoteur-section="overview"] #comptabilite-reseau,main[data-promoteur-section="overview"] #comparaison-pharmacies,main[data-promoteur-section="overview"] #ecarts-caisse,main[data-promoteur-section="overview"] #reseau,main[data-promoteur-section="overview"] #securite{display:none!important}
main[data-promoteur-section="services"] .promoteur-bento-grid>*,main[data-promoteur-section="comptabilite"] .promoteur-bento-grid>*,main[data-promoteur-section="reseau"] .promoteur-bento-grid>*,main[data-promoteur-section="convention"] .promoteur-bento-grid>*,main[data-promoteur-section="securite"] .promoteur-bento-grid>*,main[data-promoteur-section="parametres"] .promoteur-bento-grid>*,main[data-promoteur-section="profil"] .promoteur-bento-grid>*{display:none!important}
main[data-promoteur-section="services"] #sessions-personnel,main[data-promoteur-section="services"] #pharmaciens,main[data-promoteur-section="services"] #clotures-caisses{display:block!important}
main[data-promoteur-section="comptabilite"] #comptabilite-reseau,main[data-promoteur-section="comptabilite"] #comparaison-pharmacies{display:block!important}
main[data-promoteur-section="reseau"] #reseau{display:grid!important}main[data-promoteur-section="reseau"] #reseau>aside{display:none!important}
main[data-promoteur-section="convention"] #reseau{display:grid!important}main[data-promoteur-section="convention"] #reseau>article:first-child{display:none!important}main[data-promoteur-section="convention"] #reseau>aside>article:first-child{display:block!important}
main[data-promoteur-section="securite"] #securite{display:block!important}main[data-promoteur-section="securite"] #configuration,main[data-promoteur-section="securite"] #profil{display:none!important}
main[data-promoteur-section="parametres"] #securite{display:block!important}main[data-promoteur-section="parametres"] #securite>:first-child,main[data-promoteur-section="parametres"] #profil{display:none!important}main[data-promoteur-section="parametres"] #configuration{display:block!important}
main[data-promoteur-section="profil"] #securite{display:block!important}main[data-promoteur-section="profil"] #securite>:first-child,main[data-promoteur-section="profil"] #configuration{display:none!important}main[data-promoteur-section="profil"] #profil{display:block!important}
`}</style>
  );
}
