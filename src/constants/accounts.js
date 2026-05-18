/**
 * Messages et codes métier liés aux comptes (brand / quizmaster).
 */
module.exports = {
    /** Affiché aux quizmasters lorsque leur marque a été retirée par l’admin. */
    MSG_QUIZMASTER_BRAND_REMOVED:
        "Votre compte a été désactivé car votre Brand a été supprimé.",

    MSG_BRAND_ACCOUNT_CLOSED:
        "Cette marque a été désactivée et n’est plus accessible.",

    /** Code erreur API (403) — client peut forcer déconnexion. */
    CODE_ACCOUNT_REVOKED: "ACCOUNT_REVOKED",

    CODE_BRAND_REMOVED: "BRAND_REMOVED",

    CODE_INVALID_QUIZMASTER: "INVALID_QUIZMASTER",
};
