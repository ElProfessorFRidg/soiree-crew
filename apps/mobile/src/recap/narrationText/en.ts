// AI-02 without AI: templates for the night's story in English, used for every language but French.

export const narrationEn = {
  and: "and",
  then: "then",
  plain: {
    opening: ["{date}: {count} turned up for “{party}”.", "“{party}”, {date}: {people}."],
    oneVenue: ["One place all night: {venue}.", "It all happened in one spot, {venue}."],
    route: ["The route: {venues}.", "{count} bars in one night: {venues}."],
    firstIn: ["First in: {name}.", "{name} got things going."],
    takeover: ["{venue} changes hands: {name} takes the crown.", "{name} walks off with {venue}."],
    rounds: ["{count} rounds bought.", "Rounds on the clock: {count}."],
    quote: ["Line of the night: “{quote}”.", "For the record: “{quote}”."],
    lastHome: ["Last one home: {name}, at {time}.", "{name} closed the night, home at {time}."],
    closing: ["Until next time.", "That's the night."],
  },
  epic: {
    opening: ["First came “{party}”, on {date}, and {count} souls ready for anything.", "{date}. “{party}”. {people} answer the call."],
    oneVenue: ["One battlefield, {venue}, held to the very end.", "{venue} saw it all."],
    route: ["The campaign crossed {count} lands: {venues}.", "Through {venues}, the crew never once fell back."],
    firstIn: ["{name} set foot on the field before anyone else.", "Before the night had even started, {name} was there."],
    takeover: ["{name} seizes {venue}. The throne has a new owner.", "At {venue}, a new crown: {name}."],
    rounds: ["{count} rounds, poured like tribute.", "The crew's treasury opened {count} times."],
    quote: ["The bards will sing it for years: “{quote}”.", "A line passes into legend: “{quote}”."],
    lastHome: ["At {time}, {name} finally reached home ground.", "{name} carried the last banner home at {time}."],
    closing: ["The legend goes on.", "And night fell once more on the kingdom."],
  },
  roast: {
    opening: ["“{party}”, {date}: {count} people who all said “just the one”.", "{date}, “{party}”. {people}, the usual suspects."],
    oneVenue: ["Big adventure: one bar, {venue}. Roots were put down.", "{venue} all night. Exploring is for other people."],
    route: ["A {count}-bar crawl, {venues}, because sitting still was too easy.", "Tonight's route: {venues}. Nobody had a plan and it shows."],
    firstIn: ["{name} got there first. Nobody asked, but thanks.", "{name} was there before everyone, as usual, waiting."],
    takeover: ["{name} takes {venue}. The bar will never recover.", "{venue} now belongs to {name}. We hope there's a complaints desk."],
    rounds: ["{count} rounds. The wallets remember better than you do.", "{count} rounds bought and still nobody for the next one."],
    quote: ["A moment of poetry: “{quote}”.", "Quote of the night, to frame or to forget: “{quote}”."],
    lastHome: ["{name} home at {time}. Respect, or concern.", "Last one in: {name}, {time}. The bed had been waiting a while."],
    closing: ["We'll talk about it once everyone's slept.", "Get well soon, all of you."],
  },
};
