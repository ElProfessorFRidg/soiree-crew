// AI-02 without AI: templates for the night's story in French. One sentence per fact, varied by tone.
// Épicène on purpose: no participle that agrees with a first name.

export const narrationFr = {
  and: "et",
  then: "puis",
  plain: {
    opening: ["{date}, {count} au rendez-vous pour « {party} ».", "« {party} », {date} : {people}."],
    oneVenue: ["Une seule adresse ce soir-là : {venue}.", "Tout s'est passé au même endroit, {venue}."],
    route: ["Le trajet : {venues}.", "{count} bars dans la soirée : {venues}."],
    firstIn: ["Première arrivée : {name}.", "{name} ouvre le bal."],
    takeover: ["{venue} change de main : {name} prend la couronne.", "{name} repart avec {venue}."],
    rounds: ["{count} tournées offertes.", "Côté tournées, le compteur affiche {count}."],
    quote: ["La phrase retenue : « {quote} ».", "On retiendra : « {quote} »."],
    lastHome: ["Dernier retour signalé : {name}, à {time}.", "{name} ferme la marche, chez soi à {time}."],
    closing: ["Rendez-vous à la prochaine.", "Fin du récit."],
  },
  epic: {
    opening: ["Il y eut d'abord « {party} », {date}, et {count} âmes prêtes à tout.", "{date}. « {party} ». {people} répondent à l'appel."],
    oneVenue: ["Un seul champ de bataille, {venue}, tenu jusqu'au bout.", "{venue} fut le théâtre de tout."],
    route: ["La campagne traverse {count} territoires : {venues}.", "De {venues}, la troupe ne recule jamais."],
    firstIn: ["{name} pose le premier pied sur le terrain, avant tout le monde.", "Avant l'aube de la soirée, {name} est déjà là."],
    takeover: ["{name} s'empare de {venue}. Le trône a changé de mains.", "À {venue}, une nouvelle couronne : {name}."],
    rounds: ["{count} tournées, versées comme un tribut.", "Le trésor du crew s'ouvre {count} fois."],
    quote: ["Les bardes chanteront longtemps : « {quote} ».", "Une phrase entre dans la légende : « {quote} »."],
    lastHome: ["À {time}, {name} rejoint enfin ses terres.", "{name} rentre la dernière bannière, à {time}."],
    closing: ["La légende continue.", "Et la nuit retomba sur le royaume."],
  },
  roast: {
    opening: ["« {party} », {date} : {count} personnes qui avaient dit « juste un verre ».", "{date}, « {party} ». {people}, toujours les mêmes."],
    oneVenue: ["Grosse aventure : un seul bar, {venue}. On bouge pas, on s'enracine.", "{venue} toute la soirée. L'exploration, c'est pour les autres."],
    route: ["Un tour de {count} bars, {venues}, parce que rester sur place c'était trop simple.", "Itinéraire du soir : {venues}. Personne n'avait de plan, ça se voit."],
    firstIn: ["{name} arrive en premier. Personne n'a demandé, mais merci.", "{name} était là avant tout le monde, comme d'habitude, à attendre."],
    takeover: ["{name} prend {venue}. Le bar ne s'en remettra pas.", "{venue} passe à {name}. On espère qu'il y a un service client."],
    rounds: ["{count} tournées. Les portefeuilles, eux, s'en souviennent.", "{count} tournées payées, et toujours personne pour la suivante."],
    quote: ["Moment de poésie : « {quote} ».", "Citation de la nuit, à encadrer ou à oublier : « {quote} »."],
    lastHome: ["{name} rentre à {time}. Respect, ou inquiétude.", "Dernier retour : {name}, {time}. Le lit attendait depuis longtemps."],
    closing: ["On en reparle quand tout le monde aura dormi.", "Bonne récupération à toutes et à tous."],
  },
};
